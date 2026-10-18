import { readFileSync, existsSync } from "node:fs";
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
  it("ANTI-FOSIL K12: panel TIDAK membawa prop peran yang tak terpakai lagi", () => {
    // Setelah K12 guard dibuka, prop `role` jadi mubazir (lint: unused) —
    // dipastikan dihapus bersih, bukan dibiarkan jadi kode mati.
    expect(src).not.toMatch(/role:\s*("OWNER"|"ADMIN"|"TECHNICIAN")/);
    expect(src).not.toContain("role,");
  });

  it("K12 (keputusan pemilik 2026-10-18): kolom bukti TAMPIL untuk semua peran", () => {
    // Guard B-2 lama DIBUKA — teknisi diwajibkan bisa mengirim bukti (tunai/transfer/QRIS).
    // Tidak boleh ada lagi cabang yang menyembunyikan kolom dari peran tertentu.
    expect(src).not.toMatch(/role\s*!==\s*"TECHNICIAN"/);
  });

  it("menampilkan indikator saat unggah berlangsung (tombol tak lagi senyap)", () => {
    expect(src).toContain("Mengunggah");
  });

  // ── K17 (keputusan pemilik 2026-10-18) — MENGGUGURKAN kontrak K3 lama ────────────
  // K3 lama: "teknisi tetap bisa menandai lunas TANPA bukti" — itulah yang membuat
  // INV/2026/0034 tercatat lunas TRANSFER tanpa bukti apa pun (audit 2026-10-18).
  // K17 membaliknya: penandaan lunas TRANSFER/QRIS oleh TEKNISI wajib foto —
  // bila teknisi tak punya bukti, jalannya = minta bukti / biarkan menunggu verifikasi.
  it("K17: panel punya pemicu kewajiban bukti (requireProof) — bukan tombol yang selalu bebas", () => {
    expect(src).toContain("requireProof");
  });

  it("K17: tombol LUNAS non-tunai wajib bukti saat requireProof (bukan disabled={pending||uploading} saja)", () => {
    // variabel turunan wajib bukti = requireProof DAN metode non-tunai
    expect(src).toMatch(/const\s+needsProof\s*=\s*requireProof\s*&&\s*method\s*!==\s*"CASH"/);
    // tombol memakainya — konsisten dgn guard service K17
    expect(src).toMatch(/disabled=\{[\s\S]{0,160}needsProof/);
    expect(src).toContain("actionMarkPaid");
  });

  it("K17: label bukti berubah menurut kewajiban (wajib vs opsional) — tidak menyesatkan", () => {
    expect(src).toContain("wajib");
    expect(src).toContain("opsional");
  });

  it("indikator Mengunggah tetap ada (K12 tidak digugurkan oleh K17)", () => {
    expect(src).toContain("Mengunggah…");
  });
});

// Kontrak pemakaian panel: halaman TEKNISI mewajibkan bukti (K17); halaman ADMIN tidak
// (opsional, K4/K17). Dibaca dari sumber (pola test ini) — tanpa render.
describe("K17 — pemakaian PaymentPanel per halaman", () => {
  const techPage = (() => {
    const p = resolve(process.cwd(), "src/app/t/faktur/[id]/page.tsx");
    return existsSync(p) ? readFileSync(p, "utf8") : "";
  })();
  const adminPage = (() => {
    const p = resolve(process.cwd(), "src/app/app/faktur/[id]/page.tsx");
    return existsSync(p) ? readFileSync(p, "utf8") : "";
  })();

  it("halaman teknisi mengirim requireProof", () => {
    expect(techPage).toMatch(/<PaymentPanel[^>]*requireProof/);
  });

  it("halaman admin TIDAK mengirim requireProof (opsional, K4)", () => {
    expect(adminPage).toContain("<PaymentPanel");
    expect(adminPage).not.toMatch(/<PaymentPanel[^>]*requireProof/);
  });
});
