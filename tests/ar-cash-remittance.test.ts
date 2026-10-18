import { describe, it, expect, vi, beforeEach } from "vitest";

// F9f/D2 — K17 kas teknisi (uji service EXISTING ar-service, no new code path).
// L2 (keputusan K5, 2026-10-17): setoran kini MENINGGALKAN JEJAK — waktu setoran,
// admin penerima, dan foto bukti. Setoran tanpa bukti/penerima DITOLAK.

vi.mock("@/lib/prisma", () => {
  const state = {
    invoices: [] as any[],
    users: [] as any[],
    updateManyResult: { count: 0 },
    updateManyArgs: null as any,
    transactionCalls: [] as any[],
  };
  const prisma: any = {
    invoice: {
      findMany: vi.fn(async ({ where }: any) =>
        state.invoices.filter((i) =>
          (!where?.tenantId || i.tenantId === where.tenantId) &&
          (!where?.docType || i.docType === where.docType) &&
          (!where?.status || i.status === where.status) &&
          (!where?.payMethod || i.payMethod === where.payMethod) &&
          (!where?.cashRemitStatus || i.cashRemitStatus === where.cashRemitStatus))),
      updateMany: vi.fn(async (args: any) => {
        state.updateManyArgs = args;
        return state.updateManyResult;
      }),
    },
    user: { findMany: vi.fn(async ({ where }: any) => state.users.filter((u) => where.id.in.includes(u.id))) },
    // Interactive transaction: jalankan callback dengan client yang sama (cukup utk unit test).
    $transaction: vi.fn(async (fn: any) => {
      state.transactionCalls.push(fn);
      return fn(prisma);
    }),
  };
  return { __state: state, prisma };
});

import * as prismaModule from "@/lib/prisma";
import { getUnremittedCashByHolder, getRemittances, markCashRemitted } from "@/lib/services/ar-service";

const state = (prismaModule as any).__state;

beforeEach(() => {
  vi.clearAllMocks();
  state.invoices = [
    { id: "cash-held", tenantId: "t1", docType: "INVOICE", status: "PAID", payMethod: "CASH", cashRemitStatus: "HELD_BY_TECH", createdById: "tech-1", number: "INV-CASH", total: 50000 },
    { id: "cash-remitted", tenantId: "t1", docType: "INVOICE", status: "PAID", payMethod: "CASH", cashRemitStatus: "REMITTED", createdById: "tech-1", number: "INV-REM", total: 10000 },
    { id: "transfer-stale", tenantId: "t1", docType: "INVOICE", status: "PAID", payMethod: "TRANSFER", cashRemitStatus: "HELD_BY_TECH", createdById: "tech-1", number: "INV-TR", total: 70000 },
    { id: "qris-stale", tenantId: "t1", docType: "INVOICE", status: "PAID", payMethod: "QRIS", cashRemitStatus: "HELD_BY_TECH", createdById: "tech-1", number: "INV-Q", total: 80000 },
    { id: "unpaid-cash", tenantId: "t1", docType: "INVOICE", status: "ISSUED", payMethod: "CASH", cashRemitStatus: "HELD_BY_TECH", createdById: "tech-1", number: "INV-U", total: 90000 },
    { id: "proforma", tenantId: "t1", docType: "PROFORMA", status: "PAID", payMethod: "CASH", cashRemitStatus: "HELD_BY_TECH", createdById: "tech-1", number: "PRO-1", total: 30000 },
    { id: "other-tenant", tenantId: "t2", docType: "INVOICE", status: "PAID", payMethod: "CASH", cashRemitStatus: "HELD_BY_TECH", createdById: "tech-2", number: "INV-OTHER", total: 40000 },
  ];
  state.users = [{ id: "tech-1", name: "Ryan" }];
  state.updateManyResult = { count: 1 };
  state.updateManyArgs = null;
  state.transactionCalls = [];
});

describe("F9f/M9 — getUnremittedCashByHolder (K17)", () => {
  it("hanya PAID+CASH+HELD_BY_TECH INVOICE tenant itu dihitung — TRANSFER/QRIS tak pernah tampil", async () => {
    const r = await getUnremittedCashByHolder("t1");
    expect(r).toEqual([{ holderId: "tech-1", holderName: "Ryan", holderRole: null, total: 50000, count: 1, invoiceIds: ["cash-held"] }]);
  });

  it("query K17 punya filter tenant+INVOICE+PAID+CASH+HELD_BY_TECH (guard di DB query)", async () => {
    await getUnremittedCashByHolder("t1");
    const q = vi.mocked(prismaModule.prisma.invoice.findMany).mock.calls[0][0] as any;
    expect(q.where).toMatchObject({ tenantId: "t1", docType: "INVOICE", status: "PAID", payMethod: "CASH", cashRemitStatus: "HELD_BY_TECH" });
  });
});

