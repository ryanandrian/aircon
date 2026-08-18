import { describe, it, expect } from "vitest";
import {
  computeCommission,
  computeTaxWithholding,
  taxWithholdingPercent,
  netPayout,
  normalizeCode,
} from "../src/lib/partner/commission-logic";

describe("computeCommission — rupiah PERSIS (SPEC §2.1-2.2)", () => {
  it("persen bulanan: 20% × 500rb = 100rb", () => {
    expect(computeCommission(500000, 1, "PERCENT", 20)).toBe(100000);
  });
  it("flat bulanan: Rp50rb × 1 bulan = 50rb", () => {
    expect(computeCommission(500000, 1, "FLAT_IDR", 50000)).toBe(50000);
  });
  it("flat TAHUNAN: Rp50rb × 12 bulan = 600rb (§2.1)", () => {
    expect(computeCommission(6000000, 12, "FLAT_IDR", 50000)).toBe(600000);
  });
  it("persen basis-NET (diskon): 20% × 400rb (bukan 500rb pajangan) = 80rb (§2.2)", () => {
    expect(computeCommission(400000, 1, "PERCENT", 20)).toBe(80000);
  });
  it("persen dibulatkan ke rupiah penuh: 15% × 149000 = 22350", () => {
    expect(computeCommission(149000, 1, "PERCENT", 15)).toBe(22350);
  });
  it("nol bila gross/months/rate <= 0", () => {
    expect(computeCommission(0, 1, "PERCENT", 20)).toBe(0);
    expect(computeCommission(500000, 0, "FLAT_IDR", 50000)).toBe(0);
    expect(computeCommission(500000, 1, "PERCENT", 0)).toBe(0);
  });
});

describe("computeTaxWithholding (SPEC §6b prefill)", () => {
  it("badan NPWP 2%", () => {
    expect(taxWithholdingPercent("BADAN_NPWP")).toBe(2);
    expect(computeTaxWithholding(100000, "BADAN_NPWP")).toBe(2000);
  });
  it("badan tanpa NPWP 4%", () => {
    expect(computeTaxWithholding(100000, "BADAN_NON_NPWP")).toBe(4000);
  });
  it("perorangan 2.5%", () => {
    expect(computeTaxWithholding(100000, "PERORANGAN")).toBe(2500);
  });
  it("nol bila komisi <= 0", () => {
    expect(computeTaxWithholding(0, "BADAN_NPWP")).toBe(0);
  });
});

describe("netPayout", () => {
  it("bruto - refund menggantung - PPh", () => {
    expect(netPayout(100000, 20000, 2000)).toBe(78000);
  });
  it("tak pernah negatif", () => {
    expect(netPayout(10000, 50000, 0)).toBe(0);
  });
});

describe("normalizeCode (unik-global format)", () => {
  it("uppercase + valid 4-12 alnum", () => {
    expect(normalizeCode("budi88")).toBe("BUDI88");
    expect(normalizeCode(" ac2024 ")).toBe("AC2024");
  });
  it("tolak invalid", () => {
    expect(normalizeCode("ab")).toBeNull();       // terlalu pendek
    expect(normalizeCode("a".repeat(13))).toBeNull(); // terlalu panjang
    expect(normalizeCode("budi-88")).toBeNull();   // simbol
    expect(normalizeCode("")).toBeNull();
  });
});
