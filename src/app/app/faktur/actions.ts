"use server";

import { getServerContext } from "@/lib/auth/context";
import { assertRole } from "@/lib/auth/guard";
import {
  listInvoicesByBucket,
  countInvoicesByBucket,
  sendInvoiceViaWa,
  sendReceiptViaWa,
  type InvoiceBucket,
} from "@/lib/services/invoice-service";

export type InvoiceListItem = {
  id: string; number: string; docType: string; status: string;
  total: number; issueDate: string | null; dueDate: string | null; customerName: string;
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

/** Kirim dokumen (proforma/invoice) via WA gateway ke kontak penagihan (admin). */
export async function actionSendInvoiceWa(
  invoiceId: string,
): Promise<{ ok: true; to?: string } | { ok: false; error: string }> {
  try {
    const ctx = await getServerContext();
    assertRole(ctx.role, ["OWNER", "ADMIN"]);
    const res = await sendInvoiceViaWa(ctx.tenantId, invoiceId);
    if (!res.ok) return { ok: false, error: res.error ?? "Gagal mengirim WA" };
    return { ok: true, to: res.to };
  } catch (err) {
    return { ok: false, error: toMessage(err, "Gagal mengirim WA.") };
  }
}

/** Kirim KWITANSI (invoice LUNAS) via WA gateway (admin). */
export async function actionSendReceiptWa(
  invoiceId: string,
): Promise<{ ok: true; to?: string } | { ok: false; error: string }> {
  try {
    const ctx = await getServerContext();
    assertRole(ctx.role, ["OWNER", "ADMIN"]);
    const res = await sendReceiptViaWa(ctx.tenantId, invoiceId);
    if (!res.ok) return { ok: false, error: res.error ?? "Gagal mengirim WA" };
    return { ok: true, to: res.to };
  } catch (err) {
    return { ok: false, error: toMessage(err, "Gagal mengirim WA.") };
  }
}
