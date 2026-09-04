/**
 * Rincian dokumen keuangan (faktur/kwitansi) — PURE, no I/O, teruji.
 * Sumber angka: Payment (amount = harga setelah diskon+pajak yang DITAGIH & DITERIMA Lumite),
 * discountAmount, couponCode, dan rawNotif Midtrans (untuk fee channel bila customer-imposed).
 *
 * Prinsip akuntansi (Indonesia, non-PKP):
 * - Pendapatan Lumite = harga jual = payment.amount (yang benar-benar diterima). Kwitansi = angka ini.
 * - Biaya channel (customer_imposed_payment_fee) DIBAYAR PELANGGAN ke penyedia, DI LUAR penerimaan
 *   Lumite → hanya CATATAN KAKI informatif, TIDAK menambah total kwitansi Lumite.
 * - discount ditampilkan utk transparansi (harga normal → diskon → subtotal).
 */

export interface FinanceGrossInfo {
  originalAmount?: number;      // harga yang KITA kirim ke Midtrans (== payment.amount)
  customerImposedFee?: number;  // fee channel dibebankan ke pelanggan (bila ada)
  grossPaidByCustomer?: number; // total yang benar-benar dibayar pelanggan (amount + fee)
}

/**
 * Ekstrak info fee dari rawNotif Midtrans (metadata.extra_info.gross_amount_info).
 * Mengembalikan objek kosong bila tak ada (fee ditanggung merchant / belum bayar).
 */
export function extractGrossInfo(rawNotif: unknown): FinanceGrossInfo {
  const num = (v: unknown): number | undefined => {
    if (v === undefined || v === null || v === "") return undefined;
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? n : undefined;
  };
  try {
    const info = (rawNotif as {
      metadata?: { extra_info?: { gross_amount_info?: Record<string, unknown> } };
    })?.metadata?.extra_info?.gross_amount_info;
    if (!info) return {};
    const originalAmount = num(info.original_amount);
    const customerImposedFee = num(info.customer_imposed_payment_fee);
    const grossPaidByCustomer = num(info.gross_amount);
    return { originalAmount, customerImposedFee, grossPaidByCustomer };
  } catch {
    return {};
  }
}

export interface FinanceBreakdown {
  normalPrice: number;   // harga normal (sebelum diskon), pra-pajak
  discount: number;      // potongan kupon (pra-pajak)
  subtotal: number;      // setelah diskon, pra-pajak
  taxPercent: number;
  taxAmount: number;
  total: number;         // = payment.amount (yang ditagih & DITERIMA Lumite)
  channelFee: number;    // biaya channel dibebankan ke pelanggan (0 bila tak ada / ditanggung merchant)
  grandTotalPaid: number;// yang benar-benar dibayar pelanggan = total + channelFee
}

/**
 * Hitung rincian dokumen dari data Payment + pajak + fee.
 * @param amount      payment.amount (total ditagih & diterima Lumite; sudah termasuk pajak bila PKP)
 * @param discount    payment.discountAmount (pra-pajak)
 * @param taxPercent  pajak efektif (0 bila non-PKP)
 * @param channelFee  biaya channel dari extractGrossInfo (0 bila tak ada)
 */
export function computeFinanceBreakdown(input: {
  amount: number;
  discount: number;
  taxPercent: number;
  channelFee: number;
}): FinanceBreakdown {
  const { amount, discount, taxPercent, channelFee } = input;
  // amount = subtotal + pajak. Hitung mundur subtotal (pra-pajak) dari amount.
  const subtotal = taxPercent > 0 ? Math.round(amount / (1 + taxPercent / 100)) : amount;
  const taxAmount = amount - subtotal;
  const normalPrice = subtotal + Math.max(0, discount);
  return {
    normalPrice,
    discount: Math.max(0, discount),
    subtotal,
    taxPercent,
    taxAmount,
    total: amount,
    channelFee: Math.max(0, channelFee),
    grandTotalPaid: amount + Math.max(0, channelFee),
  };
}
