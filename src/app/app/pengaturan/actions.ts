"use server";

import { revalidatePath } from "next/cache";
import { tryGetServerContext } from "@/lib/auth/context";
import { tenantProfileSchema } from "@/lib/validation/tenant-profile";
import { updateTenantProfile } from "@/lib/services/tenant-profile-service";
import { putTenantAsset } from "@/lib/storage/s3";
import { ServiceError } from "@/lib/services/customer-service";
import { gatewayInitSession, gatewaySessionStatus, gatewayLogoutSession } from "@/lib/wa/gateway-relay";

type Result = { ok: boolean; error?: string };

/** Hanya owner/admin tenant yang boleh ubah profil usaha. */
function canManage(role: string): boolean {
  return role === "OWNER" || role === "ADMIN";
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
  incentiveEnabled?: boolean;
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

/** Tautkan WhatsApp: mulai/bangunkan sesi tenant → balikkan QR (data URL) atau ready. */
export async function actionWaInit(): Promise<{ ok: boolean; qr?: string | null; ready?: boolean; error?: string }> {
  const ctx = await tryGetServerContext();
  if (!ctx?.tenantId) return { ok: false, error: "Sesi tidak valid" };
  if (!canManage(ctx.role)) return { ok: false, error: "Tidak berwenang" };
  return gatewayInitSession(ctx.tenantId);
}

/** Status sesi WA tenant (untuk polling di UI): {exists, ready, qr}. */
export async function actionWaStatus(): Promise<{ ok: boolean; exists?: boolean; ready?: boolean; qr?: string | null; error?: string }> {
  const ctx = await tryGetServerContext();
  if (!ctx?.tenantId) return { ok: false, error: "Sesi tidak valid" };
  if (!canManage(ctx.role)) return { ok: false, error: "Tidak berwenang" };
  return gatewaySessionStatus(ctx.tenantId);
}

/** Putuskan sesi WA tenant (logout dari perangkat gateway). */
export async function actionWaLogout(): Promise<Result> {
  const ctx = await tryGetServerContext();
  if (!ctx?.tenantId) return { ok: false, error: "Sesi tidak valid" };
  if (!canManage(ctx.role)) return { ok: false, error: "Tidak berwenang" };
  return gatewayLogoutSession(ctx.tenantId);
}
