import { describe, it, expect, vi, beforeEach } from "vitest";

// L9 (2026-10-18) — Riwayat penerimaan per bulan: kartu "Penerimaan Bulan Ini" terkunci
// pada bulan berjalan, sehingga tenant TIDAK BISA melihat penerimaan bulan-bulanan sebelumnya
// (celah yang ditanyakan pemilik). Penerimaan = ARUS menurut jejak (K1/K11):
//   - tunai + REMITTED + remittedAt → bulan remittedAt
//   - transfer/QRIS + verifiedAt     → bulan verifiedAt
//   - baris TANPA jejak              → TIDAK masuk riwayat (mengarang bulan = dilarang)
// Kelompokkan MENURUT ZONA TENANT (K7) — sama dengan kartu.
//
// Model pemanggil dikeluarkan saat arus dibaca (pola: pembacaan sekali, kelompok di service).

vi.mock("@/lib/prisma", () => {
  const state = { invoices: [] as any[] };
  return {
    __state: state,
    prisma: {
      invoice: {
        findMany: vi.fn(async () => state.invoices),
      },
    },
  };
});

import * as prismaModule from "@/lib/prisma";
import { getReceiptHistory } from "@/lib/services/ar-service";

const state = (prismaModule as any).__state;

const paid = (o: Partial<any>) => ({
  tenantId: "t1", docType: "INVOICE", status: "PAID", total: 0,
  payMethod: "CASH", cashRemitStatus: null, remittedAt: null, verifiedAt: null,
  ...o,
});

beforeEach(() => { vi.clearAllMocks(); state.invoices = []; });

describe("L9 — getReceiptHistory (riwayat penerimaan per bulan, zona tenant)", () => {
  const tz = "Asia/Jakarta";

  it("tunai direkap pada bulan remittedAt; transfer/QRIS pada bulan verifiedAt", async () => {
    state.invoices = [
      // Agustus (demi keterbacaan: pakai instan sudah +07:00)
      paid({ id: "a", total: 100000, cashRemitStatus: "REMITTED", remittedAt: new Date("2026-08-10T10:00:00+07:00") }),
      paid({ id: "b", total: 50000, payMethod: "TRANSFER", verifiedAt: new Date("2026-08-20T10:00:00+07:00") }),
      // September
      paid({ id: "c", total: 75000, cashRemitStatus: "REMITTED", remittedAt: new Date("2026-09-05T10:00:00+07:00") }),
      // Oktober (bulan ini)
      paid({ id: "d", total: 25000, cashRemitStatus: "REMITTED", remittedAt: new Date("2026-10-02T10:00:00+07:00") }),
    ];
    const rows = await getReceiptHistory("t1", tz);
    expect(rows.map((r) => r.month)).toEqual(["2026-08", "2026-09", "2026-10"]); // terlama → terbaru
    expect(rows[0]).toMatchObject({ month: "2026-08", total: 150000, count: 2 });
    expect(rows[1]).toMatchObject({ month: "2026-09", total: 75000, count: 1 });
    expect(rows[2]).toMatchObject({ month: "2026-10", total: 25000, count: 1 });
  });

  // KETERBATASAN JUJUR (data live 2026-10-18: 0 baris berjejak di seluruh DB):
  // baris tanpa jejak TIDAK boleh ditempatkan ke bulan mana pun — itu mengarang tanggal.
  it("baris TANPA jejak TIDAK masuk riwayat — tidak pernah dikarang bulannya", async () => {
    state.invoices = [
      paid({ id: "held", total: 300000, cashRemitStatus: "HELD_BY_TECH" }),                 // menunggu setoran
      paid({ id: "noverif", total: 400000, payMethod: "QRIS", verifiedAt: null }),          // menunggu verifikasi
      paid({ id: "legacy", total: 500000, cashRemitStatus: "REMITTED", remittedAt: null }), // disetor tanpa jejak (M7)
      paid({ id: "ok", total: 60000, cashRemitStatus: "REMITTED", remittedAt: new Date("2026-06-15T10:00:00+07:00") }),
    ];
    const rows = await getReceiptHistory("t1", tz);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ month: "2026-06", total: 60000, count: 1 });
  });

  it("hanya invoice lunas milik tenant (guard di query)", async () => {
    state.invoices = [];
    await getReceiptHistory("t1", tz);
    const q = vi.mocked(prismaModule.prisma.invoice.findMany).mock.calls[0][0] as any;
    expect(q.where).toMatchObject({ tenantId: "t1", docType: "INVOICE", status: "PAID" });
    // K2/K11: riwayat adalah ARUS penerimaan → wajib memilih kolom jejak, bukan paidAt
    expect(q.select).toMatchObject({ remittedAt: true, verifiedAt: true, payMethod: true, total: true });
    expect(q.select.paidAt).toBeUndefined();
  });

  it("gilir bulan jejak 00.30 WIB tanggal 1 → bulan BERJALAN (zona tenant, bukan zona server)", async () => {
    state.invoices = [
      paid({ id: "subuh", total: 90000, cashRemitStatus: "REMITTED", remittedAt: new Date("2026-10-01T00:30:00+07:00") }),
      paid({ id: "sebelum", total: 10000, cashRemitStatus: "REMITTED", remittedAt: new Date("2026-09-30T22:00:00+07:00") }),
    ];
    const rows = await getReceiptHistory("t1", tz);
    expect(rows.map((r) => r.month)).toEqual(["2026-09", "2026-10"]);
    expect(rows[1].total).toBe(90000);
    // Bukti anti-fosil: zona server (UTC) akan menaruh pembayaran subuh itu ke September.
    expect(rows.find((r) => r.month === "2026-10")!.total).toBe(90000);
  });

  it("riwayat kosong → [] (halaman menampilkan empty-state, bukan baris karangan)", async () => {
    expect(await getReceiptHistory("t1", tz)).toEqual([]);
  });
});

// ── Kontrak HALAMAN (L9) — baca sumber (pola yang sudah ada di tests/money-position-label) ──
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

describe("L9 — halaman laporan menyajikan riwayat penerimaan", () => {
  const s = read("src/app/app/laporan/page.tsx");

  it("memanggil getReceiptHistory dengan zona tenant (satu sumber zona, bukan zona server)", () => {
    expect(s).toContain("getReceiptHistory");
    expect(s).toMatch(/getReceiptHistory\([^)]*timezone/);
  });

  it("menampilkan kartu riwayat dengan total per bulan + detail yang bisa dibuka", () => {
    expect(s).toContain("Riwayat Penerimaan");
    // Expand baris = <details> (pola existing src/app/app/pengingat/inbox.tsx),
    // BUKAN komponen client baru (aturan 11).
    expect(s).toContain("<details");
    expect(s).toContain(".items");
  });

  // Aturan 15 (kamera helikopter): kartu Penerimaan kini punya tujuan akhir "semua
  // tercatat". Saat Rp0 teks harus menjelaskan KENAPA, bukan sekadar "0 invoice".
  it("sub-label kartu Penerimaan kondisional — Rp0 menjelaskan kenapa", () => {
    expect(s).toMatch(/pos\.penerimaan\.count\s*>\s*0/);
    expect(s).toContain("tercatat bulan ini");
  });
});
