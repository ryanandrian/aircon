"use server";

import { revalidatePath } from "next/cache";
import { tryGetServerContext } from "@/lib/auth/context";
import { tenantProfileSchema } from "@/lib/validation/tenant-profile";
import { updateTenantProfile } from "@/lib/services/tenant-profile-service";
import { createTenantAssetUploadUrl, putTenantAsset } from "@/lib/storage/s3";
import { ServiceError } from "@/lib/services/customer-service";

type Result = { ok: boolean; error?: string };

/** Hanya owner/admin tenant yang boleh ubah profil usaha. */
function canManage(role: string): boolean {
  return role === "OWNER" || role === "ADMIN";
}

/** Presign upload aset tenant (logo/QRIS) — tenant-scoped, hanya owner/admin. */
export async function actionPresignTenantAsset(
  scope: "logo" | "qris",
  filename: string,
  contentType: string,
): Promise<{ ok: boolean; error?: string; uploadUrl?: string; publicUrl?: string }> {
  const ctx = await tryGetServerContext();
  if (!ctx?.tenantId) return { ok: false, error: "Sesi tidak valid" };
  if (!canManage(ctx.role)) return { ok: false, error: "Tidak berwenang" };
  try {
    const r = await createTenantAssetUploadUrl({ tenantId: ctx.tenantId, scope, filename, contentType });
    return { ok: true, uploadUrl: r.uploadUrl, publicUrl: r.publicUrl };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal presign" };
  }
}

/** Upload aset tenant (logo/QRIS) LANGSUNG lewat server — anti-CORS. FormData: file. */
export async function actionUploadTenantAsset(
  scope: "logo" | "qris",
  fd: FormData,
): Promise<{ ok: boolean; error?: string; publicUrl?: string }> {
  const ctx = await tryGetServerContext();
  if (!ctx?.tenantId) return { ok: false, error: "Sesi tidak valid" };
  if (!canManage(ctx.role)) return { ok: false, error: "Tidak berwenang" };
  const file = fd.get("file");
  if (!(file instanceof File)) return { ok: false, error: "File tidak ditemukan" };
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return { ok: false, error: "File harus JPG, PNG, atau WebP" };
  if (file.size > 4 * 1024 * 1024) return { ok: false, error: "Ukuran maksimal 4 MB" };
  try {
    const body = Buffer.from(await file.arrayBuffer());
    const r = await putTenantAsset({ tenantId: ctx.tenantId, scope, filename: file.name, contentType: file.type, body });
    return { ok: true, publicUrl: r.publicUrl };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal mengunggah" };
  }
}

/** Simpan profil usaha (branding/pajak/rekening/QRIS). */
export async function actionSaveTenantProfile(raw: {
  name?: string; phone?: string; address?: string; tagline?: string;
  logoUrl?: string; isPkp?: boolean; npwp?: string; taxPercent?: number;
  bankName?: string; bankAccountNo?: string; bankAccountName?: string; qrisImageUrl?: string;
  teamIncentiveMode?: "BAGI_RATA" | "PENUH"; incentiveBasis?: "LUNAS" | "TERBIT";
}): Promise<Result> {
  const ctx = await tryGetServerContext();
  if (!ctx?.tenantId) return { ok: false, error: "Sesi tidak valid" };
  if (!canManage(ctx.role)) return { ok: false, error: "Tidak berwenang" };
  const parsed = tenantProfileSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  try {
    await updateTenantProfile(ctx.tenantId, parsed.data);
    revalidatePath("/app/pengaturan");
    revalidatePath("/app");
    return { ok: true };
  } catch (e) {
    if (e instanceof ServiceError) return { ok: false, error: e.message };
    return { ok: false, error: e instanceof Error ? e.message : "Gagal menyimpan" };
  }
}
