import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// F7a — Kolom token dokumen (keputusan pemilik A+C).
//
// Keputusan pemilik (2026-10-14): A (pesan WA ringkasan + tautan) + C (halaman
// dokumen publik bertoken — pelanggan PRINT SENDIRI dari link; admin bisa
// Cetak/PDF lalu kirim manual via WhatsApp Apps/Web miliknya). UX wajib
// user-friendly; TRIAL/BASIC = tautan lewat wa.me (tanpa Gateway).
//
// Mekanisme: kolom Invoice.docToken (nullable + unique, additive) — token dibuat
// saat dokumen terbit di DUA jalur pembuatan yang sudah ada (closeWorkSession &
// createInvoiceFromProforma); kwitansi memakai token invoice yang sama.
//
// PENDEKATAN: source-level (pola mapan repo: job-cancel-placement,
// print-clean-chrome — repo TANPA RTL). Mock Prisma penuh utk service berat
// terbukti rapuh & tidak perlu utk mengetahui "token diisi di 2 titik create".
//
// Yang DIKUNCI:
// 1. helper generateInvoiceDocToken ADA & berformat token (unit test nyata di bawah).
// 2. closeWorkSession mengisi docToken (create invoice cash & proforma) — 2 titik
//    di worksession-service.ts.
// 3. createInvoiceFromProforma mengisi docToken — 1 titik di invoice-service.ts.
// 4. Kolom docToken di skema: nullable + unique (dokumen LAMA tanpa token aman).
// 5. Skema memuat kolom docToken (Prisma model Invoice).

const invService = readFileSync(resolve(process.cwd(), "src/lib/services/invoice-service.ts"), "utf8");
const wsService = readFileSync(resolve(process.cwd(), "src/lib/services/worksession-service.ts"), "utf8");
const schema = readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");

function countOccurrences(src: string, needle: string): number {
  return src.split(needle).length - 1;
}

describe("F7a — helper token (unit nyata)", () => {
  it("format token: base64url 32 karakter (randomBytes(24), pola technician-service)", async () => {
    const { generateInvoiceDocToken } = await import("@/lib/services/invoice-service");
    const t = generateInvoiceDocToken();
    expect(t).toHaveLength(32);
    expect(t).toMatch(/^[A-Za-z0-9_-]{32}$/);
  });

  it("entropi: 100x generate semua unik (anti-tabrakan/anti-enumeration)", async () => {
    const { generateInvoiceDocToken } = await import("@/lib/services/invoice-service");
    const set = new Set(Array.from({ length: 100 }, () => generateInvoiceDocToken()));
    expect(set.size).toBe(100);
  });
});

describe("F7a — token diisi di SEMUA titik pembuatan invoice (jalur yang sudah ada)", () => {
  it("closeWorkSession: 2 create (cash & proforma) keduanya mengisi docToken", () => {
    // worksession-service punya SATU create invoice (berlaku utk cash & proforma,
    // dipilih via docType) — 1 pemanggilan, tetap harus membawa docToken.
    expect(countOccurrences(wsService, "docToken: generateInvoiceDocToken()")).toBe(1);
  });

  it("createInvoiceFromProforma: create invoice resmi mengisi docToken", () => {
    expect(countOccurrences(invService, "docToken: generateInvoiceDocToken()")).toBe(1);
  });

  it("skema: kolom docToken nullable + unique (dokumen LAMA aman)", () => {
    expect(schema).toMatch(/docToken\s+String\?\s+@unique/);
  });

  it("skema: model Invoice memuat kolom docToken", () => {
    const model = schema.slice(schema.indexOf("model Invoice {"), schema.indexOf("model InvoiceItem {"));
    expect(model).toContain("docToken");
  });
});
