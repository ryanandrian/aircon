import { describe, it, expect } from "vitest";
import {
  isTenantUsable,
  withinQuota,
  computeTrialEnd,
  isTrialExpired,
  withTax,
  parseReminderDays,
} from "../src/lib/billing/gating-pure";

describe("tenant lifecycle", () => {
  it("TRIAL/ACTIVE/PAST_DUE bisa dipakai; SUSPENDED/CANCELLED tidak", () => {
    expect(isTenantUsable("TRIAL")).toBe(true);
    expect(isTenantUsable("ACTIVE")).toBe(true);
    expect(isTenantUsable("PAST_DUE")).toBe(true);
    expect(isTenantUsable("SUSPENDED")).toBe(false);
    expect(isTenantUsable("CANCELLED")).toBe(false);
  });

  it("computeTrialEnd menambah N hari (dari policy)", () => {
    const end = computeTrialEnd(new Date("2026-01-01T00:00:00Z"), 14);
    expect(end.toISOString().slice(0, 10)).toBe("2026-01-15");
  });

  it("isTrialExpired benar", () => {
    const past = new Date(Date.now() - 86400000);
    const future = new Date(Date.now() + 86400000);
    expect(isTrialExpired(past)).toBe(true);
    expect(isTrialExpired(future)).toBe(false);
    expect(isTrialExpired(null)).toBe(false);
  });
});

describe("quota (kuota, bukan fitur)", () => {
  it("withinQuota: null = unlimited", () => {
    expect(withinQuota(null, 9999)).toBe(true);
  });
  it("withinQuota: current < limit boleh, current >= limit tidak", () => {
    expect(withinQuota(3, 2)).toBe(true);
    expect(withinQuota(3, 3)).toBe(false);
    expect(withinQuota(3, 4)).toBe(false);
    expect(withinQuota(5, 4)).toBe(true);
  });
});

describe("pajak & reminder (dari config, no hardcode)", () => {
  it("withTax menghitung pajak benar", () => {
    expect(withTax(100000, 11)).toEqual({ subtotal: 100000, taxAmount: 11000, total: 111000 });
    expect(withTax(149000, 11).total).toBe(165390);
    expect(withTax(100000, 0)).toEqual({ subtotal: 100000, taxAmount: 0, total: 100000 });
  });
  it("config.withTax konsisten", () => {
    expect(withTax(149000, 11).total).toBe(165390);
  });
  it("parseReminderDays mengurai & mengurutkan", () => {
    expect(parseReminderDays("0,1,3")).toEqual([0, 1, 3]);
    expect(parseReminderDays("3, 1, 0")).toEqual([0, 1, 3]);
    expect(parseReminderDays("")).toEqual([]);
    expect(parseReminderDays("1,2")).toEqual([1, 2]);
  });
});
