import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// F4 — Chrome cetak bersih (G-1, KRITIS profesionalisme).
//
// BUKTI MASALAH (audit 2026-10-14): saat mencetak/menyimpan PDF dari halaman
// faktur/kwitansi, ikut tercetak:
//  (a) sidebar admin (aside sticky md:flex — TANPA print:hidden)
//  (b) tombol FAB "Chat CS Aircon" (CustomerServiceFab, position fixed — TANPA print:hidden)
// Keduanya ELEMEN CHROME, bukan dokumen — output PDF harus bersih.
// Repo tak punya RTL (terverifikasi) → assertion source-level + gate tsc/lint/build
// (pola tests/job-cancel-placement.test.ts yang sudah mapan).
//
// Yang DIKUNCI:
// 1. Sidebar admin (app/app/layout.tsx aside) memuat print:hidden.
// 2. FAB (component customer-service-fab) memuat print:hidden — berlaku di semua
//    pemakai (app/app/layout.tsx + landing app/page.tsx) — FAB = chrome di keduanya.
// 3. Layout teknisi (/t) TIDAK merender sidebar/FAB (sudah benar — jangan tambah).

const appLayout = readFileSync(resolve(process.cwd(), "src/app/app/layout.tsx"), "utf8");
const fab = readFileSync(resolve(process.cwd(), "src/components/customer-service-fab.tsx"), "utf8");
const techLayout = readFileSync(resolve(process.cwd(), "src/app/t/layout.tsx"), "utf8");

describe("F4 — chrome cetak bersih (G-1)", () => {
  it("sidebar admin memuat print:hidden (tidak ikut tercetak di PDF)", () => {
    // baris aside harus membawa print:hidden
    const asideLine = appLayout.split("\n").find((l) => l.includes("<aside"));
    expect(asideLine).toBeTruthy();
    expect(asideLine).toContain("print:hidden");
  });

  it("FAB CustomerServiceFab memuat print:hidden (dipakai layout app & landing)", () => {
    expect(fab).toContain("print:hidden");
  });

  it("layout teknisi /t TIDAK merender sidebar/FAB (tidak ada yang perlu disembunyikan)", () => {
    expect(techLayout).not.toContain("CustomerServiceFab");
    expect(techLayout).not.toContain("<aside");
  });
});
