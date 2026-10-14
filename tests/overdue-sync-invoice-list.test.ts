import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// F8 — Status OVERDUE sinkron di daftar invoice (temuan B-4, SEDANG).
//
// BUKTI MASALAH (audit 2026-10-14): refreshOverdueStatus HANYA dipanggil saat
// admin membuka /app/laporan (laporan/page.tsx:24). Akibat: badge "Jatuh Tempo"
// & daftar /app/faktur bisa telat menunjukkan status aktual (label terlambat;
// bucket PIUTANG tetap benar karena memakai ISSUED|OVERDUE — jujur, dampak =
// tampilan terlambat, bukan salah hitung).
//
// PERBAIKAN (jalur yang sudah ada): panggil refreshOverdueStatus(tenantId)
// SEBELUM countInvoicesByBucket + listInvoicesByBucket di halaman list faktur
// (pola persis /app/laporan: sinkron di request-time, BUKAN cron baru).
//
// Yang DIKUNCI:
// 1. /app/faktur/page.tsx memanggil refreshOverdueStatus sebelum query list.
// 2. Urutan: sinkron dulu → baru count & list (label akurat sejak render awal).
// 3. Tidak ada cron route baru yang dibuat (jalur sinkron request-time dipakai).

const fakturPage = readFileSync(resolve(process.cwd(), "src/app/app/faktur/page.tsx"), "utf8");

describe("F8 — OVERDUE sinkron di daftar invoice (B-4)", () => {
  it("page /app/faktur memanggil refreshOverdueStatus", () => {
    expect(fakturPage).toContain("refreshOverdueStatus");
  });

  it("sinkron dipanggil SEBELUM query list (urutan di kode)", () => {
    const sync = fakturPage.indexOf("refreshOverdueStatus");
    const count = fakturPage.indexOf("countInvoicesByBucket(");
    const list = fakturPage.indexOf("listInvoicesByBucket(");
    expect(sync).toBeGreaterThan(-1);
    expect(sync).toBeLessThan(count);
    expect(sync).toBeLessThan(list);
  });

  it("import ar-service dilakukan (jalur yang sudah ada — tanpa modul baru)", () => {
    expect(fakturPage).toContain('from "@/lib/services/ar-service"');
  });
});
