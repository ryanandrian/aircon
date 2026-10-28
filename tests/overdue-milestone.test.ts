import { describe, it, expect } from "vitest";
import { overdueMilestoneDue, overdueDedupeKey, lateDays, parseMilestones } from "../src/lib/domain/overdue-milestone";

const WIB = "Asia/Jakarta";

const DEFAULT_CSV = "0,3,7,14,30"; // BillingPolicy.dunningReminderDays (default schema)
const due = new Date("2026-10-18T00:39:38.962Z"); // jatuh tempo nyata dari live (tenant PROFESSIONAL)
const at = (days: number) => new Date(due.getTime() + days * 86_400_000 + 3 * 3_600_000);

describe("overdue milestone — hanya pada hari telat yang dikonfigurasi", () => {
  it("parse milestone csv (toleran spasi, buang nilai rusak)", () => {
    expect(parseMilestones("0, 3,7 ,x,14")).toEqual([0, 3, 7, 14]);
  });

  it("hari 0..30 mengirim HANYA pada 0,3,7,14,30 (bukan tiap hari)", () => {
    const hits: number[] = [];
    for (let d = 0; d <= 30; d++) {
      if (overdueMilestoneDue(due, at(d), DEFAULT_CSV, WIB).due) hits.push(d);
    }
    expect(hits).toEqual([0, 3, 7, 14, 30]);
  });



  it("dedupe key stabil per periode & milestone, bukan per hari kalender", () => {
    const k3 = overdueDedupeKey("t1", due, 3);
    expect(k3).toBe("subscription_overdue:t1:2026-10-18:d3");
    expect(overdueDedupeKey("t1", due, 3)).toBe(overdueDedupeKey("t1", due, 3));
    expect(overdueDedupeKey("t1", due, 3)).not.toBe(overdueDedupeKey("t1", due, 7));
  });

  // G22: hari telat dihitung pada KALENDER zona tenant (WIB), bukan durasi 24 jam.
  it("hari telat mengikuti kalender zona tenant", () => {
    expect(lateDays(due, at(3), WIB)).toBe(3);
    // 23:59 UTC = 06:59 WIB tanggal berikutnya → 4 hari kalender WIB.
    const late23 = new Date(Date.UTC(2026, 9, 21, 23, 59));
    expect(lateDays(due, late23, WIB)).toBe(4);
  });

  // Bukti live (G22): jatuh tempo 18 Okt 07:39 WIB; cron 19 Okt 01:00 WIB.
  // Hitungan lama (24 jam) memberi 0 → milestone bergeser 1 hari.
  it("kasus live: jatuh tempo 07:39 WIB, cron 01:00 WIB → 1 hari telat", () => {
    const liveDue = new Date("2026-10-18T00:39:38.962Z"); // 18 Okt 07:39 WIB
    const cronNext = new Date("2026-10-18T18:00:00.000Z"); // 19 Okt 01:00 WIB
    expect(lateDays(liveDue, cronNext, WIB)).toBe(1);
    // Lama (durasi 24 jam) = 0 — inilah sumber pergeseran milestone.
    const ms = cronNext.getTime() - liveDue.getTime();
    expect(Math.floor(ms / 86_400_000)).toBe(0);
  });

  it("sebelum jatuh tempo: tidak ada milestone walau selisih kalender negatif", () => {
    const before = new Date(due.getTime() - 86_400_000);
    expect(overdueMilestoneDue(due, before, DEFAULT_CSV, WIB).due).toBe(false);
  });
});
