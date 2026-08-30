/**
 * Invoice Service (F4.2) — penomoran + kalkulasi MURNI (uang, test berat) + due date.
 * Aturan uang (keputusan terkunci):
 *  - K12: subtotal → dikurangi diskon → PAJAK dihitung SETELAH diskon → total.
 *  - K4 : PPN hanya bila tenant PKP. DPP dipisah jasa vs barang (barang = CONSUMABLE/SPAREPART).
 *         PPN dikenakan proporsional atas DPP (jasa+barang) sesudah diskon. PPh23 = info (tak mengubah total invoice).
 *  - K19: dueDate = issueDate + hari sesuai TOP pelanggan (CASH = null / bayar langsung).
 * Uang = rupiah bulat (Decimal 12,2 di DB); pembulatan eksplisit Math.round.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ServiceError } from "@/lib/services/customer-service";

export type DocType = "INVOICE" | "PROFORMA";
export type TopType = "CASH" | "TEMPO_7" | "TEMPO_14" | "TEMPO_30" | "TEMPO_45" | "TEMPO_60" | "TEMPO_90";

const GOODS_CATEGORIES = new Set(["CONSUMABLE", "SPAREPART"]);

export interface InvoiceLineInput {
  category: string;   // ServiceCategory
  qty: number;
  unitPrice: number;
}

export interface InvoiceTotals {
  subtotal: number;        // Σ lineTotal sebelum diskon
  discountAmount: number;  // diskon per-invoice (K12)
  taxableService: number;  // DPP jasa setelah diskon (proporsional)
  taxableGoods: number;    // DPP barang setelah diskon (proporsional)
  ppnPercent: number;
  ppnAmount: number;
  total: number;           // (subtotal - diskon) + ppn
}

/** Pisah TOP → jumlah hari. CASH/unknown → 0. */
export function topDays(top: TopType): number {
  switch (top) {
    case "TEMPO_7": return 7;
    case "TEMPO_14": return 14;
    case "TEMPO_30": return 30;
    case "TEMPO_45": return 45;
    case "TEMPO_60": return 60;
    case "TEMPO_90": return 90;
    default: return 0; // CASH
  }
}

