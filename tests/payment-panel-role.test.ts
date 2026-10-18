import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

// KOREKSI UI panel pembayaran (laporan pemilik 2026-10-18, alur closing teknisi).
//
// MASALAH yang dilaporkan pemilik: teknisi memilih foto dari kamera utk bukti
// transfer, lalu tombol "Tandai LUNAS" membeku (disabled) tanpa penjelasan.
// AKAR (verifikasi kode 2026-10-18):
//  1. `actionUploadPaymentProof` GUARD role OWNER/ADMIN (t/faktur/actions.ts:21) —
//     teknisi TIDAK BOLEH unggah bukti (keputusan lama terkunci, F2).
//  2. Tapi `PaymentPanel` dipakai SAMA oleh teknisi & admin dan TIDAK menerima peran
//     (F-05 + F-06 — "temuan paling berbahaya" di dokumen rencana).
//     → teknisi melihat kolom bukti, memilih foto, upload DITOLAK server, senyap.
//  3. `disabled={pending || uploading}` TANPA indikator loading apa pun → tombol
//     membeku tanpa penjelasan (foto kamera = beberapa MB).
//
// KONTRAK PERBAIKAN (tanpa merender — pola baca-sumber seperti dual-status-label):
//  - panel TAHU peran pemakainya (`role`) → teknisi TIDAK melihat kolom bukti;
//    admin TETAP melihatnya.
//  - ada indikator "Mengunggah…" saat unggah berlangsung (tombol tidak senyap).
//  - teknisi tetap bisa menandai lunas TANPA bukti (K3 — alur lapangan tak berubah).

const src = readFileSync(resolve(process.cwd(), "src/components/payment-panel.tsx"), "utf8");

describe("PaymentPanel — peran & indikator unggah", () => {
  it("menerima prop `role` (panel dipakai teknisi & admin — arsitektur F-05)", () => {
    expect(src).toMatch(/role:\s*("OWNER"|"ADMIN"|"TECHNICIAN")/);
  });

  it("kolom unggah bukti HANYA untuk peran kantor (OWNER/ADMIN) — teknisi tak melihatnya", () => {
    // Guard terlihat: kolom bukti di dalam cabang role kantor.
    expect(src).toMatch(/role\s*(!==\s*"TECHNICIAN"|===\s*"ADMIN"|===\s*"OWNER")/);
  });

  it("menampilkan indikator saat unggah berlangsung (tombol tak lagi senyap)", () => {
    expect(src).toContain("Mengunggah");
  });

  it("teknisi tetap bisa menandai lunas tanpa bukti (K3 — alur lapangan tidak berubah)", () => {
    // Tombol lunas tidak pernah meminta bukti sebagai syarat.
    expect(src).toMatch(/disabled=\{\s*pending\s*\|\|\s*uploading\s*\}/);
    // Dan tetap memanggil actionMarkPaid tanpa ketergantungan bukti.
    expect(src).toContain("actionMarkPaid");
  });
});
