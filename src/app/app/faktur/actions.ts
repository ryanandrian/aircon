"use server";

import { getServerContext } from "@/lib/auth/context";
import { assertRole } from "@/lib/auth/guard";
import {
  listInvoicesByBucket,
  countInvoicesByBucket,
  sendInvoiceViaWa,
  sendReceiptViaWa,
  verifyInvoicePayment,
  type InvoiceBucket,
} from "@/lib/services/invoice-service";

export type InvoiceListItem = {
  id: string; number: string; docType: string; status: string;
  total: number; issueDate: string | null; dueDate: string | null; customerName: string;
  // L6 (K1/K3/K4): kolom posisi uang utk label dari satu sumber (money-position.ts).
  // M7/K13: `remittedAt` ikut dipilih agar tunai disetor TANPA jejak diberi label jujur.
  payMethod: string | null; cashRemitStatus: string | null; verifiedAt: Date | null;
  remittedAt: Date | null;
};

function toMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

/** Load dokumen per tab (proforma/unpaid/paid/all) + pencarian + cursor. */
export async function actionLoadInvoices(
  bucket: InvoiceBucket,
  opts: { search?: string; cursor?: string } = {},
): Promise<{ ok: true; items: InvoiceListItem[]; nextCursor: string | null } | { ok: false; error: string }> {
  try {
    const ctx = await getServerContext();
    assertRole(ctx.role, ["OWNER", "ADMIN"]);
    const { items, nextCursor } = await listInvoicesByBucket(ctx.tenantId, bucket, {
      search: opts.search, cursor: opts.cursor,
    });
    return { ok: true, items, nextCursor };
  } catch (err) {
    return { ok: false, error: toMessage(err, "Gagal memuat dokumen.") };
  }
}

/** Hitungan dokumen per tab (badge, ikut pencarian). */
export async function actionCountInvoices(
  search?: string,
): Promise<{ ok: true; counts: { proforma: number; unpaid: number; paid: number; all: number } } | { ok: false; error: string }> {
  try {
    const ctx = await getServerContext();
    assertRole(ctx.role, ["OWNER", "ADMIN"]);
    const counts = await countInvoicesByBucket(ctx.tenantId, search);
    return { ok: true, counts };
  } catch (err) {
    return { ok: false, error: toMessage(err, "Gagal menghitung dokumen.") };
  }
}

/** Kirim dokumen (proforma/invoice) via WA gateway ke kontak penagihan (admin).
 *  F3: bila plan-locked (TRIAL/BASIC) → waMe fallback (aplikasi WA milik pengirim)
 *  dikirim balik ke UI utk tombol "Buka WhatsApp" — gateway TIDAK dipanggil. */
export async function actionSendInvoiceWa(
  invoiceId: string,
): Promise<{ ok: true; to?: string } | { ok: false; error: string; waMe?: { url: string; message: string } }> {
  try {
    const ctx = await getServerContext();
    assertRole(ctx.role, ["OWNER", "ADMIN"]);
    const res = await sendInvoiceViaWa(ctx.tenantId, invoiceId);
    if (!res.ok) return { ok: false, error: res.error ?? "Gagal mengirim WA", waMe: res.waMe };
    return { ok: true, to: res.to };
  } catch (err) {
    return { ok: false, error: toMessage(err, "Gagal mengirim WA.") };
  }
}

/** Kirim KWITANSI (invoice LUNAS) via WA gateway (admin). Fallback wa.me utk TRIAL. */
export async function actionSendReceiptWa(
  invoiceId: string,
): Promise<{ ok: true; to?: string } | { ok: false; error: string; waMe?: { url: string; message: string } }> {
  try {
    const ctx = await getServerContext();
    assertRole(ctx.role, ["OWNER", "ADMIN"]);
    const res = await sendReceiptViaWa(ctx.tenantId, invoiceId);
    if (!res.ok) return { ok: false, error: res.error ?? "Gagal mengirim WA", waMe: res.waMe };
    return { ok: true, to: res.to };
  } catch (err) {
    return { ok: false, error: toMessage(err, "Gagal mengirim WA.") };
  }
}

/** Verifikasi dana transfer/QRIS masuk rekening (L3 / K4). Owner/admin tenant.
 *  Menandai lunas oleh ADMIN/OWNER sendiri sudah otomatis terverifikasi — aksi ini
 *  dipakai bila yang menandai lunas adalah teknisi di lapangan. */
export async function actionVerifyPayment(
  invoiceId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const ctx = await getServerContext();
    assertRole(ctx.role, ["OWNER", "ADMIN"]);
    await verifyInvoicePayment(ctx.tenantId, invoiceId, ctx.userId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: toMessage(err, "Gagal memverifikasi pembayaran") };
  }
}
