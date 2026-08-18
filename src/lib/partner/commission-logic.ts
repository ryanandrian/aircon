/**
 * Commission logic — fungsi MURNI (tanpa DB), teruji. INTI "rupiah persis" program keagenan.
 * Adaptasi dari mesinviral partner.py + SPEC §2.1-§2.2, §5g.5.
 *
 * Aturan terkunci:
 *  - Basis persen = rupiah BENAR-BENAR masuk (settlement/net), bukan harga pajangan (§2.2).
 *  - Flat_idr × months_paid: bayar tahunan (12 bln) = 12× komisi flat (§2.1).
 *  - Persen otomatis adil (mengikuti rupiah masuk × months implisit di gross).
 *  - Pembulatan ke rupiah penuh terdekat per baris (§5g.5).
 */

export type CommissionType = "FLAT_IDR" | "PERCENT";

/**
 * Hitung komisi agen (rupiah) dari satu pembayaran settlement.
 * @param grossIdr  rupiah settlement yang benar-benar diterima (net setelah diskon)
 * @param monthsPaid jumlah bulan-langganan yang dibayar (bulanan=1, tahunan=12)
 * @param rateType  FLAT_IDR (rupiah/bulan) atau PERCENT (% dari gross)
 * @param rateValue nilai sesuai tipe
 */
export function computeCommission(
  grossIdr: number,
  monthsPaid: number,
  rateType: CommissionType,
  rateValue: number,
): number {
  if (grossIdr <= 0 || monthsPaid <= 0 || rateValue <= 0) return 0;
  if (rateType === "FLAT_IDR") {
    // Flat per bulan-langganan × jumlah bulan yang dibayar.
    return Math.round(rateValue * monthsPaid);
  }
  // PERCENT: persen dari rupiah yang benar-benar masuk (gross sudah mencakup months).
  return Math.round((grossIdr * rateValue) / 100);
}

/**
 * Prefill potongan PPh atas komisi agen berdasarkan status pajak (SPEC §6b).
 * WAJIB validasi konsultan pajak sebelum pencairan pertama; nilai ini = prefill,
 * boleh dikoreksi admin. Basis = bruto komisi.
 */
export type PartnerTaxStatus = "BADAN_NPWP" | "BADAN_NON_NPWP" | "PERORANGAN" | "PKP";

export function taxWithholdingPercent(status: PartnerTaxStatus): number {
  switch (status) {
    case "BADAN_NPWP": return 2;     // PPh 23 jasa (ber-NPWP)
    case "BADAN_NON_NPWP": return 4; // PPh 23 tanpa NPWP (2x)
    case "PERORANGAN": return 2.5;   // PPh 21 bukan-pegawai (lapisan awal efektif)
    case "PKP": return 2;            // PPh 23; PPN via faktur agen (bukan potongan)
    default: return 0;
  }
}

/** Potongan PPh (rupiah, dibulatkan) dari bruto komisi. */
export function computeTaxWithholding(grossCommissionIdr: number, status: PartnerTaxStatus): number {
  if (grossCommissionIdr <= 0) return 0;
  return Math.round((grossCommissionIdr * taxWithholdingPercent(status)) / 100);
}

/** Bersih dibayar ke agen = bruto − potongan refund menggantung − PPh. */
export function netPayout(grossCommissionIdr: number, deductionIdr: number, taxWithheldIdr: number): number {
  return Math.max(0, grossCommissionIdr - deductionIdr - taxWithheldIdr);
}

/** Validasi format kode partner (unik-global): A-Z0-9, 4-12 char, disimpan UPPERCASE. */
export function normalizeCode(raw: string): string | null {
  const code = raw.trim().toUpperCase();
  return /^[A-Z0-9]{4,12}$/.test(code) ? code : null;
}
