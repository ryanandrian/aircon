/**
 * Checklist & Foto Service — dipakai teknisi saat mengerjakan job.
 * Semua tenant-scoped + verifikasi job milik tenant.
 */
import { prisma } from "@/lib/prisma";
import { JobError } from "@/lib/services/job-management-service";

interface ChecklistItemDef {
  key: string;
  label: string;
  type: "bool" | "number" | "text" | "photo";
  required: boolean;
}

/**
 * Apakah `personId` (Technician.id — mencakup TEKNISI & KERNET) boleh bekerja pada sebuah job?
 *
 * Bukti DB live (read-only 2026-10-03): JobAssignment berisi 70 TECHNICIAN + 23 KERNET, dan pada
 * 3 sampel penugasan kernet `job.technicianId` menunjuk teknisi LAIN (MATCH=false). Pemeriksaan lama
 * yang hanya `job.technicianId === saya` akan menolak kernet yang sah ditugaskan.
 * Tenant-scoped: job di query dengan `tenantId`.
 */
export async function assertCanOperateOnJob(tenantId: string, personId: string, jobId: string): Promise<void> {
  const job = await prisma.jobOrder.findFirst({
    where: { id: jobId, tenantId },
    select: { id: true, technicianId: true },
  });
  if (!job) throw new JobError("FORBIDDEN", "Bukan tugas Anda");
  if (job.technicianId === personId) return;

  const assignment = await prisma.jobAssignment.findFirst({
    where: { jobId: job.id, tenantId, personId },
    select: { id: true },
  });
  if (!assignment) throw new JobError("FORBIDDEN", "Bukan tugas Anda");
}

// Jalur checklist legacy berbasis `JobOrder.serviceType` + `ChecklistResult.jobId` telah DIHAPUS.
// Satu-satunya checklist kini per layanan × unit melalui fungsi WorkItem di bawah.

/** Catat foto bukti pekerjaan (before/after/general). SECURITY: verifikasi job milik tenant. */
export async function addJobPhoto(
  tenantId: string,
  jobId: string,
  kind: "before" | "after" | "general",
  url: string,
) {
  const job = await prisma.jobOrder.findFirst({ where: { id: jobId, tenantId }, select: { id: true } });
  if (!job) throw new JobError("NOT_FOUND", "Pekerjaan tidak ditemukan");
  if (!/^https?:\/\//.test(url)) throw new JobError("VALIDATION", "URL foto tidak valid");

  return prisma.jobPhoto.create({ data: { tenantId, jobId, kind, url } });
}

/** Daftar foto sebuah job. */
export async function listJobPhotos(tenantId: string, jobId: string) {
  return prisma.jobPhoto.findMany({ where: { tenantId, jobId }, orderBy: { at: "asc" } });
}

// ════════════════════════════════════════════════════════════════════════
// FASE 2 — Checklist per WORK ITEM (layanan × unit). Sumber kebenaran BARU.
// ════════════════════════════════════════════════════════════════════════

/** Ambil template checklist layanan + hasil saat ini utk satu WorkItem. */
export async function getWorkItemChecklist(tenantId: string, workItemId: string) {
  const wi = await prisma.workItem.findFirst({
    where: { id: workItemId, tenantId },
    select: { id: true, serviceId: true },
  });
  if (!wi) throw new JobError("NOT_FOUND", "Baris pekerjaan tidak ditemukan");
  if (!wi.serviceId) return [];

  const template = await prisma.checklistTemplate.findUnique({
    where: { tenantId_serviceId: { tenantId, serviceId: wi.serviceId } },
  });
  const items = ((template?.items as unknown as ChecklistItemDef[]) ?? []);
  const results = await prisma.checklistResult.findMany({ where: { tenantId, workItemId } });
  const resultMap = new Map(results.map((r) => [r.itemKey, r]));

  return items.map((it) => ({
    ...it,
    checked: resultMap.get(it.key)?.checked ?? false,
    value: resultMap.get(it.key)?.value ?? null,
  }));
}

/** Simpan/hapus satu hasil checklist WorkItem (upsert). SECURITY: verifikasi WorkItem milik tenant. */
export async function setWorkItemChecklistItem(
  tenantId: string,
  workItemId: string,
  itemKey: string,
  data: { checked?: boolean; value?: string | null },
) {
  const wi = await prisma.workItem.findFirst({ where: { id: workItemId, tenantId }, select: { id: true } });
  if (!wi) throw new JobError("NOT_FOUND", "Baris pekerjaan tidak ditemukan");

  return prisma.checklistResult.upsert({
    where: { tenantId_workItemId_itemKey: { tenantId, workItemId, itemKey } },
    create: { tenantId, workItemId, itemKey, checked: data.checked ?? false, value: data.value ?? null },
    update: {
      ...(data.checked !== undefined ? { checked: data.checked } : {}),
      ...(data.value !== undefined ? { value: data.value } : {}),
    },
  });
}