describe("L2 — markCashRemitted: setoran meninggalkan jejak (K5)", () => {
  // Jejak setoran: admin penerima (admin tenant bisa >1) + foto bukti + waktu.
  const details = { receiverId: "admin-1", proofUrl: "https://s3.example/tenants/t1/bukti/x.jpg", at: new Date("2026-10-17T10:00:00Z") };

  it("ditandai REMITTED + MENULIS jejak (penerima, bukti, waktu) hanya row PAID+CASH+HELD_BY_TECH dalam tenant", async () => {
    const n = await markCashRemitted("t1", ["cash-held"], details);
    expect(n).toBe(1);
    const q = state.updateManyArgs.where;
    expect(q).toMatchObject({ tenantId: "t1", id: { in: ["cash-held"] }, docType: "INVOICE", status: "PAID", payMethod: "CASH", cashRemitStatus: "HELD_BY_TECH" });
    expect(state.updateManyArgs.data).toEqual({
      cashRemitStatus: "REMITTED",
      remittedAt: details.at,
      remittedById: "admin-1",
      remitProofUrl: details.proofUrl,
    });
  });

  // M7/koreksi (2026-10-18): SEBELUM diperbaiki, 0 baris kembali 0 DIAM-DIAM dan
  // action melaporkan sukses → pemilik mengira setoran tercatat, ternyata tidak ada
  // data berubah. Sekarang: jumlah yang berubah ≠ jumlah yang diminta → DITOLAK.
  it("sebagian id tidak memenuhi syarat (sudah disetor / bukan tunai) → DITOLAK, bukan sukses senyap", async () => {
    state.updateManyResult = { count: 1 }; // 1 dari 2 id yang diminta terkena
    await expect(markCashRemitted("t1", ["cash-held", "cash-remitted"], details))
      .rejects.toThrow(/menunggu setoran/i);
    expect(state.transactionCalls).toHaveLength(1); // dibuka lalu dibatalkan (rollback)
  });

  it("nol baris terkena (semua id sudah punya jejak) → DITOLAK, bukan kembali 0", async () => {
    state.updateManyResult = { count: 0 };
    await expect(markCashRemitted("t1", ["cash-held"], details)).rejects.toThrow(/menunggu setoran/i);
  });

  it("input kosong → tak membuat query update", async () => {
    const n = await markCashRemitted("t1", [], details);
    expect(n).toBe(0);
    expect(prismaModule.prisma.invoice.updateMany).not.toHaveBeenCalled();
  });

  it("DITOLAK tanpa foto bukti — setoran wajib berbukti (K5)", async () => {
    await expect(markCashRemitted("t1", ["cash-held"], { ...details, proofUrl: "" }))
      .rejects.toThrow(/bukti/i);
    expect(prismaModule.prisma.invoice.updateMany).not.toHaveBeenCalled();
  });

  it("DITOLAK tanpa admin penerima — setoran wajib mencatat siapa yang menerima (K5)", async () => {
    await expect(markCashRemitted("t1", ["cash-held"], { ...details, receiverId: "" }))
      .rejects.toThrow(/penerima/i);
    expect(prismaModule.prisma.invoice.updateMany).not.toHaveBeenCalled();
  });

  it("berjalan ATOMIK dalam satu transaksi — kegagalan di tengah tidak meninggalkan status setengah jadi", async () => {
    await expect(markCashRemitted("t1", ["cash-held"], { ...details, proofUrl: "" }))
      .rejects.toThrow(/bukti/i);
    expect(state.transactionCalls).toHaveLength(0); // gagal validasi sebelum transaksi dibuka
  });
});

