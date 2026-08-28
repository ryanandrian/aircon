"use server";

import { revalidatePath } from "next/cache";
import { getServerContext } from "@/lib/auth/context";
import { markInvoicePaid, createInvoiceFromProforma, cancelInvoice } from "@/lib/services/invoice-service";
import { createTenantAssetUploadUrl } from "@/lib/storage/s3";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
const msg = (e: unknown, fb: string) => (e instanceof Error ? e.message : fb);

/** Presign upload bukti bayar (tenant-scoped). */
export async function actionPresignPaymentProof(filename: string, contentType: string): Promise<Result<{ uploadUrl: string; publicUrl: string }>> {
  try {
    const ctx = await getServerContext();
    const r = await createTenantAssetUploadUrl({ tenantId: ctx.tenantId, scope: "bukti", filename, contentType });
    return { ok: true, data: { uploadUrl: r.uploadUrl, publicUrl: r.publicUrl } };
  } catch (e) {
    return { ok: false, error: msg(e, "Gagal menyiapkan upload") };
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
