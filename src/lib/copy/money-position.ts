/**
 * Label & warna POSISI UANG invoice (L6 — keputusan K1/K3/K4, 2026-10-18).
 *
 * MENGAPA satu berkas: sebelumnya label "Lunas" berdiri sendiri tanpa menjelaskan
 * posisi uangnya, dan tiap halaman menyusun labelnya sendiri (F-11/RC-5.3) —
 * berisiko dua halaman memberi label berbeda untuk keadaan yang sama. Sumber label
 * posisi uang kini HANYA di sini (pola sama dengan `copy/job-status.ts`).
 *
 * Bahasa awam (aplikasi ini untuk teknisi & usaha kecil):
 *  - CASH      : uang ditangan teknisi, belum disetor / sudah disetor
 *  - TRANSFER  : menunggu dicek kantor / sudah dicek masuk rekening
 *  - QRIS      : sama seperti transfer
 */

export type MoneyPositionKey =
  | "CASH_HELD"        // tunai lunas, belum disetor ke kantor
  | "CASH_REMITTED"    // tunai sudah disetor + jejak bukti lengkap
  | "CASH_REMITTED_NO_TRACE" // tunai ditandai disetor TANPA jejak bukti (M7/K13, data lama)
  | "TRANSFER_UNVERIFIED"
  | "TRANSFER_VERIFIED"
  | "QRIS_UNVERIFIED"
  | "QRIS_VERIFIED"
  | "UNKNOWN";         // lunas tanpa metode (belum jelas — tidak diklaim apa pun)

export interface MoneyPosition {
  key: MoneyPositionKey;
  /** Kalimat pendek untuk badge/daftar. */
  label: string;
  /** Penjelasan satu baris untuk tempat yang punya ruang. */
  hint: string;
  /** Kelas warna (pola kelas eksplisit seperti copy/job-status.ts). */
  color: string;
}

export const MONEY_POSITION: Record<MoneyPositionKey, MoneyPosition> = {
  CASH_HELD: {
    key: "CASH_HELD",
    label: "Tunai — di teknisi",
    hint: "Uang tunai ada di tangan teknisi, belum disetor ke kantor.",
    color: "bg-amber-100 text-amber-700",
  },
  CASH_REMITTED: {
    key: "CASH_REMITTED",
    label: "Tunai — sudah disetor",
    hint: "Uang tunai sudah disetor ke kantor dan tercatat.",
    color: "bg-emerald-100 text-emerald-700",
  },
  CASH_REMITTED_NO_TRACE: {
    key: "CASH_REMITTED_NO_TRACE",
    label: "Tunai — disetor, bukti belum lengkap",
    hint: "Status sudah disetor, tetapi jejak buktinya belum ada (data setoran lama). Uang tetap tampil agar tidak hilang dari laporan.",
    color: "bg-amber-100 text-amber-700",
  },
  TRANSFER_UNVERIFIED: {
    key: "TRANSFER_UNVERIFIED",
    label: "Transfer — menunggu dicek",
    hint: "Belum dipastikan dananya masuk rekening. Cek dulu di rekening usaha.",
    color: "bg-amber-100 text-amber-700",
  },
  TRANSFER_VERIFIED: {
    key: "TRANSFER_VERIFIED",
    label: "Transfer — sudah masuk",
    hint: "Sudah dipastikan dananya masuk ke rekening usaha.",
    color: "bg-emerald-100 text-emerald-700",
  },
  QRIS_UNVERIFIED: {
    key: "QRIS_UNVERIFIED",
    label: "QRIS — menunggu dicek",
    hint: "Belum dipastikan dananya masuk. Cek dulu di rekening usaha.",
    color: "bg-amber-100 text-amber-700",
  },
  QRIS_VERIFIED: {
    key: "QRIS_VERIFIED",
    label: "QRIS — sudah masuk",
    hint: "Sudah dipastikan dananya masuk ke rekening usaha.",
    color: "bg-emerald-100 text-emerald-700",
  },
  UNKNOWN: {
    key: "UNKNOWN",
    label: "Lunas — posisi belum jelas",
    hint: "Lunas tanpa metode pembayaran tercatat; posisi uang belum bisa dipastikan.",
    color: "bg-slate-100 text-slate-600",
  },
};

/**
 * Tentukan posisi uang dari kolom invoice. HANYA berlaku untuk invoice LUNAS;
 * pemanggil wajib memastikan statusnya PAID (invoice belum lunas bukan "posisi uang").
 *
 * M7/K13 (2026-10-18): tunai REMITTED TANPA `remittedAt` (data setoran lama, jejak
 * belum ada) dibedakan dari tunai REMITTED berjejak lengkap — status "sudah disetor"
 * saja tidak cukup untuk mengklaim uangnya sudah di kantor dengan bukti.
 */
export function moneyPositionOf(inv: {
  payMethod: string | null;
  cashRemitStatus: string | null;
  verifiedAt: Date | null;
  /** Waktu setoran (jejak L2) — null = setoran lama tanpa jejak (M7/K13). */
  remittedAt?: Date | null;
}): MoneyPosition {
  if (inv.payMethod === "CASH") {
    if (inv.cashRemitStatus !== "REMITTED") return MONEY_POSITION.CASH_HELD;
    return inv.remittedAt ? MONEY_POSITION.CASH_REMITTED : MONEY_POSITION.CASH_REMITTED_NO_TRACE;
  }
  if (inv.payMethod === "TRANSFER") {
    return inv.verifiedAt ? MONEY_POSITION.TRANSFER_VERIFIED : MONEY_POSITION.TRANSFER_UNVERIFIED;
  }
  if (inv.payMethod === "QRIS") {
    return inv.verifiedAt ? MONEY_POSITION.QRIS_VERIFIED : MONEY_POSITION.QRIS_UNVERIFIED;
  }
  return MONEY_POSITION.UNKNOWN;
}
