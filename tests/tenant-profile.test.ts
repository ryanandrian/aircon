import { describe, it, expect } from "vitest";
import { tenantProfileSchema } from "../src/lib/validation/tenant-profile";

/** F1.5 — validasi profil usaha tenant (branding/pajak/rekening/QRIS). */
describe("tenantProfileSchema", () => {
  it("menerima profil kosong (semua opsional — tenant kecil non-PKP)", () => {
    expect(tenantProfileSchema.safeParse({}).success).toBe(true);
  });

  it("menerima profil PKP lengkap", () => {
    const r = tenantProfileSchema.safeParse({
      logoUrl: "https://s3/x.png", isPkp: true, npwp: "01.234.567.8-901.000", taxPercent: 11,
      bankName: "BCA", bankAccountNo: "1234567890", bankAccountName: "PT Sejuk", qrisImageUrl: "https://s3/q.png",
    });
    expect(r.success).toBe(true);
  });

  it("menolak taxPercent > 100", () => {
    expect(tenantProfileSchema.safeParse({ taxPercent: 150 }).success).toBe(false);
  });

  it("menolak taxPercent negatif", () => {
    expect(tenantProfileSchema.safeParse({ taxPercent: -5 }).success).toBe(false);
  });
});
