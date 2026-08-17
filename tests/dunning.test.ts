import { describe, it, expect } from "vitest";
import {
  daysLate,
  dunningAction,
  shouldSendReminderToday,
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
