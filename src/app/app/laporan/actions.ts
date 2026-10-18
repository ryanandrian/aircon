"use server";

import { revalidatePath } from "next/cache";
import { getServerContext } from "@/lib/auth/context";
import { markCashRemitted } from "@/lib/services/ar-service";
import { putTenantAsset } from "@/lib/storage/s3";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
const msg = (e: unknown, fb: string) => (e instanceof Error ? e.message : fb);

/**
 * Unggah FOTO BUKTI SETORAN (K5) — lewat server agar tidak ada CORS browser→S3.
 * Memakai jalur unggah yang sudah dipakai aplikasi (putTenantAsset, scope "bukti"),
 * sama seperti bukti bayar & logo/QRIS tenant. Tenant-scoped di level path S3.
 */
export async function actionUploadRemitProof(fd: FormData): Promise<Result<{ publicUrl: string }>> {
  try {
    const ctx = await getServerContext();
    if (ctx.role !== "OWNER" && ctx.role !== "ADMIN") {
      return { ok: false, error: "Hanya admin/pemilik yang boleh mengunggah bukti setoran." };
    }
    const file = fd.get("file");
    if (!(file instanceof File)) return { ok: false, error: "File tidak ditemukan" };
    const ct = file.type || "image/jpeg";
    if (!/^image\/(jpeg|png|webp)$/.test(ct)) return { ok: false, error: "File harus JPG, PNG, atau WebP" };
    if (file.size > 8 * 1024 * 1024) return { ok: false, error: "Ukuran maksimal 8 MB" };
    const body = Buffer.from(await file.arrayBuffer());
    const r = await putTenantAsset({ tenantId: ctx.tenantId, scope: "bukti", filename: file.name, contentType: ct, body });
    return { ok: true, data: { publicUrl: r.publicUrl } };
  } catch (e) {
    return { ok: false, error: msg(e, "Gagal mengunggah bukti setoran") };
  }
}

/**
 * Tandai setoran kas teknisi (K17 + L2/K5). Owner/admin only.
 * Setoran WAJIB berbukti (foto di S3) dan WAJIB mencatat admin penerima — ditegakkan
 * di service (`markCashRemitted`), bukan hanya di layar.
 *
 * K14: `mode = "legacy"` dipakai untuk melengkapi jejak setoran LAMA (baris REMITTED
 * yang jejaknya kosong) — ditegakkan penuh di service, jadi klien tidak bisa menyentuh
 * baris yang bukan milik mode itu.
 */
export async function actionMarkCashRemitted(
  invoiceIds: string[],
  proofUrl: string,
  mode: "held" | "legacy" = "held",
): Promise<Result<{ count: number }>> {
  try {
    const ctx = await getServerContext();
    if (ctx.role !== "OWNER" && ctx.role !== "ADMIN") {
      return { ok: false, error: "Hanya admin/pemilik yang boleh mencatat setoran." };
    }
    // Penerima setoran = admin/pemilik yang sedang menekan tombol (dari sesi, bukan input klien).
    const count = await markCashRemitted(ctx.tenantId, invoiceIds, {
      receiverId: ctx.userId,
      proofUrl,
    }, mode);
    revalidatePath("/app/laporan");
    return { ok: true, data: { count } };
  } catch (e) {
    return { ok: false, error: msg(e, "Gagal mencatat setoran") };
  }
}
