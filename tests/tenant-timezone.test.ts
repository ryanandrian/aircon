import { describe, it, expect } from "vitest";
// L1 (keputusan K7, 2026-10-17) — penanggalan tenant menurut zona waktu TENANT, bukan
// zona server (fakta M5). Murni: tanpa DB, tanpa jaringan.
import {
  DEFAULT_TENANT_TZ,
  tenantTimeZone,
  monthRangeInZone,
  daysSinceInZone,
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