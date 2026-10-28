import { describe, it, expect } from "vitest";
import {
  daysLate,
  dunningAction,
  shouldSendReminderToday,
  isPurgeEligible,
  purgeEarliestOffsetDays,
  sisaHapusSebelumPurge,
} from "../src/lib/billing/dunning-pure";

const POLICY = { graceDaysBeforeSuspend: 1, daysBeforeDelete: 7 };

describe("daysLate", () => {
  it("0 bila null / belum lewat", () => {
    expect(daysLate(null)).toBe(0);
    const future = new Date(Date.now() + 86_400_000);
    expect(daysLate(future)).toBe(0);
  });
  it("menghitung hari penuh keterlambatan", () => {
    const now = new Date("2026-01-10T00:00:00Z");
    expect(daysLate(new Date("2026-01-08T00:00:00Z"), now)).toBe(2);
    expect(daysLate(new Date("2026-01-09T12:00:00Z"), now)).toBe(0); // 12 jam -> 0
  });
});

describe("dunningAction", () => {
  it("none saat masih dalam grace", () => {
    expect(dunningAction(0, POLICY)).toBe("none");
    expect(dunningAction(1, POLICY)).toBe("none"); // tepat grace, belum lewat
  });
  it("suspend saat telat > grace", () => {
    expect(dunningAction(2, POLICY)).toBe("suspend");
    expect(dunningAction(7, POLICY)).toBe("suspend"); // tepat batas delete, belum lewat
  });
  it("delete saat telat > daysBeforeDelete", () => {
    expect(dunningAction(8, POLICY)).toBe("delete");
    expect(dunningAction(30, POLICY)).toBe("delete");
  });
});

describe("shouldSendReminderToday", () => {
  const now = new Date("2026-01-10T09:00:00Z");
  it("kirim bila hari telat ada di jadwal & belum kirim hari ini", () => {
    expect(shouldSendReminderToday(1, "0,1,3", null, now)).toBe(true);
    expect(shouldSendReminderToday(3, "0,1,3", null, now)).toBe(true);
  });
  it("tidak kirim bila hari telat tak ada di jadwal", () => {
    expect(shouldSendReminderToday(2, "0,1,3", null, now)).toBe(false);
  });
  it("tidak kirim dua kali di hari yang sama", () => {
    const earlierToday = new Date("2026-01-10T02:00:00Z");
    expect(shouldSendReminderToday(1, "0,1,3", earlierToday, now)).toBe(false);
  });
  it("kirim lagi bila reminder terakhir hari sebelumnya", () => {
    const yesterday = new Date("2026-01-09T09:00:00Z");
    expect(shouldSendReminderToday(1, "0,1,3", yesterday, now)).toBe(true);
  });
});

describe("isPurgeEligible (masa tenggang purge — cegah mark+purge di run yang sama)", () => {
  const now = new Date("2026-01-10T00:00:00Z");
  it("false bila belum ditandai", () => {
    expect(isPurgeEligible(null, now, 24)).toBe(false);
  });
  it("false bila baru ditandai (run yang sama / < grace jam)", () => {
    // ditandai 5 menit lalu, grace 24 jam -> belum boleh
    const justNow = new Date(now.getTime() - 5 * 60_000);
    expect(isPurgeEligible(justNow, now, 24)).toBe(false);
  });
  it("true bila tanda lebih tua dari grace", () => {
    const oldMark = new Date(now.getTime() - 25 * 3_600_000); // 25 jam lalu
    expect(isPurgeEligible(oldMark, now, 24)).toBe(true);
  });
  it("tepat di ambang belum memenuhi (harus lebih tua)", () => {
    const exactly = new Date(now.getTime() - 24 * 3_600_000);
    expect(isPurgeEligible(exactly, now, 24)).toBe(false);
  });
});

describe("reconcile {sisa} dengan tenggat purge nyata (F2)", () => {
  // Angka kebijakan LIVE 27 Okt 2026: daysBeforeDelete=37, purgeGraceHours=24.
  const LIVE = { daysBeforeDelete: 37, purgeGraceHours: 24 };

  it("purge paling cepat = N+3 hari (mark N+1, lalu 2 run harian setelahnya)", () => {
    expect(purgeEarliestOffsetDays(LIVE.daysBeforeDelete, LIVE.purgeGraceHours)).toBe(40);
  });

  it("grace 48 jam → +2 run setelah mark → N+4", () => {
    expect(purgeEarliestOffsetDays(37, 48)).toBe(41);
  });

  it("sisa = offset - telat, dan minimal 0", () => {
    const due = new Date("2026-10-18T00:00:00Z");
    const now = new Date(due.getTime() + 30 * 86_400_000); // telat 30
    expect(sisaHapusSebelumPurge({
      nextDueDate: due, markedForDeletionAt: null,
      daysBeforeDelete: 37, purgeGraceHours: 24, now,
    })).toBe(10);
    // telat lewat tenggat → 0
    const nowLate = new Date(due.getTime() + 99 * 86_400_000);
    expect(sisaHapusSebelumPurge({
      nextDueDate: due, markedForDeletionAt: null,
      daysBeforeDelete: 37, purgeGraceHours: 24, now: nowLate,
    })).toBe(0);
  });

  it("setelah ditandai: sisa dari mark + grace + 1 run harian (tenggat pasti)", () => {
    const marked = new Date("2026-11-24T01:00:00Z");
    const now = new Date("2026-11-24T01:00:00Z");
    expect(sisaHapusSebelumPurge({
      nextDueDate: null, markedForDeletionAt: marked,
      daysBeforeDelete: 37, purgeGraceHours: 24, now,
    })).toBe(2); // +24 jam grace, +24 jam run berikutnya = 48 jam = 2 hari
  });

  it("sebelum jatuh tempo atau tanpa tanggal → 0", () => {
    const due = new Date("2026-10-18T00:00:00Z");
    expect(sisaHapusSebelumPurge({
      nextDueDate: due, markedForDeletionAt: null,
      daysBeforeDelete: 37, purgeGraceHours: 24, now: new Date(due.getTime() - 86_400_000),
    })).toBe(0);
    expect(sisaHapusSebelumPurge({
      nextDueDate: null, markedForDeletionAt: null,
      daysBeforeDelete: 37, purgeGraceHours: 24, now: new Date(),
    })).toBe(0);
  });
});
