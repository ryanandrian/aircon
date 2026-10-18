import { describe, it, expect } from "vitest";
// L1 (keputusan K7, 2026-10-17) — penanggalan tenant menurut zona waktu TENANT, bukan
// zona server (fakta M5). Murni: tanpa DB, tanpa jaringan.
import {
  DEFAULT_TENANT_TZ,
  tenantTimeZone,
  monthRangeInZone,
  monthKeyInZone,
  daysSinceInZone,
  parseMonthKey,
  monthRangeForKey,
  shiftMonthKey,
  monthKeyLabel,
} from "@/lib/domain/tenant-timezone";

describe("tenantTimeZone (K7)", () => {
  it("bawaan & tenant tanpa zona = WIB", () => {
    expect(DEFAULT_TENANT_TZ).toBe("Asia/Jakarta");
    expect(tenantTimeZone(null)).toBe("Asia/Jakarta");
    expect(tenantTimeZone(undefined)).toBe("Asia/Jakarta");
    expect(tenantTimeZone("")).toBe("Asia/Jakarta");
  });

  it("zona tak dikenal jatuh kembali ke WIB (tidak membuat laporan rusak)", () => {
    expect(tenantTimeZone("Bukan/Zona")).toBe("Asia/Jakarta");
  });

  it("zona tenant dihormati", () => {
    expect(tenantTimeZone("Asia/Makassar")).toBe("Asia/Makassar");
    expect(tenantTimeZone("Asia/Jayapura")).toBe("Asia/Jayapura");
  });
});

describe("monthRangeInZone — batas 'bulan ini' menurut zona tenant (M5)", () => {
  // Kasus nyata M5: bayar 00.30 WIB tanggal 1. Server (UTC) masih melihatnya
  // sebagai akhir bulan sebelumnya → TANPA zona tenant, uang ini salah bulan.
  const bayar0030WibTgl1 = new Date("2026-10-01T00:30:00+07:00"); // = 2026-09-30T17:30Z

  it("pukul 00.30 tanggal 1 (WIB) tetap masuk bulan berjalan", () => {
    const r = monthRangeInZone(bayar0030WibTgl1, "Asia/Jakarta");
    expect(r.start.toISOString()).toBe("2026-09-30T17:00:00.000Z"); // 1 Okt 00.00 WIB
    expect(r.end.getTime()).toBeGreaterThan(r.start.getTime());
    // end = 31 Okt 23:59:59.999 WIB
    expect(r.end.toISOString()).toBe("2026-10-31T16:59:59.999Z");
    expect(bayar0030WibTgl1 >= r.start && bayar0030WibTgl1 <= r.end).toBe(true);
  });

  it("cara lama (zona server UTC) menghitung uang 1 Okt WIB ke bulan SEPTEMBER — inilah bugnya", () => {
    const utcStart = new Date(
      Date.UTC(bayar0030WibTgl1.getUTCFullYear(), bayar0030WibTgl1.getUTCMonth(), 1),
    );
    const utcEnd = new Date(
      Date.UTC(bayar0030WibTgl1.getUTCFullYear(), bayar0030WibTgl1.getUTCMonth() + 1, 1) - 1,
    );
    // Instan ini = 30 Sep 17.30Z → cara lama (zona server) memasukkannya ke September,
    // padahal menurut WIB uang itu diterima tanggal 1 OKTOBER.
    expect(bayar0030WibTgl1 >= utcStart && bayar0030WibTgl1 <= utcEnd).toBe(true);
    expect(bayar0030WibTgl1.getUTCMonth()).toBe(8); // 8 = September

    // Cara baru (zona tenant): uang yang sama masuk OKTOBER.
    const r = monthRangeInZone(bayar0030WibTgl1, "Asia/Jakarta");
    expect(bayar0030WibTgl1 >= r.start && bayar0030WibTgl1 <= r.end).toBe(true);
    expect(r.start.toISOString()).toBe("2026-09-30T17:00:00.000Z"); // 1 Okt 00.00 WIB
  });

  it("tenant WITA menghitung batas bulan di zona mereka (tenant beda ≠ saling pengaruh)", () => {
    const jam8pagiWita = new Date("2026-10-01T08:00:00+08:00"); // Makassar WITA
    const wib = monthRangeInZone(jam8pagiWita, "Asia/Jakarta");
    const wita = monthRangeInZone(jam8pagiWita, "Asia/Makassar");
    expect(wita.start.toISOString()).toBe("2026-09-30T16:00:00.000Z"); // 1 Okt 00.00 WITA
    expect(wib.start.toISOString()).toBe("2026-09-30T17:00:00.000Z"); // 1 Okt 00.00 WIB
    expect(wita.start < wib.start).toBe(true);
  });

  it("tanggal di pertengahan bulan menghasilkan bulan yang benar", () => {
    const r = monthRangeInZone(new Date("2026-03-15T10:00:00+07:00"), "Asia/Jakarta");
    expect(r.start.toISOString()).toBe("2026-02-28T17:00:00.000Z"); // 1 Mar 00.00 WIB
    expect(r.end.toISOString()).toBe("2026-03-31T16:59:59.999Z");
  });
});

