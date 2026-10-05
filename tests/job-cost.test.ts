import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Keputusan #1 — "Biaya" pada detail pekerjaan dihitung dari jalur biaya RESMI
 * yang sudah jalan (bukan angka baru / job.price):
 *   Daftar Layanan (standardPrice) + harga khusus pelanggan (CustomerPricing)
 *   → resolvePrice saat teknisi menambah pekerjaan (sesi kerja)
 *   → WorkItem.unitPriceSnapshot (di-snapshot)
 *   → computeInvoiceTotals → Invoice (INVOICE cash / PROFORMA tempo, by TOP pelanggan)
 *
 * Jalur baca ini sudah ada sebagai pola di repo:
 *   - worksession-service.closeWorkSession: invoice by jobId (jobId ditulis saat close)
 *   - technician-service: sesi by jobId → invoice by workSessionId
 *   - incentive-service: workItem by workSessionId
 *
 * Kontrak getJobCost(tenantId, jobId):
 * - tenant-scoped (sesi milik tenant lain tidak terbaca);
 * - belum ada sesi → null (belum ada pekerjaan tercatat, jangan menampilkan 0 seolah gratis);
 * - subtotal = Σ round(qty × unitPriceSnapshot) — formula yang SAMA dgn
 *   computeInvoiceTotals (bukan job.price);
 * - sudah ada invoice → tampilkan angka final invoice (subtotal/discount/total),
 *   karena itulah yang ditagihkan (cash/tempo);
 * - sesi OPEN (teknisi sedang mengerjakan) → subtotal = jumlah sementara, invoice null;
 * - tidak pernah membaca JobOrder.price (fakta audit: field itu tidak mengalir ke tagihan).
 */

const store: { sessions: any[]; invoices: any[] } = { sessions: [], invoices: [] };

vi.mock("@/lib/prisma", () => ({
  prisma: {
    workSession: {
      findMany: vi.fn(async ({ where }: any) =>
        store.sessions.filter(
          (s) => s.tenantId === where.tenantId && s.jobId === where.jobId,
        ),
      ),
    },
    invoice: {
      findMany: vi.fn(async ({ where }: any) =>
        store.invoices.filter(
          (i) => i.tenantId === where.tenantId && (where.jobId ? i.jobId === where.jobId : true),
        ),
      ),
    },
  },
}));

vi.mock("@/lib/storage/s3", () => ({
  // worksession-service import boundary only; getJobCost doesn't use photo functions
  isOwnedPhotoUrl: () => true,
}));
vi.mock("@/lib/services/invoice-service", () => ({
  // Tests target reading stored invoice totals, not invoice calculation.
  computeInvoiceTotals: vi.fn(), computeDueDate: vi.fn(), nextInvoiceNumber: vi.fn(),
}));

vi.mock("@/lib/services/customer-service", () => ({
  ServiceError: class ServiceError extends Error {
    code: string;
    constructor(code: string, message: string) { super(message); this.code = code; }
  },
  resolveBillingCustomer: vi.fn(),
}));

import { getJobCost } from "../src/lib/services/worksession-service";

beforeEach(() => {
  store.sessions = [];
  store.invoices = [];
});

describe("getJobCost — biaya resmi pekerjaan (keputusan #1)", () => {
  it("belum ada sesi → null (belum ada catatan biaya)", async () => {
    expect(await getJobCost("t1", "j-none")).toBeNull();
  });

  it("sesi OPEN: subtotal dari snapshot item (pekerjaan sedang dicatat)", async () => {
    store.sessions = [{
      id: "ws1", tenantId: "t1", jobId: "j1", status: "OPEN",
      items: [
        { qty: 1, unitPriceSnapshot: 75000 },  // CUC-075 standar
        { qty: 3, unitPriceSnapshot: 65000 },  // Servis Rutin
      ],
    }];
    const r = await getJobCost("t1", "j1");
    expect(r).not.toBeNull();
    expect(r!.subtotal).toBe(75000 + 3 * 65000); // 270000
    expect(r!.invoice).toBeNull(); // belum ditagihkan
  });

  it("sesi CLOSED + invoice INVOICE (cash): angka final invoice dipakai", async () => {
    store.sessions = [{
      id: "ws1", tenantId: "t1", jobId: "j1", status: "CLOSED",
      items: [{ qty: 1, unitPriceSnapshot: 75000 }],
    }];
    store.invoices = [{
      id: "inv1", tenantId: "t1", jobId: "j1", docType: "INVOICE", status: "ISSUED",
      subtotal: 75000, discountAmount: 5000, total: 75250, ppnAmount: 250,
    }];
    const r = await getJobCost("t1", "j1");
    expect(r!.invoice!.docType).toBe("INVOICE");
    expect(r!.invoice!.subtotal).toBe(75000);
    expect(r!.invoice!.discountAmount).toBe(5000);
    expect(r!.invoice!.total).toBe(75250); // final (setelah diskon + PPN)
    // subtotal item tetap dihitung utk konteks "pekerjaan"
    expect(r!.subtotal).toBe(75000);
  });

  it("invoice PROFORMA (tempo) dikenali sbg jenis tagihan", async () => {
    store.sessions = [{ id: "ws1", tenantId: "t1", jobId: "j1", status: "CLOSED", items: [] }];
    store.invoices = [{ id: "inv2", tenantId: "t1", jobId: "j1", docType: "PROFORMA", status: "ISSUED", subtotal: 100000, discountAmount: 0, total: 111000, ppnAmount: 11000 }];
    const r = await getJobCost("t1", "j1");
    expect(r!.invoice!.docType).toBe("PROFORMA");
    expect(r!.invoice!.total).toBe(111000);
  });

  it("tenant-scoped: sesi/invoice tenant lain tidak terbaca", async () => {
    store.sessions = [{ id: "wsX", tenantId: "T-ASING", jobId: "j1", status: "CLOSED", items: [{ qty: 1, unitPriceSnapshot: 999000 }] }];
    store.invoices = [{ id: "invX", tenantId: "T-ASING", jobId: "j1", docType: "INVOICE", status: "ISSUED", subtotal: 999000, discountAmount: 0, total: 999000 }];
    expect(await getJobCost("t1", "j1")).toBeNull();
  });

  it("semua sesi ≠ job ini → null", async () => {
    store.sessions = [{ id: "ws2", tenantId: "t1", jobId: "j-lain", status: "OPEN", items: [{ qty: 1, unitPriceSnapshot: 1000 }] }];
    expect(await getJobCost("t1", "j1")).toBeNull();
  });

  it("PEMBULATAN mengikuti computeInvoiceTotals (qty×harga dibulatkan per baris)", async () => {
    store.sessions = [{
      id: "ws3", tenantId: "t1", jobId: "j1", status: "OPEN",
      items: [{ qty: 1.5, unitPriceSnapshot: 33333 }], // Math.round(1.5*33333)=49999.5→50000
    }];
    const r = await getJobCost("t1", "j1");
    expect(r!.subtotal).toBe(Math.round(1.5 * 33333));
  });

  it("TIDAK PERNAH membaca job.price (harga resmi dari sesi/tagihan saja)", async () => {
    // hibrida: sesi ada dengan item 0 + invoice null → subtotal 0, bukan job.price
    store.sessions = [{ id: "ws4", tenantId: "t1", jobId: "j1", status: "CLOSED", items: [] }];
    const r = await getJobCost("t1", "j1");
    expect(r!.subtotal).toBe(0);
    expect(r!.invoice).toBeNull();
  });
});
