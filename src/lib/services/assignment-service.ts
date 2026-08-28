/**
 * Assignment Service (F3.2) — penugasan multi-personel & peran cair (K3) + deteksi bentrok jadwal.
 * SECURITY: tenant-scoped. Kode lama yang baca JobOrder.technicianId TETAP jalan (backward-compat):
 * assignJob juga menyetel technicianId = lead (atau personel pertama) agar UI lama tak pecah.
 */
import { prisma } from "@/lib/prisma";
import { ServiceError } from "@/lib/services/customer-service";

export type AssignmentRole = "TECHNICIAN" | "KERNET";

export interface AssignmentInput {
  personId: string;
  roleOnJob: AssignmentRole;
  isLead?: boolean;
}

// ---------- DETEKSI BENTROK (murni, mudah diuji) ----------

export interface TimeWindow {
  start: Date;
  end: Date;
}

/** True bila dua rentang waktu tumpang-tindih (bersentuhan di ujung TIDAK dihitung bentrok). */
export function windowsOverlap(a: TimeWindow, b: TimeWindow): boolean {
  return a.start < b.end && b.start < a.end;
}

// ---------- QUERY BENTROK (DB) ----------

/**
 * Cari job lain yang membuat `personId` bentrok pada rentang [windowStart, windowEnd].
 * Hanya job aktif (belum selesai/batal, belum dihapus) yang punya jendela waktu.
 * @returns daftar {jobId, customerName, windowStart, windowEnd} yang overlap.
 */
export async function detectConflict(
  tenantId: string,
  personId: string,
  windowStart: Date,
  windowEnd: Date,
  excludeJobId?: string,
): Promise<{ jobId: string; customerName: string; windowStart: Date; windowEnd: Date }[]> {
  // Job tempat person ditugaskan (via JobAssignment) atau sebagai technician lama.
  const assigned = await prisma.jobAssignment.findMany({
    where: { tenantId, personId },
    select: { jobId: true },
  });
  const jobIds = assigned.map((a) => a.jobId);

  const jobs = await prisma.jobOrder.findMany({
    where: {
      tenantId,
      deletedAt: null,
      status: { notIn: ["COMPLETED", "CANCELLED"] },
      windowStart: { not: null },
      windowEnd: { not: null },
      ...(excludeJobId ? { id: { not: excludeJobId } } : {}),
      OR: [
        { id: { in: jobIds } },
        { technicianId: personId },
      ],
    },
    select: { id: true, windowStart: true, windowEnd: true, customer: { select: { name: true } } },
  });

  const target: TimeWindow = { start: windowStart, end: windowEnd };
  return jobs
    .filter((j) => j.windowStart && j.windowEnd && windowsOverlap(target, { start: j.windowStart, end: j.windowEnd }))
    .map((j) => ({
      jobId: j.id,
      customerName: j.customer?.name ?? "—",
      windowStart: j.windowStart as Date,
      windowEnd: j.windowEnd as Date,
    }));
}

// ---------- PENUGASAN ----------

/**
 * Tetapkan N personel ke sebuah job dengan peran cair (K3). Mengganti seluruh assignment job (replace-set).
 * Backward-compat: JobOrder.technicianId disetel ke lead (atau personel pertama) agar UI lama tetap jalan.
 * @param window opsional; bila diberikan, dipakai memperbarui jendela waktu job.
 */
export async function assignJob(
  tenantId: string,
  jobId: string,
  people: AssignmentInput[],
  window?: TimeWindow,
): Promise<void> {
  const job = await prisma.jobOrder.findFirst({ where: { id: jobId, tenantId }, select: { id: true } });
  if (!job) throw new ServiceError("NOT_FOUND", "Pekerjaan tidak ditemukan");
  if (people.length === 0) throw new ServiceError("CONFLICT", "Minimal 1 personel ditugaskan");

  // Validasi semua personel milik tenant.
  const persons = await prisma.technician.findMany({
    where: { tenantId, id: { in: people.map((p) => p.personId) } },
    select: { id: true },
  });
  const validIds = new Set(persons.map((p) => p.id));
  for (const p of people) {
    if (!validIds.has(p.personId)) throw new ServiceError("NOT_FOUND", "Personel tidak ditemukan");
  }

  // Tepat satu lead: bila tak ada isLead eksplisit, personel pertama jadi lead.
  const hasLead = people.some((p) => p.isLead);
  const lead = hasLead ? people.find((p) => p.isLead)! : people[0];

  await prisma.$transaction(async (tx) => {
    await tx.jobAssignment.deleteMany({ where: { jobId, tenantId } });
    await tx.jobAssignment.createMany({
      data: people.map((p) => ({
        tenantId, jobId, personId: p.personId, roleOnJob: p.roleOnJob,
        isLead: p === lead,
      })),
    });
    await tx.jobOrder.update({
      where: { id: jobId },
      data: {
        technicianId: lead.personId, // backward-compat
        ...(window ? { windowStart: window.start, windowEnd: window.end } : {}),
      },
    });
  });
}

/** Ambil daftar personel yang ditugaskan pada job (dgn nama & peran). */
export async function listAssignments(tenantId: string, jobId: string) {
  const rows = await prisma.jobAssignment.findMany({
    where: { tenantId, jobId },
    include: { person: { select: { id: true, user: { select: { name: true } } } } },
    orderBy: [{ isLead: "desc" }, { createdAt: "asc" }],
  });
  return rows.map((r) => ({
    personId: r.personId,
    name: r.person?.user?.name ?? "—",
    roleOnJob: r.roleOnJob as AssignmentRole,
    isLead: r.isLead,
  }));
}
