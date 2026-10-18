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

// ── L11 (laporan pemilik 2026-10-18, Ibu Wati / job cmtebahnp…) ────────────────────
// AKAR TERBUKTI: kartu "Ringkasan Pekerjaan" menampilkan job.serviceType (1 nilai
// jenis = "INSTALL"), padahal job itu punya 3 item (Cuci ¾–1PK + Cuci 1,5–2PK +
// Isi Freon R32 = Rp325.000, INV/2026/0034). Baris itu juga membawa ternary fosil
// (kedua cabangnya job.serviceType).
// Perbaikan: memakai getJobCost (jalur biaya resmi yang sudah ada, dipakai halaman
// admin) → ringkasan menampilkan item + jumlah pekerjaan.
describe("L11 — Ringkasan Pekerjaan menampilkan APA YANG DIKERJAKAN (item), bukan hanya jenis", () => {
  it("memanggil getJobCost (jalur existing, bukan query baru di page)", () => {
    expect(detailPage).toContain('import { getJobCost } from "@/lib/services/worksession-service"');
    expect(detailPage).toContain("getJobCost(ctx.tenantId, id)");
  });

  it("kartu ringkasan merender item cost.items + jumlah pekerjaan", () => {
    expect(detailPage).toContain("cost.items.length");
    expect(detailPage).toContain("Jumlah pekerjaan");
    expect(detailPage).toContain("it.descSnapshot");
    expect(detailPage).toContain("it.lineTotal");
  });

  it("TERNARY FOSIL dihapus (kedua cabang job.serviceType tidak ada lagi)", () => {
    expect(detailPage).not.toContain('JOB_STATUS_LABEL[job.status] === "Selesai" ? job.serviceType : job.serviceType');
  });

  it("baris Layanan tetap ada sebagai CADANGAN bila belum ada item tercatat (empty-state)", () => {
    expect(detailPage).toContain("job.serviceType");
    expect(detailPage).toContain(">Layanan<");
  });
});
