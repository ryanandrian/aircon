import { describe, it, expect } from "vitest";
import {
  planConfigSchema,
  billingPolicySchema,
  iotProductSchema,
  companyProfileSchema,
} from "../src/lib/validation/admin-config";
import { effectiveTaxPercent } from "../src/lib/billing/gating-pure";

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
  dunningReminderTemplate: "Halo {nama}, tagihan menunggak {telat} hari.",
  dunningWarningTemplate: "Halo {nama}, menunggak {telat} hari, sisa {sisa} hari sebelum data dihapus.",
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

const validCompany = {
  legalName: "PT Lumite Nusantara", brandName: "Aircon", logoUrl: "/brand/lumite-logo.png", isPkp: true, npwp: "01.234.567.8-901.000",
  taxLabel: "PPN", email: "billing@lumite.id", phone: "0812", addressLine: "Jl. X", city: "Bandung",
  province: "Jabar", postalCode: "40111", countryCode: "IDN", checkoutExpiryHours: 24, finishUrl: "",
};

describe("companyProfileSchema", () => {
  it("terima valid", () => {
    expect(companyProfileSchema.safeParse(validCompany).success).toBe(true);
  });
  it("tolak email ngawur", () => {
    expect(companyProfileSchema.safeParse({ ...validCompany, email: "bukan-email" }).success).toBe(false);
  });
  it("tolak finishUrl non-http", () => {
    expect(companyProfileSchema.safeParse({ ...validCompany, finishUrl: "ftp://x" }).success).toBe(false);
  });
  it("terima finishUrl kosong", () => {
    expect(companyProfileSchema.safeParse({ ...validCompany, finishUrl: "" }).success).toBe(true);
  });
});

describe("effectiveTaxPercent (PKP gating)", () => {
  it("bukan PKP -> 0 walau kebijakan 11", () => {
    expect(effectiveTaxPercent(false, 11)).toBe(0);
  });
  it("PKP -> pakai rate kebijakan", () => {
    expect(effectiveTaxPercent(true, 11)).toBe(11);
  });
  it("PKP rate lain (jasa) -> pakai apa adanya", () => {
    expect(effectiveTaxPercent(true, 1.1)).toBe(1.1);
  });
  it("rate negatif dijepit 0", () => {
    expect(effectiveTaxPercent(true, -5)).toBe(0);
  });
});