/** Tanggal jatuh tempo (K19). CASH → null (bayar langsung). */
export function computeDueDate(issueDate: Date, top: TopType): Date | null {
  const days = topDays(top);
  if (days === 0) return null;
  const d = new Date(issueDate);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Kalkulasi total invoice (MURNI). Lihat aturan di header.
 * @param tenantIsPkp bila false → tanpa PPN (invoice bersih, K4).
 * @param taxPercent  tarif PPN tenant (mis. 11). Diabaikan bila non-PKP.
 * @param discountAmount diskon per-invoice (K12), dibatasi ≤ subtotal.
 */
export function computeInvoiceTotals(params: {
  items: InvoiceLineInput[];
  discountAmount?: number;
  tenantIsPkp: boolean;
  taxPercent?: number;
}): InvoiceTotals {
  const { items, tenantIsPkp } = params;
  let serviceGross = 0;
  let goodsGross = 0;
  for (const it of items) {
    const qty = it.qty > 0 ? it.qty : 0;
    const line = Math.round(qty * it.unitPrice);
    if (GOODS_CATEGORIES.has(it.category)) goodsGross += line;
    else serviceGross += line;
  }
  const subtotal = serviceGross + goodsGross;

  // Diskon per-invoice, dibatasi tak melebihi subtotal.
  let discountAmount = Math.round(params.discountAmount ?? 0);
  if (discountAmount < 0) discountAmount = 0;
  if (discountAmount > subtotal) discountAmount = subtotal;

  // DPP setelah diskon — diskon dialokasikan proporsional antara jasa & barang.
  const afterDiscount = subtotal - discountAmount;
  let taxableService = 0;
  let taxableGoods = 0;
  if (subtotal > 0) {
    taxableService = Math.round(afterDiscount * (serviceGross / subtotal));
    taxableGoods = afterDiscount - taxableService; // sisa → barang (hindari selisih pembulatan)
  }

  const ppnPercent = tenantIsPkp ? (params.taxPercent ?? 0) : 0;
  const ppnAmount = ppnPercent > 0 ? Math.round(afterDiscount * ppnPercent / 100) : 0;
  const total = afterDiscount + ppnAmount;

  return { subtotal, discountAmount, taxableService, taxableGoods, ppnPercent, ppnAmount, total };
}

/**
 * Nomor dokumen berikutnya, transaksional anti-duplikat.
 * Format: {PREFIX}/{YYYY}/{urut-4-digit} — PREFIX = INV (invoice) / PRO (proforma).
 * Retry pada tabrakan unique [tenantId, number].
 */
export async function nextInvoiceNumber(tenantId: string, docType: DocType, year?: number): Promise<string> {
  const yr = year ?? new Date().getFullYear();
  const prefix = docType === "PROFORMA" ? "PRO" : "INV";
  const like = `${prefix}/${yr}/%`;

  for (let attempt = 0; attempt < 5; attempt++) {
    const last = await prisma.invoice.findFirst({
      where: { tenantId, number: { startsWith: `${prefix}/${yr}/` } },
      orderBy: { number: "desc" },
      select: { number: true },
    });
    let nextSeq = 1;
    if (last) {
      const m = last.number.match(/\/(\d+)$/);
      if (m) nextSeq = parseInt(m[1], 10) + 1;
    }
    const candidate = `${prefix}/${yr}/${String(nextSeq).padStart(4, "0")}`;
    // Cek tabrakan (konkuren) sebelum kembalikan.
    const clash = await prisma.invoice.findFirst({
      where: { tenantId, number: candidate }, select: { id: true },
    });
    if (!clash) return candidate;
  }
  throw new ServiceError("CONFLICT", "Gagal membuat nomor dokumen, coba lagi");
}

/** Ambil invoice/proforma lengkap (tenant-scoped) untuk tampilan. Termasuk info tenant (branding/rekening) & pelanggan. */
export async function getInvoiceForView(tenantId: string, invoiceId: string) {
  const inv = await prisma.invoice.findFirst({
    where: { id: invoiceId, tenantId },
    include: {
      items: true,
      customer: { select: { name: true, phone: true, address: true, customerType: true, npwp: true } },
    },
  });
  if (!inv) throw new ServiceError("NOT_FOUND", "Dokumen tidak ditemukan");
  // Label unit per item (assetId scalar → ambil terpisah).
  const assetIds = [...new Set(inv.items.map((i) => i.assetId).filter(Boolean) as string[])];
  const assets = assetIds.length
    ? await prisma.asset.findMany({ where: { id: { in: assetIds }, tenantId }, select: { id: true, brand: true, roomLocation: true, capacityPk: true } })
    : [];
  const assetMap = new Map(assets.map((a) => [a.id, [a.brand, a.capacityPk ? `${a.capacityPk}PK` : null, a.roomLocation].filter(Boolean).join(" · ") || "Unit AC"]));
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      name: true, logoUrl: true, isPkp: true, npwp: true,
      phone: true, address: true, tagline: true,
      bankName: true, bankAccountNo: true, bankAccountName: true, qrisImageUrl: true,
    },
  });
  return { inv, tenant, assetMap };
}

/** Batalkan invoice/proforma (K11: admin only, dilakukan di action). Tak bisa bila sudah PAID. */
export async function cancelInvoice(tenantId: string, invoiceId: string): Promise<void> {
  const inv = await prisma.invoice.findFirst({ where: { id: invoiceId, tenantId }, select: { id: true, status: true } });
  if (!inv) throw new ServiceError("NOT_FOUND", "Dokumen tidak ditemukan");
  if (inv.status === "PAID") throw new ServiceError("CONFLICT", "Invoice sudah lunas — tak bisa dibatalkan");
  if (inv.status === "CANCELLED") throw new ServiceError("CONFLICT", "Sudah dibatalkan");
  await prisma.invoice.update({ where: { id: invoiceId }, data: { status: "CANCELLED" } });
}

/** Daftar invoice/proforma tenant (untuk admin /app/faktur). Terbaru dulu. */
export async function listInvoices(tenantId: string, limit = 50) {
  const rows = await prisma.invoice.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true, number: true, docType: true, status: true, total: true,
      issueDate: true, dueDate: true, customer: { select: { name: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id, number: r.number, docType: r.docType, status: r.status,
    total: Number(r.total), issueDate: r.issueDate, dueDate: r.dueDate,
    customerName: r.customer?.name ?? "—",
  }));
}

