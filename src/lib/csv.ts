/**
 * Helper CSV — SATU SUMBER untuk seluruh ekspor CSV aplikasi (L10/K16c).
 * Sebelumnya helper ini menduplikasi di `service-catalog-service.ts` — dipindah ke
 * sini agar setiap ekspor baru (penerimaan, dsb.) memakai aturan escaping yang sama
 * dan tidak ada definisi ganda yang bisa berbeda jalur (anti-fosil/aturan 12).
 */

/** Sembung satu sel CSV: koma, tanda kutip, atau baris baru → dikutip;
 *  kutip di dalam kutip digandakan sesuai RFC 4180. */
export function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Satu baris CSV (sel → join koma). */
export function csvRow(cells: (string | number)[]): string {
  return cells.map(csvCell).join(",");
}
