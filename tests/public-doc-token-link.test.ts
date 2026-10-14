import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// F7b–F7d — Halaman dokumen publik /d/{token} + tautan di pesan WA + tombol salin.
//
// Keputusan pemilik (2026-10-14): A (pesan WA ringkasan + tautan) + C (halaman
// dokumen publik bertoken — pelanggan PRINT SENDIRI dari link; admin bisa
// Cetak/PDF lalu kirim manual via WhatsApp Apps/Web miliknya). UX wajib
// user-friendly; TRIAL/BASIC = tautan lewat wa.me (tanpa Gateway).
//
// PENDekatan: source-level (pola mapan repo: job-cancel-placement /
// print-clean-chrome / invoice-doc-token — repo TANPA RTL; + unit nyata helper).
//
// Yang DIKUNCI:
// 1. Halaman /d/[token] ADA & REUSE getInvoiceForPublicDoc (jalur loader publik
//    yang sudah ada; tanpa duplikasi logika).
// 2. Loader getInvoiceForPublicDoc ADA & memanggil getInvoiceForView (reuse penuh).
// 3. Halaman /d/[token] tampil jujur bila token tidak dikenal (404 aman).
// 4. buildInvoiceMessage & buildReceiptMessage memuat baris "Dokumen: {docUrl}"
//    bila docUrl diberikan (F7c) — tanpa mengubah kontrak teks-only gateway.
// 5. sendInvoiceViaWa & sendReceiptViaWa MENYERTAKAN docUrl (NEXT_PUBLIC_APP_URL)
//    ke pesan (F7c) — berlaku utk jalur gateway & fallback wa.me.
// 6. InvoiceActions (UI admin & teknisi) punya aksi "Salin link dokumen" (F7d)
//    dengan fallback clipboard — jalur yang sudah ada, tanpa komponen baru.
// 7. Halaman /d/[token] tanpa chrome app (tanpa sidebar/FAB — pola publik).

const invService = readFileSync(resolve(process.cwd(), "src/lib/services/invoice-service.ts"), "utf8");
const publicPage = readFileSync(resolve(process.cwd(), "src/app/d/[token]/page.tsx"), "utf8");
const actionsUi = readFileSync(resolve(process.cwd(), "src/components/invoice-actions.tsx"), "utf8");

function countOccurrences(src: string, needle: string): number {
  return src.split(needle).length - 1;
}

describe("F7b — halaman publik /d/[token] (reuse jalur yang sudah ada)", () => {
  it("halaman ADA & memuat loader publik getInvoiceForPublicDoc", () => {
    expect(publicPage).toContain('from "@/lib/services/invoice-service"');
    expect(publicPage).toContain("getInvoiceForPublicDoc");
  });

  it("loader getInvoiceForPublicDoc memanggil getInvoiceForView (REUSE penuh — nol duplikasi)", () => {
    expect(invService).toContain("export async function getInvoiceForPublicDoc");
    expect(invService).toContain("return getInvoiceForView(probe.tenantId, probe.id);");
  });

  it("halaman tampil jujur bila token tidak dikenal (404 aman)", () => {
    expect(publicPage).toContain("Dokumen tidak ditemukan");
  });

  it("halaman tanpa chrome app (tanpa sidebar/FAB — pola publik /riwayat)", () => {
    expect(publicPage).not.toContain("CustomerServiceFab");
    expect(publicPage).not.toContain("<aside");
    expect(publicPage).not.toContain("AppNav");
  });

  it("tombol cetak memakai window.print + print:hidden (pola InvoiceActions)", () => {
    const btn = readFileSync(resolve(process.cwd(), "src/app/d/[token]/print-button.tsx"), "utf8");
    expect(btn).toContain("window.print()");
    expect(btn).toContain("print:hidden");
  });
});

describe("F7c — tautan dokumen di pesan WA (A+C pemilik)", () => {
  it("buildInvoiceMessage menambahkan baris 'Dokumen: {docUrl}' bila docUrl diberikan", () => {
    expect(invService).toContain('lines.push(`Dokumen: ${args.docUrl}`);');
  });

  it("buildReceiptMessage menambahkan baris 'Dokumen: {docUrl}' bila docUrl diberikan", () => {
    // 2 pemakaian: buildInvoiceMessage & buildReceiptMessage
    expect(countOccurrences(invService, "lines.push(`Dokumen: ${args.docUrl}`);")).toBe(2);
  });

  it("sendInvoiceViaWa MENYERTAKAN docUrl (NEXT_PUBLIC_APP_URL + token) ke pesan", () => {
    expect(invService).toContain("NEXT_PUBLIC_APP_URL");
    expect(invService).toMatch(/docToken/); // token ikut disusun utk tautan
  });

  it("sendReceiptViaWa MENYERTAKAN docUrl (berlaku utk 3 dokumen: invoice/proforma/kwitansi)", () => {
    // dua fungsi kirim memakai docUrl — cek ada pemakaian variabel docUrl di file
    expect(countOccurrences(invService, "docUrl:")).toBeGreaterThanOrEqual(2);
  });

  it("kontrak teks-only gateway TIDAK berubah (gatewayRelay tak menyentuh media)", () => {
    const relay = readFileSync(resolve(process.cwd(), "src/lib/wa/gateway-relay.ts"), "utf8");
    expect(relay).toContain('body: JSON.stringify({ externalId, toPhone, message })');
    expect(relay).not.toContain("mediaBase64");
  });
});

describe("F7d — tombol Salin link dokumen (UX user-friendly, jalur yang sudah ada)", () => {
  it("InvoiceActions memuat aksi Salin link dokumen", () => {
    expect(actionsUi).toContain("Salin link dokumen");
  });

  it("aksi Salin memakai navigator.clipboard dengan fallback (user-friendly)", () => {
    expect(actionsUi).toContain("navigator.clipboard");
    expect(actionsUi).toContain("execCommand"); // fallback bila clipboard API tak ada
  });

  it("tombol Cetak/Simpan PDF TETAP ADA (tidak diganti)", () => {
    expect(actionsUi).toContain("Cetak / Simpan PDF");
  });

  it("tombol Kirim via WA TETAP ADA (tidak diganti)", () => {
    expect(actionsUi).toContain("Kirim via WA");
  });
});
