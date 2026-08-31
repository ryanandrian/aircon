"use server";

import { getServerContext } from "@/lib/auth/context";
import { prisma } from "@/lib/prisma";
import { transitionJob, TransitionError } from "@/lib/services/job-service";
import { setChecklistItem, addJobPhoto } from "@/lib/services/job-work-service";
import { JobError } from "@/lib/services/job-management-service";
import { listTechnicianJobHistory } from "@/lib/services/technician-service";
import { putPhoto, isStorageConfigured } from "@/lib/storage/s3";
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
 * Upload foto bukti LEWAT SERVER (hindari CORS browser→S3) + catat ke DB dalam satu langkah.
 * SECURITY: tenant+job diverifikasi milik teknisi; byte diunggah server-side via putPhoto.
 */
export async function techUploadPhoto(
  jobId: string,
  kind: "before" | "after" | "general",
  fd: FormData,
): Promise<{ ok: true; publicUrl: string } | { ok: false; error: string }> {
  try {
    if (!isStorageConfigured()) return { ok: false, error: "Penyimpanan foto belum dikonfigurasi. Hubungi admin." };
    const { tenantId, technicianId } = await requireTechnician();
    const job = await prisma.jobOrder.findFirst({
      where: { id: jobId, tenantId, technicianId }, select: { id: true },
    });
    if (!job) return { ok: false, error: "Bukan tugas Anda" };
    const file = fd.get("file");
    if (!(file instanceof File)) return { ok: false, error: "File tidak ditemukan" };
    const ct = file.type || "image/jpeg";
    if (!/^image\/(jpeg|png|webp)$/.test(ct)) return { ok: false, error: "File harus JPG, PNG, atau WebP" };
    if (file.size > 8 * 1024 * 1024) return { ok: false, error: "Ukuran maksimal 8 MB" };
    const body = Buffer.from(await file.arrayBuffer());
    const { publicUrl } = await putPhoto({ tenantId, jobId, kind, filename: file.name, contentType: ct, body });
    await addJobPhoto(tenantId, jobId, kind, publicUrl);
    revalidatePath(`/t/pekerjaan/${jobId}`);
    return { ok: true, publicUrl };
  } catch (err) {
    if (err instanceof JobError) return { ok: false, error: err.message };
    console.error("[techUploadPhoto] gagal:", err);
    return { ok: false, error: "Gagal mengunggah foto. Coba lagi." };
  }
}

/**
 * Teknisi simpan koordinat GPS pelanggan (saat di lokasi) → memudahkan kunjungan berikutnya.
 * SECURITY: tenant-scoped; teknisi hanya boleh mengisi lokasi pelanggan dari job yang ditugaskan padanya.
 */
export async function techSaveCustomerLocation(
  jobId: string,
  lat: number,
  lng: number,
): Promise<TechActionResult> {
  try {
    const { tenantId, technicianId } = await requireTechnician();
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return { ok: false, error: "Koordinat tidak valid" };
    }
    const job = await prisma.jobOrder.findFirst({
      where: { id: jobId, tenantId, technicianId },
      select: { customerId: true },
    });
    if (!job) return { ok: false, error: "Bukan tugas Anda" };
    // updateMany dengan filter tenant memastikan isolasi (tak bisa menyentuh pelanggan tenant lain).
    await prisma.customer.updateMany({
      where: { id: job.customerId, tenantId },
      data: { geoLat: lat, geoLng: lng },
    });
    revalidatePath(`/t/pekerjaan/${jobId}`);
    return { ok: true };
  } catch (err) {
    console.error("[techSaveCustomerLocation] gagal:", err);
    return { ok: false, error: "Gagal menyimpan lokasi." };
  }
}

/** Riwayat pekerjaan + insentif teknisi (dirinya sendiri), filter periode YYYY-MM. */
export async function techJobHistory(period?: string): Promise<
  | { ok: true; rows: { id: string; date: string | null; customer: string; unit: string; role: "TECHNICIAN" | "KERNET"; service: string; status: string; incentive: number }[]; periods: string[]; totalIncentive: number }
  | { ok: false; error: string }
> {
  try {
    const ctx = await getServerContext();
    if (ctx.role !== "TECHNICIAN") return { ok: false, error: "Akses ditolak" };
    const tech = await prisma.technician.findFirst({
      where: { tenantId: ctx.tenantId, userId: ctx.userId }, select: { id: true },
    });
    if (!tech) return { ok: false, error: "Teknisi tidak ditemukan" };
    const res = await listTechnicianJobHistory(ctx.tenantId, tech.id, period || undefined);
    return { ok: true, ...res };
  } catch (err) {
    console.error("[techJobHistory] gagal:", err);
    return { ok: false, error: "Gagal memuat riwayat." };
  }
}
