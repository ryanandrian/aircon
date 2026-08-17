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

/** Ambil template checklist + hasil saat ini untuk sebuah job. */
export async function getJobChecklist(tenantId: string, jobId: string) {
  const job = await prisma.jobOrder.findFirst({ where: { id: jobId, tenantId }, select: { serviceType: true } });
  if (!job) throw new JobError("NOT_FOUND", "Pekerjaan tidak ditemukan");

  const template = await prisma.checklistTemplate.findUnique({
    where: { tenantId_serviceType: { tenantId, serviceType: job.serviceType } },
  });
  const items = ((template?.items as unknown as ChecklistItemDef[]) ?? []);
  const results = await prisma.checklistResult.findMany({ where: { tenantId, jobId } });
  const resultMap = new Map(results.map((r) => [r.itemKey, r]));

  return items.map((it) => ({
    ...it,
    checked: resultMap.get(it.key)?.checked ?? false,
    value: resultMap.get(it.key)?.value ?? null,
  }));
}

/** Simpan/hapus satu hasil checklist (upsert). SECURITY: verifikasi job milik tenant. */
export async function setChecklistItem(
  tenantId: string,
  jobId: string,
  itemKey: string,
  data: { checked?: boolean; value?: string | null },
) {
  const job = await prisma.jobOrder.findFirst({ where: { id: jobId, tenantId }, select: { id: true } });
  if (!job) throw new JobError("NOT_FOUND", "Pekerjaan tidak ditemukan");

  return prisma.checklistResult.upsert({
    where: { tenantId_jobId_itemKey: { tenantId, jobId, itemKey } },
    create: { tenantId, jobId, itemKey, checked: data.checked ?? false, value: data.value ?? null },
    update: {
      ...(data.checked !== undefined ? { checked: data.checked } : {}),
      ...(data.value !== undefined ? { value: data.value } : {}),
    },
  });
}

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
