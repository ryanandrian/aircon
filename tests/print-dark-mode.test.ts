import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

// Laporan pemilik 2026-10-15: mode dark → "Cetak/Simpan PDF" keluar
// BACKGROUND HITAM (Ibu Hesti).
//
// AKAR (bukti globals.css): @media print hanya mereset body{} — token warna
// .dark (html) TETAP aktif utk semua turunan → --background/--card/--muted
// gelap → PDF hitam. print:bg-white hanya di <main> rute faktur (html/body
// & token tetap gelap).
//
// Perbaikan (jalur globals.css yang sudah ada): di @media print, RESET token
// surface utk html.dark ke nilai TERANG (salinan :root, dikomentari silang
// supaya tak jadi fosil) + html,body putih. Konsekuensi: cetak SELALU terang
// walau mode gelap — sesuai ekspektasi dokumen cetak.

const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

describe("PDF cetak selalu terang walau mode gelap (laporan pemilik)", () => {
  it("globals.css memuat blok @media print", () => {
    expect(css).toContain("@media print");
  });

  it("di @media print: html.dark di-reset ke token TERANG (--background light)", () => {
    const printIdx = css.indexOf("@media print");
    const printBlock = css.slice(printIdx, css.indexOf("}", css.indexOf("@page", printIdx)) + 4000);
    expect(printIdx).toBeGreaterThan(-1);
    // selector reset harus menyasar html.dark di dalam media print
    expect(printBlock).toMatch(/html\.dark|html\.dark\s*\{/);
    expect(printBlock).toContain("--background: oklch(0.975 0.004 247)");
    expect(printBlock).toContain("--card: oklch(1 0 0)");
  });

  it("di @media print: html & body dipaksa putih (halaman kertas)", () => {
    const printIdx = css.indexOf("@media print");
    const printBlock = css.slice(printIdx, css.indexOf("}", printIdx) + 4000);
    expect(printBlock).toMatch(/html\s*,\s*body|html[^{]*\{\s*background:\s*#fff/);
    expect(printBlock).toContain("body { background: #ffffff");
  });
});