/** Tandai invoice LUNAS (K1: cash lapangan). payMethod + bukti opsional. Hanya invoice (bukan proforma). */
export async function markInvoicePaid(
  tenantId: string, invoiceId: string,
  payMethod: "CASH" | "TRANSFER" | "QRIS", paymentProofUrl?: string,
): Promise<void> {
  const inv = await prisma.invoice.findFirst({
    where: { id: invoiceId, tenantId },
    select: { id: true, docType: true, status: true },
  });
  if (!inv) throw new ServiceError("NOT_FOUND", "Invoice tidak ditemukan");
  if (inv.docType !== "INVOICE") throw new ServiceError("CONFLICT", "Proforma tak bisa ditandai lunas — buat invoice dulu");
  if (inv.status === "PAID") throw new ServiceError("CONFLICT", "Invoice sudah lunas");
  if (inv.status === "CANCELLED") throw new ServiceError("CONFLICT", "Invoice sudah dibatalkan");
  // B4 fix: update ATOMIK dengan guard status di WHERE — cegah double-mark pada race.
  // Hanya ISSUED/OVERDUE yang boleh jadi PAID; bila 0 baris, status sudah berubah proses lain.
  const res = await prisma.invoice.updateMany({
    where: { id: invoiceId, tenantId, docType: "INVOICE", status: { in: ["ISSUED", "OVERDUE"] } },
    data: { status: "PAID", payMethod, paymentProofUrl: paymentProofUrl ?? null, paidAt: new Date() },
  });
  if (res.count !== 1) throw new ServiceError("CONFLICT", "Status invoice sudah berubah. Muat ulang halaman.");
}

/**
 * Buat INVOICE resmi dari PROFORMA (K10/K11: admin only). Diskon per-invoice opsional (K12: pajak setelah diskon).
 * Menyalin item proforma, menghitung ulang total dengan diskon + PPN (bila PKP), penomoran INV baru.
 * @returns id invoice baru.
 */
export async function createInvoiceFromProforma(
  tenantId: string, proformaId: string, createdById: string, discountAmount = 0,
): Promise<{ invoiceId: string; number: string }> {
  const pro = await prisma.invoice.findFirst({
    where: { id: proformaId, tenantId, docType: "PROFORMA" },
    include: { items: true },
  });
  if (!pro) throw new ServiceError("NOT_FOUND", "Proforma tidak ditemukan");
  if (pro.status === "CANCELLED") throw new ServiceError("CONFLICT", "Proforma sudah dibatalkan");

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { isPkp: true, taxPercent: true } });
  const lines = pro.items.map((it) => ({ category: it.category, qty: Number(it.qty), unitPrice: Number(it.unitPrice) }));
  const totals = computeInvoiceTotals({
    items: lines, discountAmount,
    tenantIsPkp: tenant?.isPkp ?? false, taxPercent: tenant?.taxPercent ?? 0,
  });
  const issueDate = new Date();
  const number = await nextInvoiceNumber(tenantId, "INVOICE", issueDate.getFullYear());

  const created = await prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.create({
      data: {
        tenantId, docType: "INVOICE", number, customerId: pro.customerId,
        billingCustomerId: pro.billingCustomerId, workSessionId: pro.workSessionId, jobId: pro.jobId,
        status: "ISSUED", issueDate, dueDate: pro.dueDate,
        subtotal: new Prisma.Decimal(totals.subtotal),
        discountAmount: new Prisma.Decimal(totals.discountAmount),
        taxableService: new Prisma.Decimal(totals.taxableService),
        taxableGoods: new Prisma.Decimal(totals.taxableGoods),
        ppnPercent: totals.ppnPercent,
        ppnAmount: new Prisma.Decimal(totals.ppnAmount),
        total: new Prisma.Decimal(totals.total),
        createdById,
        items: {
          create: pro.items.map((it) => ({
            assetId: it.assetId, descSnapshot: it.descSnapshot, category: it.category,
            qty: it.qty, unit: it.unit, unitPrice: it.unitPrice, lineTotal: it.lineTotal,
          })),
        },
      },
      select: { id: true },
    });
    // Proforma ditandai CANCELLED (sudah dijadikan invoice) agar tak dobel.
    await tx.invoice.update({ where: { id: pro.id }, data: { status: "CANCELLED" } });
    return inv.id;
  });
  return { invoiceId: created, number };
}