describe("L5 — getRemittances (laporan tracing setoran untuk owner tenant, K5)", () => {
  it("mengambil setoran tercatat lengkap dengan jejak: penerima, bukti, waktu — beserta teknisi pemegang", async () => {
    state.invoices = [
      { id: "inv-1", tenantId: "t1", docType: "INVOICE", status: "PAID", payMethod: "CASH",
        cashRemitStatus: "REMITTED", createdById: "tech-1", number: "INV/1", total: 50000,
        paidAt: new Date("2026-10-14T10:00:00Z"), remittedAt: new Date("2026-10-17T10:00:00Z"),
        remittedById: "admin-1", remitProofUrl: "https://s3.example/tenants/t1/bukti/x.jpg" },
      { id: "inv-2", tenantId: "t1", docType: "INVOICE", status: "PAID", payMethod: "CASH",
        cashRemitStatus: "REMITTED", createdById: "tech-1", number: "INV/2", total: 70000,
        paidAt: new Date("2026-10-15T10:00:00Z"), remittedAt: null, remittedById: null, remitProofUrl: null },
    ];
    state.users = [{ id: "tech-1", name: "Ryan" }, { id: "admin-1", name: "Budi" }];

    const rows = await getRemittances("t1");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      number: "INV/1", total: 50000,
      receiverName: "Budi", holderName: "Ryan",
      proofUrl: "https://s3.example/tenants/t1/bukti/x.jpg",
    });
    expect(rows[0].remittedAt).toBeInstanceOf(Date);
    expect(rows[0].paidAt).toBeInstanceOf(Date);
    // Setoran lama tanpa jejak tetap TAMPIL (bukan disembunyikan) — jejaknya kosong.
    expect(rows[1].remittedAt).toBeNull();
    expect(rows[1].receiverName).toBeNull();
  });

  it("hanya meminta baris milik tenant ini (guard tenant di query)", async () => {
    state.invoices = [];
    await getRemittances("t1");
    const q = vi.mocked(prismaModule.prisma.invoice.findMany).mock.calls.at(-1)![0] as any;
    expect(q.where).toMatchObject({ tenantId: "t1", cashRemitStatus: "REMITTED" });
  });

  // M8 (audit 2026-10-18): query hanya menyaring cashRemitStatus REMITTED — TANPA
  // filter metode. Nilai REMITTED pada invoice transfer/QRIS = sisa kode lama
  // (markInvoicePaid kini menulis null utk non-CASH) → 8 invoice transfer/QRIS
  // ikut tampil sebagai baris "Riwayat Setoran Kas" (Rp4.340.000 pada Jaya Mandiri).
  it("M8 — TRANSFER/QRIS ber-REMITTED (sisa kode lama) TIDAK tampil di Riwayat Setoran Kas", async () => {
    state.invoices = [
      { id: "c1", tenantId: "t1", docType: "INVOICE", status: "PAID", payMethod: "CASH",
        cashRemitStatus: "REMITTED", createdById: "tech-1", number: "INV/1", total: 50000,
        remittedAt: new Date("2026-10-17T10:00:00Z"), remittedById: null, remitProofUrl: null },
      { id: "t1", tenantId: "t1", docType: "INVOICE", status: "PAID", payMethod: "TRANSFER",
        cashRemitStatus: "REMITTED", createdById: "tech-1", number: "INV/2", total: 70000,
        remittedAt: null, remittedById: null, remitProofUrl: null },
      { id: "q1", tenantId: "t1", docType: "INVOICE", status: "PAID", payMethod: "QRIS",
        cashRemitStatus: "REMITTED", createdById: "tech-1", number: "INV/3", total: 80000,
        remittedAt: null, remittedById: null, remitProofUrl: null },
    ];
    const rows = await getRemittances("t1");
    expect(rows.map((r) => r.number)).toEqual(["INV/1"]);
  });

  it("M8 — query riwayat setoran menyaring TUNAI (guard di query)", async () => {
    state.invoices = [];
    await getRemittances("t1");
    const q = vi.mocked(prismaModule.prisma.invoice.findMany).mock.calls.at(-1)![0] as any;
    expect(q.where).toMatchObject({ tenantId: "t1", cashRemitStatus: "REMITTED", payMethod: "CASH" });
  });
});

// M9 (audit 2026-10-18): pengelompokan per createdById TIDAK memeriksa peran.
// Kasus live Jaya Mandiri: 7 dari 8 baris "Kas Belum Disetor" dipegang Pak Budi
// yang rolenya OWNER — kartu menyebutnya "teknisi".
describe("M9 — pemegang uang dijuluki menurut PERAN sebenarnya (bukan selalu teknisi)", () => {
  it("pemegang OWNER tampil berperan — bukan disebut teknisi", async () => {
    state.invoices = [
      { id: "a", tenantId: "t1", docType: "INVOICE", status: "PAID", payMethod: "CASH",
        cashRemitStatus: "HELD_BY_TECH", createdById: "owner-1", number: "INV/A", total: 100000 },
    ];
    state.users = [{ id: "owner-1", name: "Pak Budi", role: "OWNER" }];
    const r = await getUnremittedCashByHolder("t1");
    expect(r).toEqual([{ holderId: "owner-1", holderName: "Pak Budi", holderRole: "OWNER", total: 100000, count: 1, invoiceIds: ["a"] }]);
  });

  it("peran ikut diminta dari User (guard di query)", async () => {
    state.invoices = [
      { id: "a", tenantId: "t1", docType: "INVOICE", status: "PAID", payMethod: "CASH",
        cashRemitStatus: "HELD_BY_TECH", createdById: "owner-1", number: "INV/A", total: 100000 },
    ];
    await getUnremittedCashByHolder("t1");
    const q = vi.mocked(prismaModule.prisma.user.findMany).mock.calls.at(-1)![0] as any;
    expect(q.select).toMatchObject({ id: true, name: true, role: true });
  });
});
