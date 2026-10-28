/**
 * Dunning (penagihan) — fungsi MURNI, tanpa DB. Aman diuji unit.
 * Aturan durasi/jadwal berasal dari BillingPolicy (DB), diteruskan sebagai argumen.
 */

import { dayDifferenceInZone, dayKeyInZone } from "@/lib/domain/tenant-timezone";

/**
 * Hari keterlambatan = SELISIH HARI KALENDER di zona tenant (bukan durasi 24 jam).
 *
 * Bukti live (28 Okt 2026): tenant Jaya Mandiri jatuh tempo 18 Okt 07:39 WIB.
 * Cron 19 Okt 01:00 WIB → hitungan 24 jam memberi 0 (hanya 17j21m terlalu),
 * padahal secara kalender sudah 1 hari telat. Akibatnya seluruh milestone
 * dunning bergeser satu hari (G22). Sekarang: bandingan tanggal lokal, sesuai
 * zona tenant (semua tenant saat ini WIB).
 *
 * `tz` opsional → zona tenant; kosong/tak dikenal → WIB (tenant-timezone).
 */
export function daysLate(nextDueDate: Date | null, now: Date = new Date(), tz?: string | null): number {
  if (!nextDueDate) return 0;
  return Math.max(0, dayDifferenceInZone(nextDueDate, now, tz));
}

export type DunningAction = "none" | "suspend" | "delete";

/**
 * Ambang purge: tenant hanya boleh DIHAPUS bila sudah ditandai
 * (markedForDeletionAt) lebih lama dari `graceHours`. Mengembalikan batas waktu;
 * purge = markedForDeletionAt < threshold. Mencegah mark+purge di run yang sama.
 */
export function purgeThreshold(now: Date, graceHours: number): Date {
  return new Date(now.getTime() - graceHours * 3_600_000);
}

/**
 * Apakah tenant boleh dihapus permanen: sudah ditandai & tandanya lebih tua
 * dari masa tenggang purge.
 */
export function isPurgeEligible(
  markedForDeletionAt: Date | null,
  now: Date,
  graceHours: number,
): boolean {
  if (!markedForDeletionAt) return false;
  return markedForDeletionAt.getTime() < purgeThreshold(now, graceHours).getTime();
}

/**
 * Tentukan aksi berdasarkan hari telat + kebijakan.
 * - telat > daysBeforeDelete  -> delete (mark)
 * - telat > graceDaysBeforeSuspend -> suspend
 * - selain itu -> none
 */
export function dunningAction(
  late: number,
  policy: { graceDaysBeforeSuspend: number; daysBeforeDelete: number },
): DunningAction {
  if (late > policy.daysBeforeDelete) return "delete";
  if (late > policy.graceDaysBeforeSuspend) return "suspend";
  return "none";
}

/**
 * Apakah reminder harus dikirim hari ini.
 * - late harus termasuk dalam daftar hari reminder (csv, mis "0,1,3")
 * - belum ada reminder yang dikirim pada hari kalender yang sama (maks 1x/hari)
 */
export function shouldSendReminderToday(
  late: number,
  reminderDaysCsv: string,
  lastReminderAt: Date | null,
  now: Date = new Date(),
  tz?: string | null,
): boolean {
  const days = reminderDaysCsv
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n >= 0);
  if (!days.includes(late)) return false;
  if (lastReminderAt) {
    // "Hari yang sama" menurut kalender ZONA TENANT (bukan zona server/UTC).
    if (dayKeyInZone(lastReminderAt, tz) === dayKeyInZone(now, tz)) return false;
  }
  return true;
}

/**
 * Reconcile peringatan penghapusan dengan purge nyata (F2 / GAP §3.5).
 *
 * FAKTA (dibaca dari kode + cron systemd harian 01:00, bukan asumsi):
 *  1. `runDunningCycle` menandai hapus saat `late > daysBeforeDelete`, dan
 *     `late = floor((now-due)/24h)` → mark terjadi paling cepat pada
 *     `due + (N+1) hari`.
 *  2. `purgeMarkedTenants` menghapus bila `markedForDeletionAt < now - graceHours`
 *    (bandingkan KETAT) — nilai sama tidak lolos.
 *  3. Cron harian → butuh 2 run setelah mark (kumulatif ≤ 2×24 jam) sebelum
 *     syarat itu terpenuhi. graceHours=24 → purge ≥ due + N + 3 hari.
 *
 * Nilai = sisa ke arah PALING KONSERVATIF (purge paling cepat): memperingatkan
 * sedikit lebih awal aman; terlambat = data hilang lebih dulu.
 * `deleteWarningDay=30` live memakai jalur ini → tenant diperingatkan dengan
 * "sisa" yang mencerminkan purge nyata, bukan N-late (yang meleset ~2 hari).
 *
 * Bila tenant SUDAH ditandai: tenggat lebih pasti = mark + grace + 1 run.
 */
export function purgeEarliestOffsetDays(daysBeforeDelete: number, purgeGraceHours: number): number {
  // grace/24 run untuk mencapai threshold, +1 karena bandingan ketat (mark < threshold).
  const runsAfterMark = Math.ceil(purgeGraceHours / 24) + 1;
  return daysBeforeDelete + 1 + runsAfterMark;
}

/** Sisa hari kalender sebelum data bisa dihapus (>=0, arah konservatif). */
export function sisaHapusSebelumPurge(params: {
  nextDueDate: Date | null;
  markedForDeletionAt: Date | null;
  daysBeforeDelete: number;
  purgeGraceHours: number;
  now: Date;
}): number {
  const { nextDueDate, markedForDeletionAt, daysBeforeDelete, purgeGraceHours, now } = params;
  if (markedForDeletionAt) {
    // Mark ada → purge ≥ mark + grace (ketat) + 1 run harian.
    const earliest = markedForDeletionAt.getTime()
      + purgeGraceHours * 3_600_000
      + 24 * 3_600_000;
    return Math.max(Math.ceil((earliest - now.getTime()) / 86_400_000), 0);
  }
  if (!nextDueDate) return 0;
  const late = Math.floor((now.getTime() - nextDueDate.getTime()) / 86_400_000);
  if (late < 0) return 0;
  return Math.max(purgeEarliestOffsetDays(daysBeforeDelete, purgeGraceHours) - late, 0);
}
