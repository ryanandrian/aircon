"use server";

import { revalidatePath } from "next/cache";
import { getServerContext } from "@/lib/auth/context";
import { markInvoicePaid, createInvoiceFromProforma, cancelInvoice } from "@/lib/services/invoice-service";
import { putTenantAsset } from "@/lib/storage/s3";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
const msg = (e: unknown, fb: string) => (e instanceof Error ? e.message : fb);

/**
 * Upload bukti bayar LEWAT SERVER (hindari CORS browser→S3). Terima File via FormData.
 * SECURITY: tenant-scoped; contentType di-whitelist di putTenantAsset.
 */
export async function actionUploadPaymentProof(fd: FormData): Promise<Result<{ publicUrl: string }>> {
  try {
    const ctx = await getServerContext();
    const file = fd.get("file");
    if (!(file instanceof File)) return { ok: false, error: "File tidak ditemukan" };
    const ct = file.type || "image/jpeg";
    if (!/^image\/(jpeg|png|webp)$/.test(ct)) return { ok: false, error: "File harus JPG, PNG, atau WebP" };
    if (file.size > 8 * 1024 * 1024) return { ok: false, error: "Ukuran maksimal 8 MB" };
    const body = Buffer.from(await file.arrayBuffer());
    const r = await putTenantAsset({ tenantId: ctx.tenantId, scope: "bukti", filename: file.name, contentType: ct, body });
    return { ok: true, data: { publicUrl: r.publicUrl } };
  } catch (e) {
    return { ok: false, error: msg(e, "Gagal mengunggah bukti bayar") };
  }
}

/** Tandai invoice lunas (cash lapangan). Teknisi/owner/admin boleh. */
export async function actionMarkPaid(
  invoiceId: string, payMethod: "CASH" | "TRANSFER" | "QRIS", paymentProofUrl?: string,
): Promise<Result> {
  try {
    const ctx = await getServerContext();
    await markInvoicePaid(ctx.tenantId, invoiceId, payMethod, paymentProofUrl);
    revalidatePath(`/t/faktur/${invoiceId}`);
    revalidatePath(`/app/faktur/${invoiceId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: msg(e, "Gagal menandai lunas") };
  }
}

/** Buat invoice dari proforma (K11: admin only). */
export async function actionInvoiceFromProforma(
  proformaId: string, discountAmount: number,
): Promise<Result<{ invoiceId: string; number: string }>> {
  try {
    const ctx = await getServerContext();
    if (ctx.role !== "OWNER" && ctx.role !== "ADMIN") {
      return { ok: false, error: "Hanya admin/pemilik yang boleh membuat invoice dari proforma." };
    }
    const r = await createInvoiceFromProforma(ctx.tenantId, proformaId, ctx.userId, discountAmount);
    revalidatePath(`/app/faktur/${proformaId}`);
    return { ok: true, data: r };
  } catch (e) {
    return { ok: false, error: msg(e, "Gagal membuat invoice") };
  }
}

/** Batalkan invoice/proforma (K11: admin only). */
export async function actionCancelInvoice(invoiceId: string): Promise<Result> {
  try {
    const ctx = await getServerContext();
    if (ctx.role !== "OWNER" && ctx.role !== "ADMIN") {
      return { ok: false, error: "Hanya admin/pemilik yang boleh membatalkan dokumen." };
    }
    await cancelInvoice(ctx.tenantId, invoiceId);
    revalidatePath(`/app/faktur/${invoiceId}`);
    revalidatePath("/app/faktur");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: msg(e, "Gagal membatalkan") };
  }
}
