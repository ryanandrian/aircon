/**
 * Job Management Service — pembuatan, assignment, dan query job.
 * Melengkapi job-service.ts (transisi FSM). Semua tenant-scoped + kuota.
 * Bahasa domain ramah-teknisi (lihat copy/terms.ts): "Pekerjaan".
 */
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { JobStatus, JobSource, ServiceType } from "@prisma/client";
import { ACTIVE_STATUSES } from "@/lib/domain/job-state-machine";

export class JobError extends Error {
  code: "NOT_FOUND" | "VALIDATION" | "FORBIDDEN";
  details?: unknown;
  constructor(code: JobError["code"], message: string, details?: unknown) {
    super(message);
    this.name = "JobError";
    this.code = code;
    this.details = details;
  }
}

export interface CreateJobInput {
  customerId: string;
  assetId?: string;
  serviceType: ServiceType;
  scheduledDate?: Date;
  windowStart?: Date;
  windowEnd?: Date;
  estDurationMin?: number;
  price?: number;
  notes?: string;
  source?: JobSource;
  technicianId?: string;
}

/**
 * Buat pekerjaan baru (status DRAFT, atau ASSIGNED bila teknisi+jadwal diberikan).
 * SECURITY: tenant-scoped; customer & asset & technician diverifikasi milik tenant.
 */
export async function createJob(
  tenantId: string,
  createdById: string,
  input: CreateJobInput,
) {
  // Verifikasi customer milik tenant
  const customer = await prisma.customer.findFirst({
    where: { id: input.customerId, tenantId, deletedAt: null },
  });
  if (!customer) throw new JobError("VALIDATION", "Pelanggan tidak ditemukan");

  if (input.assetId) {
    const asset = await prisma.asset.findFirst({
      where: { id: input.assetId, tenantId, customerId: input.customerId },
    });
    if (!asset) throw new JobError("VALIDATION", "Unit AC tidak ditemukan / bukan milik pelanggan ini");
  }

  let status: JobStatus = "DRAFT";
  if (input.technicianId) {
    const tech = await prisma.technician.findFirst({
      where: { id: input.technicianId, tenantId },
    });
    if (!tech) throw new JobError("VALIDATION", "Teknisi tidak ditemukan");
    if (input.scheduledDate) status = "ASSIGNED";
  }

  const addressSnapshot = customer.address ?? null;

  const job = await prisma.jobOrder.create({
    data: {
      tenantId,
      customerId: input.customerId,
      assetId: input.assetId ?? null,
      technicianId: input.technicianId ?? null,
      serviceType: input.serviceType,
      status,
      source: input.source ?? "MANUAL",
      scheduledDate: input.scheduledDate ?? null,
      windowStart: input.windowStart ?? null,
      windowEnd: input.windowEnd ?? null,
      estDurationMin: input.estDurationMin ?? 60,
      price: input.price != null ? new Prisma.Decimal(input.price) : null,
      notes: input.notes ?? null,
      addressSnapshot,
      geoLat: customer.geoLat ?? null,
      geoLng: customer.geoLng ?? null,
      createdById,
    },
  });

  // Catat event awal (audit).
  await prisma.jobProgressEvent.create({
    data: { tenantId, jobId: job.id, fromStatus: null, toStatus: status, actorId: createdById, meta: {} as never },
  });

  return job;
}

/**
 * Assign/ubah teknisi + jadwal untuk job DRAFT → ASSIGNED.
 * SECURITY: tenant-scoped.
 */