describe("daysSinceInZone — keterangan 'sejak X hari' menurut zona tenant (K6)", () => {
  it("malam → pagi dini hari = 1 hari kalender (bukan 0, bukan negatif)", () => {
    const dibayar = new Date("2026-09-30T22:00:00+07:00");
    const kini = new Date("2026-10-01T06:00:00+07:00");
    expect(daysSinceInZone(dibayar, kini, "Asia/Jakarta")).toBe(1);
  });

  it("masih hari yang sama = 0 hari", () => {
    const dibayar = new Date("2026-10-01T08:00:00+07:00");
    const kini = new Date("2026-10-01T21:30:00+07:00");
    expect(daysSinceInZone(dibayar, kini, "Asia/Jakarta")).toBe(0);
  });

  it("lewat 3 hari menurut kalender tenant", () => {
    const dibayar = new Date("2026-09-28T10:00:00+07:00");
    const kini = new Date("2026-10-01T11:00:00+07:00");
    expect(daysSinceInZone(dibayar, kini, "Asia/Jakarta")).toBe(3);
  });
});
// Riwayat penerimaan per bulan (L9, 2026-10-18): kartu "Penerimaan Bulan Ini" terkunci
// pada bulan berjalan; tenant tidak bisa melihat bulan lalu. Helper kunci bulan dibutuhkan
// agar pengelompokan jejak (remittedAt/verifiedAt) mengikuti zona TENANT, bukan zona server
// (kesalahan yang sama dengan M5).
describe("monthKeyInZone — kunci bulan (YYYY-MM) menurut zona tenant", () => {
  it("jejak setoran 00.30 WIB tanggal 1 = bulan berjalan, bukan bulan sebelumnya", () => {
    const jejak = new Date("2026-10-01T00:30:00+07:00"); // 30 Sep 17:30Z
    expect(monthKeyInZone(jejak, "Asia/Jakarta")).toBe("2026-10");
    // Kesalahan zona server (UTC) yang sama dengan M5: memasukkannya ke September.
    expect(jejak.toISOString().slice(0, 7)).toBe("2026-09");
  });

  it("zona berbeda bisa menghasilkan kunci bulan berbeda untuk instan yang sama", () => {
    const jejak = new Date("2026-10-31T20:00:00+07:00"); // 31 Okt WIB = 31 Okt WITA
    expect(monthKeyInZone(jejak, "Asia/Jakarta")).toBe("2026-10");
    const jayapura = new Date("2026-10-31T20:00:00+09:00"); // 31 Okt WIT
    expect(monthKeyInZone(jayapura, "Asia/Jayapura")).toBe("2026-10");
  });

  it("zona kosong/tak dikenal jatuh ke WIB (tidak membuat riwayat rusak)", () => {
    const jejak = new Date("2026-09-30T18:00:00+07:00"); // 30 Sep 18.00 WIB
    expect(monthKeyInZone(jejak, null)).toBe("2026-09");
    expect(monthKeyInZone(jejak, "Bukan/Zona")).toBe("2026-09");
  });

  it("kunci cocok dengan monthRangeInZone yang sama (satu sumber zona)", () => {
    const jejak = new Date("2026-07-15T09:00:00+07:00");
    const { start, end } = monthRangeInZone(jejak, "Asia/Jakarta");
    expect(jejak >= start && jejak <= end).toBe(true);
    expect(monthKeyInZone(jejak, "Asia/Jakarta")).toBe("2026-07");
  });
});

// ── L10/K16(a) — helper bulan untuk pemilih bulan (membangun jalur existing) ────────
describe("helper bulan (parseMonthKey / monthRangeForKey / shiftMonthKey / monthKeyLabel)", () => {
  it("parseMonthKey: valid diterima, tidak valid DITOLAK (null) — bukan diam-diam jatuh ke bulan ini", () => {
    expect(parseMonthKey("2026-07")).toBe("2026-07");
    expect(parseMonthKey("2026-00")).toBeNull();
    expect(parseMonthKey("2026-13")).toBeNull();
    expect(parseMonthKey("2026-7")).toBeNull();
    expect(parseMonthKey("2026-07-01")).toBeNull();
    expect(parseMonthKey("")).toBeNull();
    expect(parseMonthKey("Juli")).toBeNull();
  });

  it("monthRangeForKey: batas bulan menurut ZONA TENANT (konsisten monthRangeInZone)", () => {
    const r = monthRangeForKey("2026-10", "Asia/Jakarta");
    expect(r.start.toISOString()).toBe("2026-09-30T17:00:00.000Z");
    expect(r.end.toISOString()).toBe("2026-10-31T16:59:59.999Z");
    // identik dengan monthRangeInZone untuk instan dalam bulan itu
    const cmp = monthRangeInZone(new Date("2026-10-15T10:00:00+07:00"), "Asia/Jakarta");
    expect(r.start.getTime()).toBe(cmp.start.getTime());
    expect(r.end.getTime()).toBe(cmp.end.getTime());
  });

  it("shiftMonthKey: geser ±1 termasuk melintasi tahun; Des→Jan dan Jan→Des", () => {
    expect(shiftMonthKey("2026-07", 1)).toBe("2026-08");
    expect(shiftMonthKey("2026-07", -1)).toBe("2026-06");
    expect(shiftMonthKey("2026-12", 1)).toBe("2027-01");
    expect(shiftMonthKey("2026-01", -1)).toBe("2025-12");
    expect(shiftMonthKey("2026-07", 0)).toBe("2026-07");
    expect(shiftMonthKey("2026-07", 5)).toBe("2026-12");
  });

  it("monthKeyLabel: bulan Indonesia kapital + tahun", () => {
    expect(monthKeyLabel("2026-07")).toBe("Juli 2026");
    expect(monthKeyLabel("2026-10")).toBe("Oktober 2026");
  });

  it("monthKeyInZone(monthRangeForKey(...).start) = kunci yang sama (satu sumber zona)", () => {
    const r = monthRangeForKey("2026-03", "Asia/Makassar");
    expect(monthKeyInZone(r.start, "Asia/Makassar")).toBe("2026-03");
  });
});
