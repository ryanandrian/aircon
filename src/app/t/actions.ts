"use server";

import { getServerContext } from "@/lib/auth/context";
import { prisma } from "@/lib/prisma";
import { transitionJob, TransitionError } from "@/lib/services/job-service";
import { setChecklistItem, addJobPhoto } from "@/lib/services/job-work-service";
import { JobError } from "@/lib/services/job-management-service";
import { createPhotoUploadUrl, isStorageConfigured, isOwnedPhotoUrl } from "@/lib/storage/s3";
import { clearTechSession } from "@/lib/auth/tech-session";
import type { JobStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

export type TechActionResult = { ok: true } | { ok: false; error: string };

/** Logout teknisi (hapus sesi cookie). */
export async function techLogout(): Promise<void> {
  await clearTechSession();
}

/** Ambil technicianId milik user yang login (tenant-scoped). */
async function requireTechnician(): Promise<{ tenantId: string; userId: string; technicianId: string }> {
  const ctx = await getServerContext();
  const tech = await prisma.technician.findFirst({
    where: { tenantId: ctx.tenantId, userId: ctx.userId },
    select: { id: true },
  });
  if (!tech) throw new JobError("FORBIDDEN", "Akun ini bukan teknisi");
  return { tenantId: ctx.tenantId, userId: ctx.userId, technicianId: tech.id };
}

/**
 * Ubah status pekerjaan oleh teknisi (terima → berangkat → tiba → kerjakan → selesai).
 * SECURITY: hanya teknisi yang ditugaskan pada job itu.
 * Idempoten via clientEventId.
 */
export async function techTransition(
  jobId: string,
  toStatus: JobStatus,
  opts?: { reason?: string; clientEventId?: string },
): Promise<TechActionResult> {
  try {
    const { tenantId, userId, technicianId } = await requireTechnician();

    // Pastikan job ditugaskan ke teknisi ini.
    const job = await prisma.jobOrder.findFirst({
      where: { id: jobId, tenantId, technicianId },
      select: { id: true },
    });
    if (!job) return { ok: false, error: "Pekerjaan tidak ditemukan / bukan tugas Anda" };

    await transitionJob({
      tenantId,
      jobId,
      toStatus,
      actorId: userId,
      role: "TECHNICIAN",
      clientEventId: opts?.clientEventId,
      meta: opts?.reason ? { reason: opts.reason } : undefined,
    });
    revalidatePath(`/t/pekerjaan/${jobId}`);
    revalidatePath("/t");
    return { ok: true };
  } catch (err) {
    if (err instanceof TransitionError) {
      if (err.code === "GUARD_FAILED") {
        const missing = (err.details as { missing?: string[] })?.missing ?? [];
        return { ok: false, error: `Belum lengkap: ${missing.join(", ") || "checklist/foto wajib"}` };
      }
      return { ok: false, error: err.message };
    }
    if (err instanceof JobError) return { ok: false, error: err.message };
    console.error("[techTransition] gagal:", err);
    return { ok: false, error: "Gagal memperbarui pekerjaan." };
  }
}

/** Simpan hasil checklist oleh teknisi. */
export async function techSetChecklist(
  jobId: string,
  itemKey: string,
  data: { checked?: boolean; value?: string | null },
): Promise<TechActionResult> {
  try {
    const { tenantId, technicianId } = await requireTechnician();
    const job = await prisma.jobOrder.findFirst({
      where: { id: jobId, tenantId, technicianId }, select: { id: true },
    });
    if (!job) return { ok: false, error: "Bukan tugas Anda" };
    await setChecklistItem(tenantId, jobId, itemKey, data);
    revalidatePath(`/t/pekerjaan/${jobId}`);
    return { ok: true };
  } catch (err) {
    console.error("[techSetChecklist] gagal:", err);
    return { ok: false, error: "Gagal menyimpan checklist." };
  }
}

/**
 * Minta presigned URL untuk upload foto ke S3 (BiznetGio/AWS/R2/MinIO).
 * SECURITY: key di-namespace per tenant+job oleh server; klien tak menentukan path.
 */
export async function techRequestUploadUrl(
  jobId: string,
  kind: "before" | "after" | "general",
  filename: string,
  contentType: string,
): Promise<{ ok: true; uploadUrl: string; publicUrl: string } | { ok: false; error: string }> {
  try {
    if (!isStorageConfigured()) return { ok: false, error: "Penyimpanan foto belum dikonfigurasi. Hubungi admin." };
    const { tenantId, technicianId } = await requireTechnician();
    const job = await prisma.jobOrder.findFirst({
      where: { id: jobId, tenantId, technicianId }, select: { id: true },
    });
    if (!job) return { ok: false, error: "Bukan tugas Anda" };
    const { uploadUrl, publicUrl } = await createPhotoUploadUrl({ tenantId, jobId, kind, filename, contentType });
    return { ok: true, uploadUrl, publicUrl };
  } catch (err) {
    if (err instanceof JobError) return { ok: false, error: err.message };
    console.error("[techRequestUploadUrl] gagal:", err);
    return { ok: false, error: "Gagal menyiapkan upload foto." };
  }
}

/** Catat foto bukti setelah klien meng-upload ke S3 (url = publicUrl dari presign). */
export async function techAddPhoto(
  jobId: string,
  kind: "before" | "after" | "general",
  url: string,
): Promise<TechActionResult> {
  try {
    const { tenantId, technicianId } = await requireTechnician();
    const job = await prisma.jobOrder.findFirst({
      where: { id: jobId, tenantId, technicianId }, select: { id: true },
    });
    if (!job) return { ok: false, error: "Bukan tugas Anda" };
    // SECURITY: URL foto WAJIB dari folder S3 milik tenant+job ini (bukan URL eksternal).
    if (!isOwnedPhotoUrl(tenantId, jobId, url)) {
      return { ok: false, error: "URL foto tidak sah." };
    }
    await addJobPhoto(tenantId, jobId, kind, url);
    revalidatePath(`/t/pekerjaan/${jobId}`);
    return { ok: true };
  } catch (err) {
    if (err instanceof JobError) return { ok: false, error: err.message };
    console.error("[techAddPhoto] gagal:", err);
    return { ok: false, error: "Gagal menyimpan foto." };
  }
}
