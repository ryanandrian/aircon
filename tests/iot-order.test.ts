import { describe, it, expect } from "vitest";
import { makeIotOrderNo, computeOrderTotals } from "../src/lib/services/iot-order-logic";

describe("makeIotOrderNo", () => {
  it("unik & berawalan IOT-", () => {
    const a = makeIotOrderNo("tenantABC");
    const b = makeIotOrderNo("tenantABC");
    expect(a.startsWith("IOT-")).toBe(true);
    expect(a).not.toBe(b);
  });
});

describe("computeOrderTotals", () => {
  it("tanpa pajak", () => {
    expect(computeOrderTotals(750000, 2, 0)).toEqual({
      subtotal: 1500000, taxAmount: 0, total: 1500000,
    });
  });
  it("dengan pajak 11%", () => {
    expect(computeOrderTotals(750000, 1, 11)).toEqual({
      subtotal: 750000, taxAmount: 82500, total: 832500,
    });
  });
  it("qty minimal 1 (guard nilai <1)", () => {
    expect(computeOrderTotals(750000, 0, 0).total).toBe(750000);
    expect(computeOrderTotals(750000, -3, 0).total).toBe(750000);
  });
  it("qty dibulatkan ke bawah", () => {
    expect(computeOrderTotals(100000, 2.9, 0).subtotal).toBe(200000);
  });
});
