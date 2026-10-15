import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// F9 — Navigasi /t terasa STUCK (laporan pemilik 2026-10-15, bukti nginx + HP).
//
// DIAGNOSIS (berbasis bukti, bukan asumsi):
//  - Server/DB SEHAT: 349 request /t status 200; RSC payload 1,5–4 KB;
//    query 87–170 ms; index lengkap; node 295 MB.
//  - Jaringan HP lambat (19,3 KB/s — terbaca dari status bar screenshot) +
//    4x nginx 499 (koneksi ditutup klien) tepat di jendela keluhan.
//  - Router cache Next utk rute DINAMIS = default 0 → tiap klik A↔B REFETCH
//    penuh (bukti: token _rsc identik berulang di nginx log) → di jaringan
//    lambat menunggu lama → loading.tsx menutupi halaman dgn skeleton generik
//    TANPA label → terasa STUCK di semua halaman /t (satu loading.tsx segment).
//
// PERBAIKAN (jalur & kapasitas Next yang sudah ada — nol modul baru):
//  1. next.config.ts: experimental.staleTimes.dynamic dinaikkan → navigasi A↔B
//     direspon dari router cache (instan); data tetap segar via
//     revalidatePath/router.refresh() eksplisit di server action (sudah ada).
//  2. /t/loading.tsx: label jujur "Memuat…" + spinner → pengguna tahu ini
//     MEMUAT, bukan macet (skeleton 4 kartu TETAP, hanya ditambah konteks).
//
// Yang DIKUNCI (source-level — pola mapan job-cancel/print-*/overdue-sync):
// 1. next.config.ts memuat staleTimes.dynamic (nilai > 0).
// 2. loading.tsx /t memuat indikator teks memuat (bukan skeleton kosong).

const nextConfig = readFileSync(resolve(process.cwd(), "next.config.ts"), "utf8");
const techLoading = readFileSync(resolve(process.cwd(), "src/app/t/loading.tsx"), "utf8");

describe("F9 — navigasi /t tidak terasa stuck (bukti nginx + HP)", () => {
  it("router cache dinamis dinaikkan (staleTimes.dynamic > 0) — navigasi A↔B instan dari cache", () => {
    expect(nextConfig).toContain("staleTimes");
    // ambil angka dynamic
    const m = nextConfig.match(/dynamic:\s*(\d+(?:\.\d+)?)/);
    expect(m).toBeTruthy();
    expect(Number(m![1])).toBeGreaterThan(0);
  });

  it("loading.tsx /t memuat label jujur (bukan skeleton tanpa konteks)", () => {
    expect(techLoading).toMatch(/Memuat/i);
  });

  it("loading.tsx tetap menampilkan kartu skeleton (UX lama tidak hilang)", () => {
    expect(techLoading).toContain("Skeleton");
    expect(techLoading).toContain("length: 4");
  });
});