export async function assignJob(
  tenantId: string,
  jobId: string,
  actorId: string,
  params: { technicianId: string; scheduledDate: Date; windowStart?: Date; windowEnd?: Date },
) {
  const job = await prisma.jobOrder.findFirst({ where: { id: jobId, tenantId } });
  if (!job) throw new JobError("NOT_FOUND", "Pekerjaan tidak ditemukan");
  if (job.status !== "DRAFT" && job.status !== "ASSIGNED") {
    throw new JobError("VALIDATION", "Pekerjaan sudah berjalan, tidak bisa di-assign ulang di sini");
  }
  const tech = await prisma.technician.findFirst({ where: { id: params.technicianId, tenantId } });
  if (!tech) throw new JobError("VALIDATION", "Teknisi tidak ditemukan");

  const updated = await prisma.$transaction(async (tx) => {
    const j = await tx.jobOrder.update({
      where: { id: jobId },
      data: {
        technicianId: params.technicianId,
        scheduledDate: params.scheduledDate,
        windowStart: params.windowStart ?? null,
        windowEnd: params.windowEnd ?? null,
        status: "ASSIGNED",
      },
    });
    if (job.status === "DRAFT") {
      await tx.jobProgressEvent.create({
        data: { tenantId, jobId, fromStatus: "DRAFT", toStatus: "ASSIGNED", actorId, meta: {} as never },
      });
    }
    return j;
  });
  return updated;
}

export interface JobListFilter {
  status?: JobStatus[];
  technicianId?: string;
  customerId?: string;
  from?: Date;
  to?: Date;
  activeOnly?: boolean;
  limit?: number;
  cursor?: string;
}

/** Daftar pekerjaan tenant (cursor pagination). SECURITY: tenant-scoped. */
export async function listJobs(tenantId: string, filter: JobListFilter = {}) {
  const where: Prisma.JobOrderWhereInput = { tenantId, deletedAt: null };
  if (filter.activeOnly) where.status = { in: ACTIVE_STATUSES };
  else if (filter.status?.length) where.status = { in: filter.status };
  if (filter.technicianId) where.technicianId = filter.technicianId;
  if (filter.customerId) where.customerId = filter.customerId;
  if (filter.from || filter.to) {
    where.scheduledDate = {};
    if (filter.from) (where.scheduledDate as Prisma.DateTimeFilter).gte = filter.from;
    if (filter.to) (where.scheduledDate as Prisma.DateTimeFilter).lte = filter.to;
  }

  const limit = Math.min(filter.limit ?? 50, 100);
  const jobs = await prisma.jobOrder.findMany({
    where,
    include: {
      customer: { select: { name: true, phone: true, address: true } },
      asset: { select: { brand: true, model: true, roomLocation: true } },
      technician: { select: { id: true, user: { select: { name: true } } } },
    },
    orderBy: [{ scheduledDate: "asc" }, { createdAt: "desc" }],
    take: limit + 1,
    ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
  });

  const hasMore = jobs.length > limit;
  return { jobs: hasMore ? jobs.slice(0, limit) : jobs, nextCursor: hasMore ? jobs[limit - 1].id : null };
}

export type JobBucket = "today" | "upcoming" | "done";

/** WHERE clause per-tab (bucket) — dipakai daftar & hitungan agar konsisten. */
function bucketWhere(tenantId: string, bucket: JobBucket, search?: string): Prisma.JobOrderWhereInput {
  const now = new Date();
  const startToday = new Date(now); startToday.setHours(0, 0, 0, 0);
  const startTomorrow = new Date(startToday.getTime() + 24 * 60 * 60 * 1000);

  const where: Prisma.JobOrderWhereInput = { tenantId, deletedAt: null };
  if (bucket === "done") {
    where.status = { in: ["COMPLETED", "CANCELLED"] };
  } else if (bucket === "upcoming") {
    where.status = { in: ACTIVE_STATUSES };
    where.scheduledDate = { gte: startTomorrow };
  } else {
    // today: aktif & (terjadwal hari ini ATAU belum terjadwal ATAU sudah lewat) — butuh perhatian.
    where.status = { in: ACTIVE_STATUSES };
    where.OR = [{ scheduledDate: { lt: startTomorrow } }, { scheduledDate: null }];
  }

  const q = search?.trim();
  if (q) {
    const search$: Prisma.JobOrderWhereInput = {
      OR: [
        { customer: { name: { contains: q, mode: "insensitive" } } },
        { customer: { phone: { contains: q } } },
      ],
    };
    // Gabung dgn kondisi bucket (khusus 'today' yg sudah pakai OR) via AND.
    if (where.OR) { where.AND = [{ OR: where.OR }, search$]; delete where.OR; }
    else Object.assign(where, search$);
  }
  return where;
}

