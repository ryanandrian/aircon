import { describe, it, expect } from "vitest";
import {
  isTenantUsable,
  effectivePlan,
  canAddTechnician,
  hasFeature,
  computeTrialEnd,
} from "../src/lib/billing/gating";
import { PLANS } from "../src/lib/billing/plans";

describe("tenant lifecycle & gating", () => {
  it("TRIAL & ACTIVE bisa dipakai; SUSPENDED/CANCELLED tidak", () => {
    expect(isTenantUsable("TRIAL")).toBe(true);
    expect(isTenantUsable("ACTIVE")).toBe(true);
    expect(isTenantUsable("PAST_DUE")).toBe(true); // masih boleh (grace)
    expect(isTenantUsable("SUSPENDED")).toBe(false);
    expect(isTenantUsable("CANCELLED")).toBe(false);
  });

  it("effectivePlan: TRIAL memakai fitur plan tertinggi (biar user coba)", () => {
    expect(effectivePlan("TRIAL", "STARTER")).toBe("PRO");
    expect(effectivePlan("ACTIVE", "GROWTH")).toBe("GROWTH");
  });

  it("hasFeature menghormati plan", () => {
    expect(hasFeature("PRO", "dynamicReplanning")).toBe(true);
    expect(hasFeature("STARTER", "dynamicReplanning")).toBe(false);
    expect(hasFeature("GROWTH", "growthTools")).toBe(true);
    expect(hasFeature("STARTER", "growthTools")).toBe(false);
  });

  it("canAddTechnician menghormati batas plan", () => {
    expect(canAddTechnician("STARTER", 2)).toBe(true); // batas 3
    expect(canAddTechnician("STARTER", 3)).toBe(false);
    expect(canAddTechnician("GROWTH", 7)).toBe(true); // batas 8
    expect(canAddTechnician("GROWTH", 8)).toBe(false);
    expect(canAddTechnician("PRO", 100)).toBe(true);
  });

  it("computeTrialEnd menambah N hari", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    const end = computeTrialEnd(start, 14);
    expect(end.toISOString().slice(0, 10)).toBe("2026-01-15");
  });

  it("PLANS punya harga naik STARTER < GROWTH < PRO", () => {
    expect(PLANS.STARTER.priceMonthly).toBeLessThan(PLANS.GROWTH.priceMonthly);
    expect(PLANS.GROWTH.priceMonthly).toBeLessThan(PLANS.PRO.priceMonthly);
  });
});
