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
    state.invoices = [inv({ id: "b", payMethod: "CASH", cashRemitStatus: "REMITTED", remittedAt: new Date("2026-10-15T00:00:00Z"), total: 70000 })];
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
    state.invoices = [inv({ id: "d", payMethod: "TRANSFER", verifiedAt: new Date("2026-10-15T00:00:00Z"), total: 110000 })];
    const r = await getReceiptPositions("t1", t0, t1);
    expect(r.penerimaan.total).toBe(110000);
    expect(r.menungguVerifikasi.total).toBe(0);
  });

  it("identitas rekonsiliasi: total kotor = penerimaan + menunggu setoran + menunggu verifikasi", async () => {
    state.invoices = [
      inv({ id: "1", payMethod: "CASH", cashRemitStatus: "HELD_BY_TECH", total: 10000 }),
      inv({ id: "2", payMethod: "CASH", cashRemitStatus: "REMITTED", remittedAt: new Date("2026-10-15T00:00:00Z"), total: 20000 }),
      inv({ id: "3", payMethod: "QRIS", verifiedAt: null, total: 30000 }),
      inv({ id: "4", payMethod: "QRIS", verifiedAt: new Date("2026-10-15T00:00:00Z"), total: 40000 }),
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
    // KOREKSI K11: TANPA filter periode — posisi uang adalah KEADAAN SEKARANG
    // (uang fisik di tangan teknisi tidak kedaluwarsa di akhir bulan).
    expect(q.where.paidAt).toBeUndefined();
  });

  it("jumlah invoice ikut tiap posisi (untuk sub-label kartu)", async () => {
    state.invoices = [
      inv({ id: "a", payMethod: "CASH", cashRemitStatus: "HELD_BY_TECH", total: 1000 }),
      inv({ id: "b", payMethod: "CASH", cashRemitStatus: "REMITTED", remittedAt: new Date("2026-10-15T00:00:00Z"), total: 2000 }),
    ];
    const r = await getReceiptPositions("t1", t0, t1);
    expect(r.menungguSetoran.count).toBe(1);
    expect(r.penerimaan.count).toBe(1);
  });

  it("KOREKSI K11: uang lunas BULAN LALU yang belum disetor TETAP tampil di Menunggu Setoran", () => {
    // Regression langsung dari laporan pemilik 2026-10-18: kartu (berperiode bulan)
    // menampilkan Rp225.000 sedangkan tabel (seluruh waktu) Rp2.855.000 — satu layar,
    // satu frasa, dua angka. Kartu menyembunyikan uang yang SEDANG dipegang teknisi.
    state.invoices = [
      inv({ id: "lama", payMethod: "CASH", cashRemitStatus: "HELD_BY_TECH", total: 2780000,
            paidAt: new Date("2026-07-10T00:00:00Z") }), // lunas 3 bulan lalu, belum disetor
      inv({ id: "baru", payMethod: "CASH", cashRemitStatus: "HELD_BY_TECH", total: 75000,
            paidAt: new Date("2026-10-16T00:00:00Z") }),
    ];
    return getReceiptPositions("t1", t0, t1).then((r) => {
      expect(r.menungguSetoran.total).toBe(2855000); // = tabel "Kas Belum Disetor per Pemegang Uang"
      expect(r.menungguSetoran.count).toBe(2);
    });
  });
});

