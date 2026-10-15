/**
 * Job Management Service — pembuatan, assignment, dan query job.
 * Melengkapi job-service.ts (transisi FSM). Semua tenant-scoped + kuota.
 * Bahasa domain ramah-teknisi (lihat copy/terms.ts): "Pekerjaan".
 */
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { JobStatus, JobSource, ServiceType } from "@prisma/client";
import { ACTIVE_STATUSES } from "@/lib/domain/job-state-machine";
import { notifyAssignees } from "@/lib/services/push-notification-service";

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

  // SATU transaksi: job + event + roster penugasan.
  // A (audit 2026-10-04): form "Tambah Pekerjaan" dulu hanya menulis JobOrder.technicianId
  // tanpa JobAssignment → halaman detail (listAssignments) menampilkan "Belum ditugaskan"
  // padahal sudah ada teknisi (terbukti pada 5 job live). Roster dibuat di sini agar semua
  // pembaca JobAssignment (detail, agenda, insentif kernet) ikut benar.
  const job = await prisma.$transaction(async (tx) => {
    const job = await tx.jobOrder.create({
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
    await tx.jobProgressEvent.create({
      data: { tenantId, jobId: job.id, fromStatus: null, toStatus: status, actorId: createdById, meta: {} as never },
    });

    // Teknisi dari form = satu-satunya personel → sekaligus penanggung jawab (lead),
    // sejajar backward-compat JobOrder.technicianId = lead pada assignment-service.
    if (input.technicianId) {
      await tx.jobAssignment.create({
        data: {
          tenantId,
          jobId: job.id,
          personId: input.technicianId,
          roleOnJob: "TECHNICIAN",
          isLead: true,
        },
      });
    }

    return job;
  });

  // G-A5: notifikasi tugas baru hanya setelah transaction commit (side-effect
  // push TIDAK BOLEH di dalam transaksi DB). Aman-gagal, tidak mengubah job.
  if (input.technicianId) {
    void notifyAssignees({ tenantId, jobId: job.id, personIds: [input.technicianId] });
  }
  return job;
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

/**
 * F9d (SSOT_Alar_Teknisi 0.1/0.2): daftar kerja BELUM TUNTAS yang jadwalnya
 * SUDAH LEWAT (masa lalu, termasuk tanpa tindak lanjut) — scoping SAMA persis
 * dgn listTechnicianJobsToday (technicianId utama ATAU anggota JobAssignment).
 * "Hari ini" tetap terpisah (listTechnicianJobsToday TIDAK diubah) — backlog
 * = PENAMBAH, agar pekerjaan tertunda tak pernah tersembunyi dari teknisi.
 * Job tempo yg SUDAH closing (proforma terbit) TIDAK lagi "aktif" — otomatis
 * keluar dari dua daftar ini (masuk riwayat/pantauan).
 */
export async function listTechnicianBacklogJobs(tenantId: string, technicianId: string) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
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
      scheduledDate: { lt: startOfToday }, // lewat jadwal (null = tanpa jadwal → tetap di "hari ini")
      AND: [{ OR: [{ technicianId }, { id: { in: assignedJobIds } }] }],
    },
    include: {
      customer: { select: { name: true, phone: true, address: true } },
      asset: { select: { brand: true, model: true, roomLocation: true } },
    },
    orderBy: [{ scheduledDate: "asc" }], // jadwal terlama di atas = lama menunggu makin kelihatan
    // Batas aman skala (keputusan pemilik 2026-10-15: jangan desain dari data demo).
    // 50 paling telat = mendesak tetap terlihat; jumlah penuh selalu terwakili
    // di kartu ringkasan (dihitung query count terpisah, bukan dari daftar ini).
    take: 50,
  });
}

/** F9d: hitungan backlog PENUH utk kartu ringkasan (daftar backlog dibatasi take=50
 *  supaya aman skala; angka kartu tetap akurat dari count — bukan dari panjang daftar). */
export async function countTechnicianBacklogJobs(tenantId: string, technicianId: string): Promise<number> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const assigned = await prisma.jobAssignment.findMany({
    where: { tenantId, personId: technicianId },
    select: { jobId: true },
  });
  return prisma.jobOrder.count({
    where: {
      tenantId,
      deletedAt: null,
      status: { in: ACTIVE_STATUSES },
      scheduledDate: { lt: startOfToday },
      AND: [{ OR: [{ technicianId }, { id: { in: assigned.map((a) => a.jobId) } }] }],
    },
  });
}

/** F9d: hitung COMPLETED hari ini utk kartu ringkasan (doneCount lama SELALU 0 —
 *  menghitung COMPLETED dari daftar yg sudah difilter ACTIVE). */
export async function countTechnicianCompletedToday(tenantId: string, technicianId: string): Promise<number> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const assigned = await prisma.jobAssignment.findMany({
    where: { tenantId, personId: technicianId },
    select: { jobId: true },
  });
  return prisma.jobOrder.count({
    where: {
      tenantId,
      deletedAt: null,
      status: "COMPLETED",
      completedAt: { gte: startOfToday, lte: endOfToday },
      AND: [{ OR: [{ technicianId }, { id: { in: assigned.map((a) => a.jobId) } }] }],
    },
  });
}

/**
 * Poin 3 — Edit CATATAN pekerjaan (`JobOrder.notes`) sebelum finalisasi.
 *
 * Jalur edit umum ini memang belum pernah ada (audit: `actionUpdateJob`/`actionEditJob`
 * 0 kemunculan) dan hanya menangani SATU field whitelist: `notes`.
 *
 * Guard:
 * - tenant-scoped (job asing / terhapus → NOT_FOUND, tanpa bocor info keberadaan);
 * - ditolak untuk status terminal COMPLETED & CANCELLED — closing hanya lewat
 *   `closeWorkSession` (satuan-satunya penulis COMPLETED, atomik dgn invoice/proforma);
 * - status aktif (DRAFT..WAITING) boleh dikoreksi, sesuai keputusan user "sebelum selesai".
 *
 * TIDAK menyentuh customer/asset/service/roster/jadwal/status/WorkItem/Invoice.
 * Kontrak kosong: string kosong → `null` (konsisten poli existing `?? null` customer/asset).
 */
export async function updateJobNotes(
  tenantId: string,
  jobId: string,
  notes: string,
): Promise<void> {
  const job = await prisma.jobOrder.findFirst({
    where: { id: jobId, tenantId, deletedAt: null },
    select: { id: true, status: true },
  });
  if (!job) throw new JobError("NOT_FOUND", "Pekerjaan tidak ditemukan");
  if (job.status === "COMPLETED" || job.status === "CANCELLED") {
    throw new JobError(
      "VALIDATION",
      "Pekerjaan sudah selesai/dibatalkan — catatan tidak bisa diubah lagi.",
    );
  }
  const value = notes.trim() || null;
  await prisma.jobOrder.update({
    where: { id: job.id },
    data: { notes: value }, // whitelist ketat: SATU field
  });
}
