/**
 * Dunning (penagihan) — fungsi MURNI, tanpa DB. Aman diuji unit.
 * Aturan durasi/jadwal berasal dari BillingPolicy (DB), diteruskan sebagai argumen.
 */

/** Hari keterlambatan sejak jatuh tempo. 0 bila belum lewat / null. */
export function daysLate(nextDueDate: Date | null, now: Date = new Date()): number {
  if (!nextDueDate) return 0;
  const ms = now.getTime() - nextDueDate.getTime();
  if (ms <= 0) return 0;
  return Math.floor(ms / 86_400_000);
}

export type DunningAction = "none" | "suspend" | "delete";

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
): boolean {
  const days = reminderDaysCsv
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n >= 0);
  if (!days.includes(late)) return false;
  if (lastReminderAt) {
    const sameDay =
      lastReminderAt.getUTCFullYear() === now.getUTCFullYear() &&
      lastReminderAt.getUTCMonth() === now.getUTCMonth() &&
      lastReminderAt.getUTCDate() === now.getUTCDate();
    if (sameDay) return false;
  }
  return true;
}
