import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/services/customer-service", () => ({
  ServiceError: class ServiceError extends Error {
    code: string; constructor(code: string, message: string) { super(message); this.code = code; }
  },
}));

const store: any = {};
let updated: any = null;
let createdInv: any = null;

vi.mock("@/lib/prisma", () => ({
  prisma: {
    invoice: {
      findFirst: vi.fn(async ({ where }: any) => {
        if (where.docType === "PROFORMA") return store.proforma ?? null;
        if (where.number) return null; // penomoran: belum ada
        return store.invoice ?? null;
      }),
      update: vi.fn(async ({ data }: any) => { updated = data; return {}; }),
      updateMany: vi.fn(async ({ data }: any) => { updated = data; return { count: store.markCount ?? 1 }; }),
    },
    tenant: { findUnique: vi.fn(async () => store.tenant) },
    $transaction: vi.fn(async (fn: any) => fn({
      invoice: {
        create: vi.fn(async ({ data }: any) => { createdInv = data; return { id: "invNew" }; }),
        update: vi.fn(async ({ data }: any) => { updated = data; return {}; }),
      },
    })),
  },
}));

import { markInvoicePaid, createInvoiceFromProforma, cancelInvoice } from "../src/lib/services/invoice-service";

beforeEach(() => {
  updated = null; createdInv = null;
  store.tenant = { isPkp: false, taxPercent: 0 };
  store.invoice = { id: "inv1", docType: "INVOICE", status: "ISSUED" };
  store.proforma = {
    id: "pro1", docType: "PROFORMA", status: "ISSUED", customerId: "c1",
    billingCustomerId: null, workSessionId: null, jobId: null, dueDate: new Date("2026-09-30"),
    items: [{ assetId: "a1", descSnapshot: "Cuci", category: "SERVICE", qty: 1, unit: "unit", unitPrice: 500000, lineTotal: 500000 }],
  };
});

describe("markInvoicePaid", () => {
  it("invoice ISSUED → PAID + payMethod + paidAt", async () => {
    await markInvoicePaid("t1", "inv1", "CASH");
    expect(updated.status).toBe("PAID");
    expect(updated.payMethod).toBe("CASH");
    expect(updated.paidAt).toBeInstanceOf(Date);
  });
  it("tolak proforma", async () => {
    store.invoice = { id: "inv1", docType: "PROFORMA", status: "ISSUED" };
    await expect(markInvoicePaid("t1", "inv1", "CASH")).rejects.toThrow();
  });
  it("tolak sudah PAID", async () => {
    store.invoice = { id: "inv1", docType: "INVOICE", status: "PAID" };
    await expect(markInvoicePaid("t1", "inv1", "CASH")).rejects.toThrow();
  });
  it("B4: race double-mark → updateMany count 0 → tolak (cegah double-mark)", async () => {
    store.markCount = 0; // status berubah proses lain di dalam window
    await expect(markInvoicePaid("t1", "inv1", "CASH")).rejects.toThrow();
    store.markCount = 1;
  });
});

describe("createInvoiceFromProforma (K11/K12)", () => {
  it("salin item + diskon → pajak setelah diskon; proforma jadi CANCELLED", async () => {
    store.tenant = { isPkp: true, taxPercent: 11 };
    const r = await createInvoiceFromProforma("t1", "pro1", "u1", 100000);
    // 500.000 - 100.000 = 400.000 ; PPN 11% = 44.000 ; total 444.000
    expect(r.number.startsWith("INV/")).toBe(true);
    expect(Number(createdInv.total)).toBe(444000);
    expect(Number(createdInv.discountAmount)).toBe(100000);
    expect(Number(createdInv.ppnAmount)).toBe(44000);
    expect(createdInv.docType).toBe("INVOICE");
    // proforma di-cancel (update terakhir)
    expect(updated.status).toBe("CANCELLED");
  });
  it("tanpa diskon, non-PKP → total = subtotal", async () => {
    const r = await createInvoiceFromProforma("t1", "pro1", "u1", 0);
    expect(Number(createdInv.total)).toBe(500000);
    expect(r.invoiceId).toBe("invNew");
  });
});

describe("cancelInvoice (K11)", () => {
  it("ISSUED → CANCELLED", async () => {
    store.invoice = { id: "inv1", status: "ISSUED" };
    await cancelInvoice("t1", "inv1");
    expect(updated.status).toBe("CANCELLED");
  });
  it("tolak PAID", async () => {
    store.invoice = { id: "inv1", status: "PAID" };
    await expect(cancelInvoice("t1", "inv1")).rejects.toThrow();
  });
});
