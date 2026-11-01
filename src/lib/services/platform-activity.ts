/**
 * Klasifikasi aktivitas usaha tenant — PURE, tanpa akses database.
 *
 * SSOT angka: query di `platform-activity-service.ts` (count per tenant).
 * Modul ini hanya mengubah angka → label/warna/ringkasan teks agar konsisten
 * di seluruh halaman Admin Platform.
 */

export type ActivityLevel = "JOBS" | "OTHER" | "NONE";

export interface ActivityInput {
  /** Jumlah pekerjaan dibuat dalam periode. */
  jobs: number;
  /** Jumlah pekerjaan selesai dalam periode. */
  jobsCompleted: number;
  /** Jumlah pelanggan baru dalam periode. */
  customers: number;
  /** Jumlah invoice terbit dalam periode. */
  invoices: number;
}

/**
 * Klasifikasi deskriptif tanpa ambang buatan:
 * - JOBS  → ada pekerjaan dibuat pada periode.
 * - OTHER → tak ada pekerjaan, tetapi ada pelanggan/invoice/penyelesaian.
 * - NONE  → tidak ada sinyal aktivitas terpilih yang tercatat pada periode.
 *
 * Catatan: agregat `jobsCompleted` adalah metrik periode penyelesaian, tetapi
 * level memakai `jobs` (pekerjaan dibuat) + customer/invoice; ini hanya label
 * ringkasan data, bukan penilaian kinerja tenant.
 */
export function activityLevel(input: ActivityInput): ActivityLevel {
  if (input.jobs > 0) return "JOBS";
  if (input.jobsCompleted > 0 || input.customers > 0 || input.invoices > 0) return "OTHER";
  return "NONE";
}

/** Label deskriptif yang tidak menyiratkan ambang kinerja. */
export function activityLabel(level: ActivityLevel): string {
  switch (level) {
    case "JOBS":
      return "Ada pekerjaan";
    case "OTHER":
      return "Aktivitas lain";
    default:
      return "Belum tercatat";
  }
}

/** Ringkasan singkat aktivitas (untuk tabel). */
export function activitySummary(input: ActivityInput): string {
  const parts: string[] = [];
  if (input.jobs > 0) parts.push(`${input.jobs} pekerjaan dibuat`);
  if (input.jobsCompleted > 0) parts.push(`${input.jobsCompleted} selesai`);
  if (input.customers > 0) parts.push(`${input.customers} pelanggan baru`);
  if (input.invoices > 0) parts.push(`${input.invoices} invoice terbit`);
  return parts.length > 0 ? parts.join(" · ") : "Tidak ada sinyal aktivitas tercatat";
}
