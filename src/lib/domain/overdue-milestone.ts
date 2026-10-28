/**
 * Milestone pengingat LANGGANAN ke owner (platform → tenant) — PURE, tanpa prisma.
 * Sumber milestone = BillingPolicy.dunningReminderDays (csv, editable admin), yang juga
 * dipakai dunning MessageLog. Satu milestone = satu pesan per periode tagihan.
 * Dedupe per (tenant, nextDueDate, hari telat) → webhook/cron ulang tidak menggandakan.
 *
 * G22: semua batas dihitung pada HARI KALENDER zona tenant (bukan durasi 24 jam
 * dan bukan zona server/UTC). Bukti live: jatuh tempo 18 Okt 07:39 WIB, cron
 * 19 Okt 01:00 WIB → hitungan jam memberi "0 hari telat" walau kalender sudah 1.
 */

import { dayDifferenceInZone, dayKeyInZone } from "@/lib/domain/tenant-timezone";

export function parseMilestones(csv: string): number[] {
  return csv
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n >= 0);
}

/** Hari telat penuh (kalender zona tenant). 0 = hari jatuh tempo itu sendiri. */
export function lateDays(nextDueDate: Date, now: Date, tz?: string | null): number {
  return Math.max(0, dayDifferenceInZone(nextDueDate, now, tz));
}

/**
 * Apakah overdue harus diantre hari ini untuk periode ini.
 * Hanya pada hari telat yang ada di milestone. Tidak dikirim tiap hari.
 */
export function overdueMilestoneDue(
  nextDueDate: Date, now: Date, milestonesCsv: string, tz?: string | null,
): { due: boolean; late: number } {
  // Belum jatuh tempo (banding INSTAN, bukan hari kalender): JANGAN kirim.
  // Tanpa guard ini, late di-clamp ke 0 sehingga milestone 0 ("hari jatuh tempo")
  // ikut terpicu sehari lebih awal — pesan overdue terkirim sebelum jatuh tempo.
  if (now.getTime() < nextDueDate.getTime()) return { due: false, late: 0 };
  const late = lateDays(nextDueDate, now, tz);
  return { due: parseMilestones(milestonesCsv).includes(late), late };
}

/** Kunci dedupe stabil per periode & milestone (bukan per hari kalender server). */
export function overdueDedupeKey(tenantId: string, nextDueDate: Date, late: number, tz?: string | null): string {
  return `subscription_overdue:${tenantId}:${dayKeyInZone(nextDueDate, tz)}:d${late}`;
}
