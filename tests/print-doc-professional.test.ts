import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// F6 — Format invoice & proforma cetak/PDF profesional (temuan G-6, TINGGI).
//
// BUKTI MASALAH (audit 2026-10-14, dari kode invoice-view.tsx):
//  (a) Badge status aplikasi ("Terbit"/"Lunas" — STATUS_LABEL) ikut tercetak:
//      label UI, bukan bagian dokumen profesional.
//  (b) TANPA blok pengesahan ("Hormat kami, ..." + nama penerbit) — padahal
//      KwitansiView SUDAH memilikinya (kwitansi-view.tsx baris "Hormat kami") —
//      ketidakkonsistenan dua jenis dokumen dalam satu alur.
//  (c) Varian print tidak dirapikan (Card shadow/rounded bisa tak rapi di PDF).
//
// Prinsip: dua jenis dokumen TETAP dibedakan (INVOICE vs PROFORMA INVOICE —
// jangan disamakan), tapi kualitas cetak harus setara dengan kwitansi.
//
// Yang DIKUNCI (source-level — repo tanpa RTL, pola job-cancel-placement +
// gate tsc/lint/build):
// 1. Badge status UI disembunyikan saat print (print:hidden).
// 2. invoice-view.tsx memuat blok "Hormat kami" (pengesahan) — konsisten kwitansi.
// 3. Judul dokumen tetap membedakan INVOICE vs PROFORMA INVOICE (bukan diseragamkan).

const invoiceView = readFileSync(resolve(process.cwd(), "src/components/invoice-view.tsx"), "utf8");

describe("F6 — format cetak invoice/proforma profesional (G-6)", () => {
  it("Badge status UI disembunyikan saat print", () => {
    // baris yang merender <Badge> status harus membawa print:hidden
    const badgeLine = invoiceView.split("\n").find((l) => l.includes("<Badge"));
    expect(badgeLine).toBeTruthy();
    expect(badgeLine).toContain("print:hidden");
  });

  it("invoice-view memuat blok pengesahan 'Hormat kami' (konsisten dgn kwitansi)", () => {
    expect(invoiceView).toContain("Hormat kami");
  });

  it("judul tetap membedakan INVOICE vs PROFORMA INVOICE", () => {
    expect(invoiceView).toContain('"PROFORMA INVOICE"');
    expect(invoiceView).toContain('"INVOICE"');
  });
});
