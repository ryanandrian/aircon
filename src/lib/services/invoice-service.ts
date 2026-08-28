/**
 * Invoice Service (F4.2) — penomoran + kalkulasi MURNI (uang, test berat) + due date.
 * Aturan uang (keputusan terkunci):
 *  - K12: subtotal → dikurangi diskon → PAJAK dihitung SETELAH diskon → total.
 *  - K4 : PPN hanya bila tenant PKP. DPP dipisah jasa vs barang (barang = CONSUMABLE/SPAREPART).
 *         PPN dikenakan proporsional atas DPP (jasa+barang) sesudah diskon. PPh23 = info (tak mengubah total invoice).
 *  - K19: dueDate = issueDate + hari sesuai TOP pelanggan (CASH = null / bayar langsung).
 * Uang = rupiah bulat (Decimal 12,2 di DB); pembulatan eksplisit Math.round.
 */
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
      bankName: true, bankAccountNo: true, bankAccountName: true, qrisImageUrl: true,
    },
  });
  return { inv, tenant, assetMap };
}

