import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

// F13 — Laporan pemilik (2026-10-15): kartu riwayat "Lihat Detail" utk
// pekerjaan COMPLETED terbuka tapi isinya "kosong" — tak ada detail kerja.
//
// AKAR TERBUKTI (work.tsx:33):
//   showWork = ["ARRIVED","IN_PROGRESS","WAITING"].includes(status)
//   → kartu "Foto Bukti" TIDAK dirender utk COMPLETED — padahal page.tsx
//     SELALU mengirim job.photos (data ada, gate UI menyembunyikan).
//   → halaman COMPLETED = kartu pelanggan + "Pekerjaan selesai" saja.
//
// Perbaikan (jalur yang SUDAH ADA — work.tsx & page.tsx, nol komponen baru):
//   showPhotos (foto sebagai ARSIP, termasuk COMPLETED) DIPISAH dari
//   showUpload (tombol "+ Ambil Foto" hanya utk status berjalan).
//   + ringkasan "Pekerjaan" utk COMPLETED (layanan/unit/tanggal/telah lunas).

const work = readFileSync(
  resolve(process.cwd(), "src/app/t/pekerjaan/[id]/work.tsx"), "utf8");
const detailPage = readFileSync(
  resolve(process.cwd(), "src/app/t/pekerjaan/[id]/page.tsx"), "utf8");

describe("F13 — detail COMPLETED tidak kosong: foto bukti sebagai arsip", () => {
  it("kartu Foto Bukti tampil utk COMPLETED (photos dikirim page — bukan disembunyikan)", () => {
    // gate render foto kini memuat COMPLETED
    expect(work).toMatch(/showPhotos[\s\S]{0,220}COMPLETED/);
    // gate lama yg menyembunyikan (showWork utk card foto) TIDAK lagi dipakai utk foto
    expect(work).not.toMatch(/showWork && \(\s*<Card>/);
  });

  it("tombol '+ Ambil Foto' hanya utk status berjalan, bukan COMPLETED", () => {
    // kontrak gate: upload ikut showWork (tanpa COMPLETED); foto utk COMPLETED
    expect(work).toContain('const showPhotos = showWork || status === "COMPLETED"');
    expect(work).toContain('const showUpload = showWork;');
    // tombol & input upload dijaga blok showUpload
    expect(work).toContain("{showUpload && (");
    expect(work.match(/\{showUpload && \(/g)).toHaveLength(2);
  });

  it("page detail merender ringkasan pekerjaan utk COMPLETED (layanan/unit/tanggal)", () => {
    expect(detailPage).toContain("Ringkasan Pekerjaan");
  });
});
