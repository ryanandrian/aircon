import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/services/customer-service", () => ({
  ServiceError: class ServiceError extends Error {
    code: string; constructor(code: string, message: string) { super(message); this.code = code; }
  },
}));
vi.mock("@/lib/services/service-catalog-service", () => ({
  resolvePrice: vi.fn(async () => 75000),
}));
vi.mock("@/lib/services/invoice-service", () => ({
  computeInvoiceTotals: ({ items, tenantIsPkp, taxPercent }: any) => {
    const subtotal = items.reduce((s: number, i: any) => s + Math.round(i.qty * i.unitPrice), 0);
    const ppnPercent = tenantIsPkp ? (taxPercent ?? 0) : 0;
    const ppnAmount = ppnPercent > 0 ? Math.round(subtotal * ppnPercent / 100) : 0;
    return { subtotal, discountAmount: 0, taxableService: subtotal, taxableGoods: 0, ppnPercent, ppnAmount, total: subtotal + ppnAmount };
  },
  computeDueDate: (issue: Date, top: string) => (top === "CASH" ? null : new Date(issue.getTime() + 30 * 86400000)),
  nextInvoiceNumber: async (_t: string, docType: string) => `${docType === "PROFORMA" ? "PRO" : "INV"}/2026/0001`,
}));

/** F4.3 — closeWorkSession memilih docType sesuai TOP (Cash→Invoice, Tempo→Proforma) + total benar. */
const store: any = {};
let created: any = null;

vi.mock("@/lib/prisma", () => ({
  prisma: {
    workSession: {
      findFirst: vi.fn(async ({ where }: any) => {
        if (where.status === "OPEN" && store.ws?.status === "OPEN") return store.ws;
        return store.ws ?? null;
      }),
      update: vi.fn(async () => ({})),
    },
    tenant: { findUnique: vi.fn(async () => store.tenant) },
    invoice: {
      findFirst: vi.fn(async () => null), // penomoran: belum ada
      create: vi.fn(async ({ data }: any) => { created = data; return { id: "inv1" }; }),
    },
    $transaction: vi.fn(async (fn: any) => fn({
      invoice: { create: vi.fn(async ({ data }: any) => { created = data; return { id: "inv1" }; }) },
      workSession: { update: vi.fn(async () => ({})) },
    })),
  },
}));

import { closeWorkSession } from "../src/lib/services/worksession-service";

beforeEach(() => {
  created = null;
  store.tenant = { isPkp: false, taxPercent: 0 };
  store.ws = {
    id: "ws1", jobId: null, status: "OPEN",
    customer: { id: "c1", topType: "CASH" },
    items: [
      { assetId: "a1", descSnapshot: "Cuci AC", category: "SERVICE", qty: 2, unit: "unit", unitPriceSnapshot: 75000, lineTotal: 150000 },
    ],
  };
});

describe("closeWorkSession", () => {
  it("CASH → Invoice (INV), total = subtotal (non-PKP)", async () => {
    const r = await closeWorkSession("t1", "ws1", "u1");
    expect(r.docType).toBe("INVOICE");
    expect(r.number.startsWith("INV/")).toBe(true);
    expect(Number(created.total)).toBe(150000);
    expect(created.cashRemitStatus).toBe("HELD_BY_TECH");
  });

  it("Tempo → Proforma (PRO) + dueDate terisi", async () => {
    store.ws.customer.topType = "TEMPO_30";
    const r = await closeWorkSession("t1", "ws1", "u1");
    expect(r.docType).toBe("PROFORMA");
    expect(r.number.startsWith("PRO/")).toBe(true);
    expect(created.dueDate).not.toBeNull();
    expect(created.cashRemitStatus).toBeNull();
  });

  it("PKP → PPN diterapkan", async () => {
    store.tenant = { isPkp: true, taxPercent: 11 };
    await closeWorkSession("t1", "ws1", "u1");
    expect(Number(created.ppnAmount)).toBe(16500); // 11% x 150000
    expect(Number(created.total)).toBe(166500);
  });

  it("sesi kosong → tolak", async () => {
    store.ws.items = [];
    await expect(closeWorkSession("t1", "ws1", "u1")).rejects.toThrow();
  });
});
