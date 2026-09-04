import { describe, it, expect } from "vitest";
import { computeDiscount, resolveCheckout } from "../src/lib/domain/coupon-calc";

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

describe("resolveCheckout (pure) — base/diskon/pajak/total satu sumber", () => {
  it("tanpa diskon, PKP 11%: pajak dari base penuh", () => {
    const r = resolveCheckout(149_000, 0, 11);
    expect(r.subtotal).toBe(149_000);
    expect(r.taxAmount).toBe(16_390);
    expect(r.total).toBe(165_390);
  });

  it("pajak dihitung SETELAH diskon (bukan sebelum)", () => {
    // base 500rb, diskon 100rb → subtotal 400rb → pajak 11% = 44rb → total 444rb
    const r = resolveCheckout(500_000, 100_000, 11);
    expect(r.subtotal).toBe(400_000);
    expect(r.taxAmount).toBe(44_000);
    expect(r.total).toBe(444_000);
  });

  it("non-PKP (taxPercent 0): total = subtotal", () => {
    const r = resolveCheckout(149_000, 49_000, 0);
    expect(r.taxAmount).toBe(0);
    expect(r.total).toBe(100_000);
  });

  it("OVERRIDE Rp1.000 (diskon 148rb dari 149rb) + pajak 11%", () => {
    const base = 149_000;
    const discount = computeDiscount({ type: "OVERRIDE", value: 1_000, base });
    const r = resolveCheckout(base, discount, 11);
    expect(r.subtotal).toBe(1_000);
    expect(r.taxAmount).toBe(110);
    expect(r.total).toBe(1_110);
  });

  it("diskon 100% → total 0 (guard di service akan menolak)", () => {
    const base = 149_000;
    const discount = computeDiscount({ type: "PERCENT", value: 100, base });
    const r = resolveCheckout(base, discount, 11);
    expect(r.subtotal).toBe(0);
    expect(r.total).toBe(0);
  });

  it("diskon melebihi base diklamp (total tak negatif)", () => {
    const r = resolveCheckout(100_000, 999_999, 11);
    expect(r.discount).toBe(100_000);
    expect(r.subtotal).toBe(0);
    expect(r.total).toBe(0);
  });

  it("item Midtrans: subtotal + taxAmount = total (jumlah item = gross)", () => {
    for (const [base, disc, tax] of [[149_000, 0, 11], [499_000, 250_000, 11], [199_000, 50_000, 0]] as const) {
      const r = resolveCheckout(base, disc, tax);
      expect(r.subtotal + r.taxAmount).toBe(r.total);
      expect(r.subtotal).toBeGreaterThanOrEqual(0); // tak ada harga negatif
    }
  });
});
