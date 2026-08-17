import { describe, it, expect } from "vitest";
import {
  planConfigSchema,
  billingPolicySchema,
  iotProductSchema,
} from "../src/lib/validation/admin-config";

const validPlan = {
  displayName: "Professional", priceMonthly: 149000, taxable: true, active: true,
  sortOrder: 1, tagline: "", maxAdmins: 1, maxTechnicians: 5, maxCustomers: 200, maxAcUnits: 500,
};

describe("planConfigSchema", () => {
  it("terima valid", () => {
    expect(planConfigSchema.safeParse(validPlan).success).toBe(true);
  });
  it("terima kuota null (unlimited)", () => {
    expect(planConfigSchema.safeParse({ ...validPlan, maxTechnicians: null }).success).toBe(true);
  });
  it("tolak kuota negatif", () => {
    expect(planConfigSchema.safeParse({ ...validPlan, maxCustomers: -1 }).success).toBe(false);
  });
  it("tolak harga negatif", () => {
    expect(planConfigSchema.safeParse({ ...validPlan, priceMonthly: -5 }).success).toBe(false);
  });
});

const validPolicy = {
  taxPercent: 11, trialDays: 14, graceDaysBeforeSuspend: 1,
  daysBeforeDelete: 7, dunningReminderDays: "0,1,3", deleteWarningDay: 3,
};

describe("billingPolicySchema", () => {
  it("terima valid", () => {
    expect(billingPolicySchema.safeParse(validPolicy).success).toBe(true);
  });
  it("tolak pajak > 100", () => {
    expect(billingPolicySchema.safeParse({ ...validPolicy, taxPercent: 150 }).success).toBe(false);
  });
  it("tolak hari hapus <= hari suspend", () => {
    expect(billingPolicySchema.safeParse({ ...validPolicy, daysBeforeDelete: 1, graceDaysBeforeSuspend: 1 }).success).toBe(false);
  });
  it("tolak peringatan hapus >= hari hapus", () => {
    expect(billingPolicySchema.safeParse({ ...validPolicy, deleteWarningDay: 7 }).success).toBe(false);
  });
  it("tolak format reminder tidak valid", () => {
    expect(billingPolicySchema.safeParse({ ...validPolicy, dunningReminderDays: "a,b" }).success).toBe(false);
  });
  it("terima reminder csv valid", () => {
    expect(billingPolicySchema.safeParse({ ...validPolicy, dunningReminderDays: "0, 2, 5" }).success).toBe(true);
  });
});

describe("iotProductSchema", () => {
  it("terima valid", () => {
    expect(iotProductSchema.safeParse({ name: "Device V1", description: "", priceUnit: 750000, warrantyDays: 90, active: true }).success).toBe(true);
  });
  it("tolak harga negatif", () => {
    expect(iotProductSchema.safeParse({ name: "X", priceUnit: -1, warrantyDays: 90, active: true }).success).toBe(false);
  });
});
