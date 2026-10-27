/**
 * Milestone pengingat LANGGANAN ke owner (platform → tenant) — PURE, tanpa prisma.
 * Sumber milestone = BillingPolicy.dunningReminderDays (csv, editable admin), yang juga
 * dipakai dunning MessageLog. Satu milestone = satu pesan per periode tagihan.
 * Dedupe per (tenant, nextDueDate, hari telat) → webhook/cron ulang tidak menggandakan.
 */

export function parseMilestones(csv: string): number[] {
  return csv
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n >= 0);
}

/** Hari telat penuh (kalender UTC) antara jatuh tempo dan `now`. 0 = hari jatuh tempo itu sendiri. */
export function lateDays(nextDueDate: Date, now: Date): number {
  const d = Date.UTC(nextDueDate.getUTCFullYear(), nextDueDate.getUTCMonth(), nextDueDate.getUTCDate());
  const n = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((n - d) / 86_400_000);
}

/**
 * Apakah overdue harus diantre hari ini untuk periode ini.
 * Hanya pada hari telat yang ada di milestone. Tidak dikirim tiap hari.
 */
export function overdueMilestoneDue(nextDueDate: Date, now: Date, milestonesCsv: string): { due: boolean; late: number } {
  const late = lateDays(nextDueDate, now);
  return { due: late >= 0 && parseMilestones(milestonesCsv).includes(late), late };
}

/** Kunci dedupe stabil per periode & milestone (bukan per hari kalender). */
export function overdueDedupeKey(tenantId: string, nextDueDate: Date, late: number): string {
  return `subscription_overdue:${tenantId}:${nextDueDate.toISOString().slice(0, 10)}:d${late}`;
}
