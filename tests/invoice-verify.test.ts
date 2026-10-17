import { describe, it, expect, vi, beforeEach } from "vitest";

// L3 (keputusan K4, 2026-10-17) — VERIFIKASI transfer/QRIS oleh owner/admin tenant.
//
// Kontrak pemilik: transfer/QRIS yang ditandai lunas oleh TEKNISI di lapangan BELUM
// dihitung sebagai penerimaan — harus menunggu owner/admin tenant memastikan dana
// benar-benar masuk rekening (antisipasi bukti fiktif pelanggan). Penandaan lunas oleh
// ADMIN/OWNER sendiri sudah berarti terverifikasi (uangnya dilihat masuk kantor).
// CASH tidak lewat jalur ini — verifikasinya = pencatatan setoran (L2).

vi.mock("@/lib/prisma", () => {
  const state = {
    invoice: null as any,
    updated: { count: 1 },
    updateManyArgs: null as any,
  };
  return {
    __state: state,
    prisma: {
      invoice: {
        findFirst: vi.fn(async () => state.invoice),
        updateMany: vi.fn(async (args: any) => {
          state.updateManyArgs = args;
          return state.updated;
        }),
        update: vi.fn(async () => ({})),
      },
    },
  };
});

import * as prismaModule from "@/lib/prisma";
import { markInvoicePaid, verifyInvoicePayment } from "@/lib/services/invoice-service";

const state = (prismaModule as any).__state;

const TECH = { userId: "tech-1", role: "TECHNICIAN" as const };
const ADMIN = { userId: "admin-1", role: "ADMIN" as const };

beforeEach(() => {
  vi.clearAllMocks();
  state.invoice = { id: "inv-1", docType: "INVOICE", status: "ISSUED", createdById: "tech-1" };
  state.updated = { count: 1 };
  state.updateManyArgs = null;
});

describe("L3 — penandaan lunas oleh TEKNISI (transfer/QRIS) belum terverifikasi", () => {
  it("teknisi + TRANSFER → status lunas TAPI belum terverifikasi (menunggu verifikasi)", async () => {
    await markInvoicePaid("t1", "inv-1", "TRANSFER", undefined, TECH);
    expect(state.updateManyArgs.data.status).toBe("PAID");
    expect(state.updateManyArgs.data.verifiedAt).toBeNull();
    expect(state.updateManyArgs.data.verifiedById).toBeNull();
  });

  it("teknisi + QRIS → belum terverifikasi", async () => {
    await markInvoicePaid("t1", "inv-1", "QRIS", undefined, TECH);
    expect(state.updateManyArgs.data.verifiedAt).toBeNull();
  });

  it("teknisi + CASH → tetap tanpa verifikasi (jalurnya lewat setoran, L2)", async () => {
    await markInvoicePaid("t1", "inv-1", "CASH", undefined, TECH);
    expect(state.updateManyArgs.data.verifiedAt).toBeNull();
    expect(state.updateManyArgs.data.verifiedById).toBeNull();
    expect(state.updateManyArgs.data.cashRemitStatus).toBe("HELD_BY_TECH");
  });
});

describe("L3 — penandaan lunas oleh ADMIN/OWNER sudah terverifikasi", () => {
  it("admin + TRANSFER → langsung terverifikasi, mencatat SIAPA & KAPAN", async () => {
    await markInvoicePaid("t1", "inv-1", "TRANSFER", undefined, ADMIN);
    const d = state.updateManyArgs.data;
    expect(d.verifiedAt).toBeInstanceOf(Date);
    expect(d.verifiedById).toBe("admin-1");
  });

  it("admin + QRIS → langsung terverifikasi", async () => {
    await markInvoicePaid("t1", "inv-1", "QRIS", undefined, ADMIN);
    expect(state.updateManyArgs.data.verifiedById).toBe("admin-1");
  });

  it("admin + CASH → TIDAK mengisi verifikasi (tunai = jalur setoran)", async () => {
    await markInvoicePaid("t1", "inv-1", "CASH", undefined, ADMIN);
    expect(state.updateManyArgs.data.verifiedAt).toBeNull();
    expect(state.updateManyArgs.data.verifiedById).toBeNull();
  });
});

describe("L3 — verifyInvoicePayment (owner/admin tenant memverifikasi dana masuk rekening)", () => {
  it("menandai terverifikasi + mencatat siapa & kapan, hanya utk baris yang berhak", async () => {
    state.invoice = { id: "inv-1", docType: "INVOICE", status: "PAID", payMethod: "TRANSFER", verifiedAt: null, createdById: "tech-1" };
    await verifyInvoicePayment("t1", "inv-1", "admin-1");
    const q = state.updateManyArgs;
    expect(q.where).toMatchObject({ id: "inv-1", tenantId: "t1", docType: "INVOICE", status: "PAID", verifiedAt: null });
    expect(q.data.verifiedById).toBe("admin-1");
    expect(q.data.verifiedAt).toBeInstanceOf(Date);
  });

  it("atomics: penandaan ganda tidak menghasilkan catatan kedua (guard verifikasi di WHERE)", async () => {
    state.invoice = { id: "inv-1", docType: "INVOICE", status: "PAID", payMethod: "QRIS", verifiedAt: null, createdById: "tech-1" };
    await verifyInvoicePayment("t1", "inv-1", "admin-1");
    expect(state.updateManyArgs.where).toHaveProperty("verifiedAt", null);
  });

  it("CASH DITOLAK — verifikasi uang tunai adalah pencatatan setoran, bukan aksi ini", async () => {
    state.invoice = { id: "inv-1", docType: "INVOICE", status: "PAID", payMethod: "CASH", verifiedAt: null, createdById: "tech-1" };
    await expect(verifyInvoicePayment("t1", "inv-1", "admin-1")).rejects.toThrow(/tunai|setoran/i);
    expect(state.updateManyArgs).toBeNull();
  });

  it("invoice belum lunas DITOLAK — belum ada uang untuk diverifikasi", async () => {
    state.invoice = { id: "inv-1", docType: "INVOICE", status: "ISSUED", payMethod: null, verifiedAt: null, createdById: "tech-1" };
    await expect(verifyInvoicePayment("t1", "inv-1", "admin-1")).rejects.toThrow(/lunas/i);
    expect(state.updateManyArgs).toBeNull();
  });

  it("invoice tenant lain / tidak ada DITOLAK", async () => {
    state.invoice = null;
    await expect(verifyInvoicePayment("t1", "inv-x", "admin-1")).rejects.toThrow(/tidak ditemukan/i);
  });

  it("sudah terverifikasi → tidak menimpa catatan verifikasi yang ada", async () => {
    state.invoice = { id: "inv-1", docType: "INVOICE", status: "PAID", payMethod: "TRANSFER", verifiedAt: new Date("2026-10-17T00:00:00Z"), createdById: "tech-1" };
    await expect(verifyInvoicePayment("t1", "inv-1", "admin-1")).rejects.toThrow(/sudah diverifikasi/i);
    expect(state.updateManyArgs).toBeNull();
  });
});
