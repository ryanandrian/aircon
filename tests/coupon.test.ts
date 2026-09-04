import { describe, it, expect } from "vitest";
import { computeDiscount } from "../src/lib/domain/coupon-calc";

describe("computeDiscount (pure)", () => {
  const base = 500_000;

  it("PERCENT 50% memotong separuh", () => {
    expect(computeDiscount({ type: "PERCENT", value: 50, base })).toBe(250_000);
  });

  it("PERCENT diklamp 0..100", () => {
    expect(computeDiscount({ type: "PERCENT", value: 150, base })).toBe(base); // >100 → 100%
    expect(computeDiscount({ type: "PERCENT", value: -10, base })).toBe(0);
  });

  it("FIXED memotong nominal, tak melebihi base", () => {
    expect(computeDiscount({ type: "FIXED", value: 100_000, base })).toBe(100_000);
    expect(computeDiscount({ type: "FIXED", value: 900_000, base })).toBe(base); // klamp
  });

  it("OVERRIDE menetapkan harga akhir = value (potongan = base - value)", () => {
    // uji Rp1.000: potongan = 500.000 - 1.000
    expect(computeDiscount({ type: "OVERRIDE", value: 1_000, base })).toBe(499_000);
  });

  it("OVERRIDE dgn value >= base → potongan 0 (harga tak naik)", () => {
    expect(computeDiscount({ type: "OVERRIDE", value: 600_000, base })).toBe(0);
  });

  it("base 0 → potongan 0 (paket gratis)", () => {
    expect(computeDiscount({ type: "PERCENT", value: 50, base: 0 })).toBe(0);
  });

  it("hasil selalu dalam [0, base]", () => {
    for (const t of ["PERCENT", "FIXED", "OVERRIDE"] as const) {
      for (const v of [-100, 0, 1, 250_000, 500_000, 999_999]) {
        const d = computeDiscount({ type: t, value: v, base });
        expect(d).toBeGreaterThanOrEqual(0);
        expect(d).toBeLessThanOrEqual(base);
      }
    }
  });
});
