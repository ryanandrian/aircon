import { describe, it, expect, vi } from "vitest";
import { computeInvoiceTotals, computeDueDate, topDays } from "../src/lib/services/invoice-service";

vi.mock("@/lib/services/customer-service", () => ({
  ServiceError: class ServiceError extends Error {
    code: string;
    constructor(code: string, message: string) { super(message); this.code = code; }
  },
}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

/** F4.2 — kalkulasi UANG eksplisit (K4 PPN, K12 diskon→pajak, K19 dueDate). ANGKA HARUS TEPAT. */

describe("computeInvoiceTotals — non-PKP (invoice bersih, K4)", () => {
  it("tanpa pajak: total = subtotal", () => {
    const r = computeInvoiceTotals({
      items: [{ category: "SERVICE", qty: 1, unitPrice: 75000 }, { category: "SERVICE", qty: 1, unitPrice: 50000 }],
      tenantIsPkp: false,
    });
    expect(r.subtotal).toBe(125000);
    expect(r.ppnAmount).toBe(0);
    expect(r.total).toBe(125000);
  });
  it("qty > 1", () => {
    const r = computeInvoiceTotals({ items: [{ category: "SERVICE", qty: 8, unitPrice: 75000 }], tenantIsPkp: false });
    expect(r.subtotal).toBe(600000);
    expect(r.total).toBe(600000);
  });
});

describe("computeInvoiceTotals — PKP + PPN (K4)", () => {
  it("PPN 11% atas subtotal (tanpa diskon)", () => {
    const r = computeInvoiceTotals({
      items: [{ category: "SERVICE", qty: 1, unitPrice: 100000 }],
      tenantIsPkp: true, taxPercent: 11,
    });
    expect(r.subtotal).toBe(100000);
    expect(r.ppnPercent).toBe(11);
    expect(r.ppnAmount).toBe(11000);
    expect(r.total).toBe(111000);
  });
  it("PPN 12%", () => {
    const r = computeInvoiceTotals({ items: [{ category: "SERVICE", qty: 1, unitPrice: 250000 }], tenantIsPkp: true, taxPercent: 12 });
    expect(r.ppnAmount).toBe(30000);
    expect(r.total).toBe(280000);
  });
});

describe("computeInvoiceTotals — diskon SEBELUM pajak (K12)", () => {
  it("diskon lalu PPN 11% atas nilai setelah diskon", () => {
    const r = computeInvoiceTotals({
      items: [{ category: "SERVICE", qty: 1, unitPrice: 1000000 }],
      discountAmount: 100000, tenantIsPkp: true, taxPercent: 11,
    });
    // 1.000.000 - 100.000 = 900.000 ; PPN 11% = 99.000 ; total = 999.000
    expect(r.subtotal).toBe(1000000);
    expect(r.discountAmount).toBe(100000);
    expect(r.ppnAmount).toBe(99000);
    expect(r.total).toBe(999000);
  });
  it("diskon > subtotal dibatasi ke subtotal (total 0 + pajak 0)", () => {
    const r = computeInvoiceTotals({
      items: [{ category: "SERVICE", qty: 1, unitPrice: 50000 }],
      discountAmount: 999999, tenantIsPkp: true, taxPercent: 11,
    });
    expect(r.discountAmount).toBe(50000);
    expect(r.total).toBe(0);
    expect(r.ppnAmount).toBe(0);
  });
  it("diskon negatif diabaikan (jadi 0)", () => {
    const r = computeInvoiceTotals({ items: [{ category: "SERVICE", qty: 1, unitPrice: 50000 }], discountAmount: -1000, tenantIsPkp: false });
    expect(r.discountAmount).toBe(0);
    expect(r.total).toBe(50000);
  });
});

describe("computeInvoiceTotals — DPP jasa vs barang (K4)", () => {
  it("pisah jasa & barang; diskon dialokasikan proporsional", () => {
    const r = computeInvoiceTotals({
      items: [
        { category: "SERVICE", qty: 1, unitPrice: 300000 },   // jasa
        { category: "SPAREPART", qty: 1, unitPrice: 100000 }, // barang
      ],
      discountAmount: 40000, tenantIsPkp: true, taxPercent: 11,
    });
    // subtotal 400.000; afterDiscount 360.000; jasa porsi 300/400=75% → 270.000; barang → 90.000
    expect(r.subtotal).toBe(400000);
    expect(r.taxableService).toBe(270000);
    expect(r.taxableGoods).toBe(90000);
    expect(r.taxableService + r.taxableGoods).toBe(360000); // tak ada rupiah hilang
    expect(r.ppnAmount).toBe(39600); // 11% x 360.000
    expect(r.total).toBe(399600);
  });
  it("consumable dihitung sbg barang", () => {
    const r = computeInvoiceTotals({ items: [{ category: "CONSUMABLE", qty: 2, unitPrice: 25000 }], tenantIsPkp: false });
    expect(r.taxableGoods).toBe(50000);
    expect(r.taxableService).toBe(0);
  });
});

describe("computeInvoiceTotals — pembulatan", () => {
  it("PPN dibulatkan ke rupiah terdekat", () => {
    const r = computeInvoiceTotals({ items: [{ category: "SERVICE", qty: 1, unitPrice: 33333 }], tenantIsPkp: true, taxPercent: 11 });
    // 11% x 33.333 = 3666.63 → 3667
    expect(r.ppnAmount).toBe(3667);
    expect(r.total).toBe(37000);
  });
  it("subtotal kosong → semua 0", () => {
    const r = computeInvoiceTotals({ items: [], tenantIsPkp: true, taxPercent: 11 });
    expect(r.subtotal).toBe(0);
    expect(r.total).toBe(0);
  });
});

describe("computeDueDate + topDays (K19)", () => {
  it("CASH → null", () => {
    expect(computeDueDate(new Date("2026-08-28"), "CASH")).toBeNull();
    expect(topDays("CASH")).toBe(0);
  });
  it("TEMPO_30 → +30 hari", () => {
    const due = computeDueDate(new Date("2026-08-01T00:00:00"), "TEMPO_30");
    // bandingkan komponen tanggal lokal (hindari geser timezone)
    expect(due?.getFullYear()).toBe(2026);
    expect(due?.getMonth()).toBe(7); // Agustus (0-index)
    expect(due?.getDate()).toBe(31);
  });
  it("TEMPO_90 → +90 hari", () => {
    expect(topDays("TEMPO_90")).toBe(90);
    const due = computeDueDate(new Date("2026-01-01T00:00:00"), "TEMPO_90");
    expect(due?.getMonth()).toBe(3); // April
    expect(due?.getDate()).toBe(1);
  });
});
