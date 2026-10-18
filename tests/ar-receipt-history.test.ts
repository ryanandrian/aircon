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
import { getReceiptHistory, summarizeReceiptHistory, exportReceiptHistoryCsv, receiptTrendPoints } from "@/lib/services/ar-service";
import { csvCell } from "@/lib/csv";

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
import { existsSync } from "node:fs";
import { resolve } from "node:path";
// Toleran terhadap berkas yang belum dibuat → kegagalan tampil sebagai assertion (RED
// yang terbaca), bukan ENOENT yang mematikan seluruh file test.
const read = (p: string) => (existsSync(resolve(process.cwd(), p)) ? readFileSync(resolve(process.cwd(), p), "utf8") : "");

describe("L9 — halaman laporan menyajikan riwayat penerimaan", () => {
  const s = read("src/app/app/laporan/page.tsx");

  it("memanggil getReceiptHistory dengan zona tenant (satu sumber zona, bukan zona server)", () => {
    expect(s).toContain("getReceiptHistory");
    // variabel zona tenant (tz) dikirim sebagai argumen ke-2 — bukan tanpa zona.
    expect(s).toMatch(/getReceiptHistory\([^,]+,\s*tz\)/);
    expect(s).toContain("const tz = tenantCfg?.timezone");
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

// ── L10/K16(b) — ringkasan riwayat: total tahun + perbandingan bulan lalu ──────────
// Pembagian nol DITOLAK EKSPLISIT: tanpa guard, 0 bulan lalu → Infinity/NaN yang
// bocor ke layar sebagai angka palsu (aturan 15: diuji pada kondisi akhir).
describe("L10 — summarizeReceiptHistory", () => {
  const h = (month: string, total: number, count = 1) => ({ month, total, count, items: [] as any[] });

  it("total tahun = jumlah bulan pada TAHUN yang ditunjuk, bukan tahun lain", () => {
    // 2025-12 (diluar), 2026-01, 2026-02 (2 baris = 50+150), 2027-01 (diluar)
    const rows = [h("2025-12", 100), h("2026-01", 200), h("2026-02", 50), h("2026-02", 150), h("2027-01", 999)];
    const s = summarizeReceiptHistory(rows, "2026-02");
    expect(s.totalYear).toBe(400); // 200 + (50+150) — tanpa 2025 & 2027, duplikat kunci dijumlahkan
    expect(s.thisMonth).toBe(200);
  });

  it("bulan ini = baris bulan terpilih; bulan lalu = shiftMonthKey (Des→Jan benar)", () => {
    const rows = [h("2025-12", 400), h("2026-01", 1000)];
    const s = summarizeReceiptHistory(rows, "2026-01");
    expect(s.thisMonth).toBe(1000);
    expect(s.prevMonth).toBe(400);
  });

  it("persen naik/turun dihitung dari bulan lalu", () => {
    const rows = [h("2026-04", 100), h("2026-05", 150), h("2026-06", 100)];
    const turun = summarizeReceiptHistory(rows, "2026-06");
    expect(turun.prevMonth).toBe(150); // Mei
    expect(turun.changePct).toBe(-33.3); // dibulatkan 1 desimal utk tampilan
    const naik = summarizeReceiptHistory(rows, "2026-05");
    expect(naik.prevMonth).toBe(100); // April
    expect(naik.changePct).toBe(50);
  });

  it("bulan lalu tanpa jejak (0) → changePct NULL — tanpa Infinity/NaN, tanpa kebohongan", () => {
    const rows = [h("2026-06", 100)];
    const s = summarizeReceiptHistory(rows, "2026-06");
    expect(s.prevMonth).toBe(0);
    expect(s.changePct).toBeNull();
  });

  it("bulan terpilih tanpa jejak → totalYear tetap tahun itu; tanpa NaN", () => {
    const rows = [h("2026-01", 250)];
    const s = summarizeReceiptHistory(rows, "2026-03");
    expect(s.thisMonth).toBe(0);
    expect(s.prevMonth).toBe(0);
    expect(s.totalYear).toBe(250);
    expect(s.changePct).toBeNull();
  });

  it("riwayat kosong → semua nol & changePct null (halaman menampilkan empty-state)", () => {
    const s = summarizeReceiptHistory([], "2026-03");
    expect(s).toMatchObject({ totalYear: 0, thisMonth: 0, prevMonth: 0, changePct: null });
  });
});

// ── L10/K16(c) — ekspor CSV penerimaan (pola exportCatalogCsv yang sudah ada) ───────
describe("L10 — exportReceiptHistoryCsv", () => {
  const h = (month: string, total: number, count: number, items: any[]) => ({ month, total, count, items });

  it("baris per bulan (terbaru dulu): bulan, total, jumlah invoice — header Indonesia", async () => {
    const csv = exportReceiptHistoryCsv([
      h("2026-01", 150000, 2, []),
      h("2026-02", 250000, 3, []),
    ], "Asia/Jakarta");
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("Bulan,Total,Jumlah Invoice");
    expect(lines[1]).toBe("Februari 2026,250000,3");
    expect(lines[2]).toBe("Januari 2026,150000,2");
  });

  it("tanpa baris → hanya header (bukan CSV kosong / bukan undefined)", async () => {
    const csv = exportReceiptHistoryCsv([], "Asia/Jakarta");
    expect(csv.split("\r\n")).toEqual(["Bulan,Total,Jumlah Invoice"]);
  });

  it("baris detail ikut bila diminta: nomor, pelanggan, metode, waktu diterima, jumlah", async () => {
    const item = {
      id: "i1", number: "INV/2026/0001", customerName: "PT \"A\", Tbk",
      total: 90000, payMethod: "CASH", receivedAt: new Date("2026-02-10T10:00:00+07:00"),
    };
    const csv = await exportReceiptHistoryCsv([h("2026-02", 90000, 1, [item])], "Asia/Jakarta", { detail: true });
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("Bulan,Total,Jumlah Invoice");
    expect(lines[1]).toBe("Februari 2026,90000,1");
    expect(lines[2]).toBe("INV/2026/0001,\"PT \"\"A\"\", Tbk\",CASH,10/02/2026,90000");
  });

  it("helper csvCell SATU sumber (src/lib/csv.ts) — koma/tanda kutip/kutip-ganda dirujuk", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("baris\nbaru")).toBe('"baris\nbaru"');
    expect(csvCell(123)).toBe("123");
  });
});

// ── L10/K16(a,b,c,d) — kontrak HALAMAN: pemilih bulan, ringkasan, ekspor, grafik ────
describe("L10 — halaman laporan: pemilih bulan & riwayat naik kelas", () => {
  const s = read("src/app/app/laporan/page.tsx");

  it("(a) membaca searchParams ?bulan= dan memvalidasi via parseMonthKey (URL rusak → bulan ini)", () => {
    expect(s).toContain("searchParams");
    expect(s).toContain("parseMonthKey");
  });

  it("(a) kartu Penerimaan & Insentif mengikuti BULAN TERPILIH (bukan new Date() tak terikat)", () => {
    // rentang berasal dari kunci bulan — zona tenant, bukan insten lokal
    expect(s).toContain("monthRangeForKey");
    // label bulan dari satu sumber (helper) — bukan fungsi lokal
    expect(s).toContain("monthKeyLabel");
    expect(s).not.toContain("const fmtMonth");
  });

  it("(a) posisi 'menunggu'/'disetor' TETAP seluruh waktu (K11 — tidak mengikuti bulan terpilih)", () => {
    // getReceiptPositions tetap memakai rentang BULAN INI utk penerimaan (arus),
    // sedangkan kedua posisi keadaan tidak memakai filter periode (sudah dibuktikan
    // tests/ar-receipt-positions.test.ts: where.paidAt undefined).
    expect(s).toContain("getReceiptPositions");
  });

  it("(b) ringkasan riwayat memakai summarizeReceiptHistory + menampilkan persen bila ada", () => {
    expect(s).toContain("summarizeReceiptHistory");
    expect(s).toContain("changePct");
  });

  it("(c) tombol ekspor memakai route existing /app/laporan/export dengan param bulan", () => {
    expect(s).toContain("/app/laporan/export");
    expect(s).toContain("bulan=");
  });

  it("(d) grafik tren 12 bulan memakai komponen chart existing (ReceiptTrendChart)", () => {
    expect(s).toContain("ReceiptTrendChart");
    expect(s).toContain("../_components/receipt-trend-chart"); // pola serviced-trend-chart
  });
});

// Kontrak komponen grafik: wajib pakai pustaka chart yang sudah ada (bukan bespoke).
describe("L10 — receipt-trend-chart", () => {
  const s = read("src/app/app/_components/receipt-trend-chart.tsx");
  it("memakai ChartContainer ui/chart + recharts (jalur yang sudah ada)", () => {
    expect(s).toContain("@/components/ui/chart");
    expect(s).toContain("recharts");
    expect(s).toContain("ChartContainer");
  });
  it('pola identik serviced-trend-chart: "use client" + empty-state saat data kosong', () => {
    expect(s.startsWith("\"use client\"")).toBe(true);
    expect(s).toContain("Belum ada");
  });
});

// ── L10/K16(d) — titik grafik tren 12 bulan (murni, dari history yang sudah dibaca) ──
describe("L10 — receiptTrendPoints (grafik 12 bulan)", () => {
  const h = (month: string, total: number) => ({ month, total, count: 1, items: [] as any[] });

  it("tepat 12 titik berakhir pada bulan terpilih, urut menaik, lintas tahun benar", () => {
    const pts = receiptTrendPoints([], "2026-03", "Asia/Jakarta");
    expect(pts).toHaveLength(12);
    expect(pts[11].month).toBe("2026-03");
    expect(pts[0].month).toBe("2025-04"); // 12 titik berakhir 2026-03
    const months = pts.map((p) => p.month);
    expect(months[months.length - 2]).toBe("2026-02");
  });

  it("bulan TANPA jejak = 0 (fakta), bulan berjejak = totalnya", () => {
    const pts = receiptTrendPoints([h("2026-01", 500000), h("2026-03", 250000)], "2026-03", "Asia/Jakarta");
    const by = new Map(pts.map((p) => [p.month, p.value]));
    expect(by.get("2026-01")).toBe(500000);
    expect(by.get("2026-02")).toBe(0);   // tanpa jejak → 0 penerimaan tercatat
    expect(by.get("2026-03")).toBe(250000);
    expect(by.get("2025-12")).toBe(0);
  });

  it("bulan di LUAR jendela 12 bulan tidak ikut (bukan total silang-periode)", () => {
    const pts = receiptTrendPoints([h("2025-01", 999), h("2026-03", 100)], "2026-03", "Asia/Jakarta");
    expect(pts.every((p) => p.value !== 999)).toBe(true);
    expect(pts.reduce((s, p) => s + p.value, 0)).toBe(100);
  });

  it("label sumbu pendek; Januari membawa tahun 2 digit (penanda lintas tahun)", () => {
    const pts = receiptTrendPoints([], "2026-03", "Asia/Jakarta");
    expect(pts[11].label).toBe("Mar");
    const jan = pts.find((p) => p.month.endsWith("-01"));
    expect(jan?.label).toMatch(/^Jan \d{2}$/);
  });
});