// M7 / K13 (audit data live tenant Jaya Mandiri, 2026-10-18) — aturan kerja 13:
// bug ini LOLOS karena semua test sebelumnya memakai data jejak yang selalu terisi.
// Data nyata di produksi: invoice CASH berstatus REMITTED dengan remittedAt = null
// (disetor sebelum kolom jejak L2 ada; kolom nullable, migrasi tidak mengisi data lama).
describe("M7/K13 — tunai REMITTED tanpa jejak TIDAK boleh hilang dari laporan", () => {
  it("REMITTED tanpa remittedAt → masuk disetorTanpaJejak, BUKAN hilang, BUKAN penerimaan", async () => {
    state.invoices = [inv({ id: "lama", payMethod: "CASH", cashRemitStatus: "REMITTED", remittedAt: null, total: 500000 })];
    const r = await getReceiptPositions("t1", t0, t1);
    expect(r.disetorTanpaJejak.total).toBe(500000);
    expect(r.disetorTanpaJejak.count).toBe(1);
    expect(r.penerimaan.total).toBe(0);
    expect(r.menungguSetoran.total).toBe(0);
    expect(r.menungguVerifikasi.total).toBe(0);
  });

  it("identitas 4 posisi: penerimaan + menunggu setoran + menunggu verifikasi + tanpa jejak = total lunas", async () => {
    state.invoices = [
      inv({ id: "1", payMethod: "CASH", cashRemitStatus: "HELD_BY_TECH", total: 10000 }),
      inv({ id: "2", payMethod: "CASH", cashRemitStatus: "REMITTED", remittedAt: new Date("2026-10-15T00:00:00Z"), total: 20000 }),
      inv({ id: "3", payMethod: "CASH", cashRemitStatus: "REMITTED", remittedAt: null, total: 30000 }),
      inv({ id: "4", payMethod: "QRIS", verifiedAt: null, total: 40000 }),
      inv({ id: "5", payMethod: "TRANSFER", verifiedAt: new Date("2026-10-15T00:00:00Z"), total: 50000 }),
    ];
    const r = await getReceiptPositions("t1", t0, t1);
    expect(r.totalKotor).toBe(150000);
    expect(r.penerimaan.total + r.menungguSetoran.total + r.menungguVerifikasi.total + r.disetorTanpaJejak.total).toBe(r.totalKotor);
    expect(r.disetorTanpaJejak.total).toBe(30000);
  });

  it("angka kasus live Jaya Mandiri 2026-10-18: Rp3.800.000 tanpa jejak tampil (bukan Rp0)", async () => {
    // 7 invoice REMITTED tanpa jejak di produksi: 75.000 · 350.000 · 2.050.000 ·
    // 730.000 · 65.000 · 130.000 · 400.000 = Rp3.800.000
    const noTrace = [75000, 350000, 2050000, 730000, 65000, 130000, 400000];
    state.invoices = [
      ...noTrace.map((total, i) => inv({ id: `n${i}`, payMethod: "CASH", cashRemitStatus: "REMITTED", remittedAt: null, total })),
      inv({ id: "held1", payMethod: "CASH", cashRemitStatus: "HELD_BY_TECH", total: 2780000 }),
      inv({ id: "held2", payMethod: "CASH", cashRemitStatus: "HELD_BY_TECH", total: 75000 }),
      ...Array.from({ length: 17 }, (_, i) => inv({ id: `v${i}`, payMethod: "TRANSFER", verifiedAt: null, total: 100 })),
    ];
    const r = await getReceiptPositions("t1", t0, t1);
    expect(r.disetorTanpaJejak.total).toBe(3800000);
    expect(r.disetorTanpaJejak.count).toBe(7);
    expect(r.menungguSetoran.total).toBe(2855000);
    expect(r.menungguVerifikasi.total).toBe(1700);
    expect(r.penerimaan.total).toBe(0);
    expect(r.penerimaan.total + r.menungguSetoran.total + r.menungguVerifikasi.total + r.disetorTanpaJejak.total).toBe(r.totalKotor);
  });

  it("tunai dengan jejak lengkap TIDAK ikut posisi tanpa jejak (tidak dobel)", async () => {
    state.invoices = [inv({ id: "berjejak", payMethod: "CASH", cashRemitStatus: "REMITTED", remittedAt: new Date("2026-10-15T00:00:00Z"), total: 80000 })];
    const r = await getReceiptPositions("t1", t0, t1);
    expect(r.disetorTanpaJejak.total).toBe(0);
    expect(r.penerimaan.total).toBe(80000);
  });
});
