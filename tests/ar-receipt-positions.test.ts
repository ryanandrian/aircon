import { describe, it, expect, vi, beforeEach } from "vitest";

// L4 (keputusan K1/K3/K4, 2026-10-17) — kartu "Penerimaan" dipecah 3 posisi uang.
// Sebelumnya: satu angka = semua invoice PAID (uang di kantor campur uang di
// teknisi campur transfer belum diverifikasi) → F-01/M1.
//
// KONTRAK:
//  - menungguSetoran : CASH lunas, belum disetor (dana fisik dipegang teknisi)
//  - menungguVerifikasi : TRANSFER/QRIS lunas, belum diverifikasi owner/admin (K4)
//  - penerimaan      : uang SUDAH dihitung masuk = setoran tercatat (REMITTED) +
//                      transfer/QRIS terverifikasi (verifiedAt terisi)

vi.mock("@/lib/prisma", () => {
  const state = { invoices: [] as any[] };
  return {
    __state: state,
    prisma: {
      invoice: {
        findMany: vi.fn(async ({ where }: any) =>
          state.invoices.filter((i) => {
            if (where?.tenantId && i.tenantId !== where.tenantId) return false;
            if (where?.docType && i.docType !== where.docType) return false;
            if (where?.status && i.status !== where.status) return false;
            // Periode: paidAt dalam rentang [gte, lte].
            if (where?.paidAt?.gte && i.paidAt < where.paidAt.gte) return false;
            if (where?.paidAt?.lte && i.paidAt > where.paidAt.lte) return false;
            return true;
          })),
      },
    },
  };
});

import * as prismaModule from "@/lib/prisma";
import { getReceiptPositions } from "@/lib/services/ar-service";

const state = (prismaModule as any).__state;
const t0 = new Date("2026-10-01T00:00:00Z");
const t1 = new Date("2026-10-31T23:59:59Z");

const inv = (o: Partial<any>) => ({
  tenantId: "t1", docType: "INVOICE", status: "PAID", paidAt: new Date("2026-10-10T00:00:00Z"),
  total: 0, payMethod: null, cashRemitStatus: null, verifiedAt: null, remittedAt: null,
  ...o,
});

beforeEach(() => { vi.clearAllMocks(); state.invoices = []; });

describe("L4 — getReceiptPositions (3 posisi uang)", () => {
  it("uang tunai lunas BELUM disetor → menunggu setoran, BUKAN penerimaan", async () => {
    state.invoices = [inv({ id: "a", payMethod: "CASH", cashRemitStatus: "HELD_BY_TECH", total: 50000 })];
    const r = await getReceiptPositions("t1", t0, t1);
    expect(r.penerimaan.total).toBe(0);
    expect(r.menungguSetoran.total).toBe(50000);
    expect(r.menungguVerifikasi.total).toBe(0);
    expect(r.totalKotor).toBe(50000);
  });

  it("uang tunai SUDAH disetor (REMITTED) → penerimaan", async () => {
    state.invoices = [inv({ id: "b", payMethod: "CASH", cashRemitStatus: "REMITTED", total: 70000 })];
    const r = await getReceiptPositions("t1", t0, t1);
    expect(r.penerimaan.total).toBe(70000);
    expect(r.menungguSetoran.total).toBe(0);
  });

  it("TRANSFER lunas BELUM diverifikasi → menunggu verifikasi, BUKAN penerimaan", async () => {
    state.invoices = [inv({ id: "c", payMethod: "TRANSFER", verifiedAt: null, total: 90000 })];
    const r = await getReceiptPositions("t1", t0, t1);
    expect(r.penerimaan.total).toBe(0);
    expect(r.menungguVerifikasi.total).toBe(90000);
    expect(r.menungguSetoran.total).toBe(0);
  });

  it("TRANSFER lunas SUDAH diverifikasi → penerimaan", async () => {
    state.invoices = [inv({ id: "d", payMethod: "TRANSFER", verifiedAt: new Date(), total: 110000 })];
    const r = await getReceiptPositions("t1", t0, t1);
    expect(r.penerimaan.total).toBe(110000);
    expect(r.menungguVerifikasi.total).toBe(0);
  });

  it("identitas rekonsiliasi: total kotor = penerimaan + menunggu setoran + menunggu verifikasi", async () => {
    state.invoices = [
      inv({ id: "1", payMethod: "CASH", cashRemitStatus: "HELD_BY_TECH", total: 10000 }),
      inv({ id: "2", payMethod: "CASH", cashRemitStatus: "REMITTED", total: 20000 }),
      inv({ id: "3", payMethod: "QRIS", verifiedAt: null, total: 30000 }),
      inv({ id: "4", payMethod: "QRIS", verifiedAt: new Date(), total: 40000 }),
      inv({ id: "5", payMethod: "TRANSFER", verifiedAt: null, total: 50000 }),
    ];
    const r = await getReceiptPositions("t1", t0, t1);
    expect(r.totalKotor).toBe(150000);
    expect(r.penerimaan.total + r.menungguSetoran.total + r.menungguVerifikasi.total).toBe(r.totalKotor);
    expect(r.penerimaan.total).toBe(60000);
    expect(r.menungguSetoran.total).toBe(10000);
    expect(r.menungguVerifikasi.total).toBe(80000);
  });

  it("hanya invoice tenant & periode itu (guard filter)", async () => {
    state.invoices = [inv({ id: "x", payMethod: "CASH", cashRemitStatus: "HELD_BY_TECH", total: 5000 })];
    await getReceiptPositions("t1", t0, t1);
    const q = vi.mocked(prismaModule.prisma.invoice.findMany).mock.calls[0][0] as any;
    expect(q.where).toMatchObject({ tenantId: "t1", docType: "INVOICE", status: "PAID" });
    expect(q.where.paidAt).toMatchObject({ gte: t0, lte: t1 });
  });

  it("jumlah invoice ikut tiap posisi (untuk sub-label kartu)", async () => {
    state.invoices = [
      inv({ id: "a", payMethod: "CASH", cashRemitStatus: "HELD_BY_TECH", total: 1000 }),
      inv({ id: "b", payMethod: "CASH", cashRemitStatus: "REMITTED", total: 2000 }),
    ];
    const r = await getReceiptPositions("t1", t0, t1);
    expect(r.menungguSetoran.count).toBe(1);
    expect(r.penerimaan.count).toBe(1);
  });
});
