import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

// Dual status (tawaran pemilik 2026-10-15 — "Selesai - Belum Dibayar /
// Selesai - Lunas"): label status pekerjaan harus MEMBAWA posisi pembayaran
// utk kartu riwayat (arsip+pantauan) & kelompok cash beranda — karena "Selesai"
// saja membingungkan (kerja beres, uang belum masuk).
//
// Rumus (sesuai aturan terkunci 0.2):
//   riwayat  : CANCELLED → "Batal"; COMPLETED+lunas → "Selesai - Lunas";
//              COMPLETED+belum → "Selesai - Belum dibayar" (tempo menanti admin)
//   beranda  : kelompok "Menunggu pelunasan cash" → "Selesai - Belum dibayar"
//              (sifat kelompok = belum lunas, tanpa query tambahan)
//
// RED: kedua label & plumbing-nya BELUM ada saat test ditulis.

const historyView = readFileSync(
  resolve(process.cwd(), "src/app/t/riwayat/history-view.tsx"), "utf8");
const homePage = readFileSync(resolve(process.cwd(), "src/app/t/page.tsx"), "utf8");

describe("Dual status di riwayat (label membawa posisi bayar)", () => {
  it("label 'Selesai - Lunas' utk kartu cash lunas", () => {
    expect(historyView).toContain("Selesai - Lunas");
  });

  it("label 'Selesai - Belum dibayar' utk COMPLETED belum lunas (tempo)", () => {
    expect(historyView).toContain("Selesai - Belum dibayar");
  });

  it("CANCELLED tetap 'Batal' (tanpa suffix bayar)", () => {
    expect(historyView).toMatch(/CANCELLED:\s*"Batal"/);
    expect(historyView).not.toContain("Batal - ");
  });

  it("row riwayat membawa flag pembayaran (paid) dari service", () => {
    const svc = readFileSync(
      resolve(process.cwd(), "src/lib/services/technician-service.ts"), "utf8");
    expect(svc).toMatch(/paid:\s*[^,]+some\(/);
  });
});

describe("Dual status di beranda (kelompok Menunggu pelunasan cash)", () => {
  it("JobCard kelompok cash memakai flag unpaidCash → label 'Selesai - Belum dibayar'", () => {
    // Kontrak PENGARUH: pemakaian JobCard di kelompok cash membawa prop
    // `unpaidCash` (bentuk shorthand JSX: "unpaidCash />") DAN JobCard
    // merendernya jadi label dual status.
    expect(homePage).toMatch(/unpaidCash[^=]*\/>/);
    expect(homePage).toContain("Selesai - Belum dibayar");
  });

  it("kartu kelompok lain TIDAK memakai suffix (label biasa)", () => {
    // JobCard utk "Hari ini" & "Perlu ditindaklanjuti" tanpa flag
    expect(homePage).not.toMatch(/<JobCard[^>]*unpaidCash=\{true\}[^>]*overdue/);
  });
});