/**
 * Daftar pekerjaan per TAB (today/upcoming/done) + pencarian + cursor pagination.
 * Antisipasi data besar per tenant: query server-side per tab, bukan load-all lalu split.
 */
export async function listJobsByBucket(
  tenantId: string,
  bucket: JobBucket,
  opts: { search?: string; cursor?: string; limit?: number } = {},
) {
  const where = bucketWhere(tenantId, bucket, opts.search);
  const limit = Math.min(opts.limit ?? 20, 50);
  // done: terbaru dulu; today/upcoming: terjadwal paling awal dulu.
  const orderBy: Prisma.JobOrderOrderByWithRelationInput[] =
    bucket === "done"
      ? [{ completedAt: "desc" }, { updatedAt: "desc" }]
      : [{ scheduledDate: "asc" }, { createdAt: "desc" }];

  const jobs = await prisma.jobOrder.findMany({
    where,
    include: {
      customer: { select: { name: true, phone: true, address: true } },
      asset: { select: { brand: true, model: true, roomLocation: true } },
      technician: { select: { id: true, user: { select: { name: true } } } },
    },
    orderBy,
    take: limit + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
  });
  const hasMore = jobs.length > limit;
  return { jobs: hasMore ? jobs.slice(0, limit) : jobs, nextCursor: hasMore ? jobs[limit - 1].id : null };
}

/** Hitungan pekerjaan per tab (untuk badge di tab). Tenant-scoped. */
export async function countJobsByBucket(tenantId: string, search?: string) {
  const [today, upcoming, done] = await Promise.all([
    prisma.jobOrder.count({ where: bucketWhere(tenantId, "today", search) }),
    prisma.jobOrder.count({ where: bucketWhere(tenantId, "upcoming", search) }),
    prisma.jobOrder.count({ where: bucketWhere(tenantId, "done", search) }),
  ]);
  return { today, upcoming, done };
}

/** Ambil satu pekerjaan lengkap (tenant-scoped). */
export async function getJob(tenantId: string, jobId: string) {
  return prisma.jobOrder.findFirst({
    where: { id: jobId, tenantId },
    include: {
      customer: true,
      asset: true,
      technician: { select: { id: true, user: { select: { name: true, phone: true } } } },
      photos: true,
      events: { orderBy: { at: "asc" } },
    },
  });
}

/** Pekerjaan hari ini untuk seorang teknisi (untuk app teknisi).
 *  F3.3: termasuk job di mana person ditugaskan via JobAssignment (peran cair), bukan hanya technicianId. */
export async function listTechnicianJobsToday(tenantId: string, technicianId: string) {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(); end.setHours(23, 59, 59, 999);
  const assigned = await prisma.jobAssignment.findMany({
    where: { tenantId, personId: technicianId },
    select: { jobId: true },
  });
  const assignedJobIds = assigned.map((a) => a.jobId);
  return prisma.jobOrder.findMany({
    where: {
      tenantId,
      deletedAt: null,
      status: { in: ACTIVE_STATUSES },
      OR: [{ scheduledDate: { gte: start, lte: end } }, { scheduledDate: null }],
      AND: [{ OR: [{ technicianId }, { id: { in: assignedJobIds } }] }],
    },
    include: {
      customer: { select: { name: true, phone: true, address: true } },
      asset: { select: { brand: true, model: true, roomLocation: true } },
    },
    orderBy: [{ windowStart: "asc" }, { scheduledDate: "asc" }],
  });
}
