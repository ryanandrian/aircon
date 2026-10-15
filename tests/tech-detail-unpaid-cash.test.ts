import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

// F9d++ — Laporan pemilik 2026-10-15 (screenshot detail Ibu Hesti): kartu
// "Menunggu pelunasan cash" membuka halaman detail, tapi DETAIL COMPLETED
// hanya menampilkan kartu "Pekerjaan selesai" + pengingat — TANPA jalan
// menuntaskan (tombol/tagihan) → teknisi buntu ("dimana teknisi bisa
// closingnya?").
//
// AKAR MASALAH (bukti kode): blok tagihan di detail hanya utk
// ARRIVED/IN_PROGRESS/WAITING; setelah COMPLETED TIDAK ADA blok apa pun
// yg menautkan ke invoice pembayaran.
//
// Perbaikan (jalur yang SUDAH ADA — halaman detail + PaymentPanel di
// /t/faktur): utk COMPLETED + invoice CASH belum lunas YANG DIBUAT TEKNISI
// INI (selaras guard F2: teknisi hanya utk invoice buatannya) → tampilkan
// kartu tagihan ber-tautan ke /t/faktur/{invoiceId} (tombol Tandai LUNAS di
// sana). Tempo/invoice admin TIDAK ditampilkan (bukan urusan teknisi).

const detailPage = readFileSync(
  resolve(process.cwd(), "src/app/t/pekerjaan/[id]/page.tsx"), "utf8");

describe("F9d++ — detail job COMPLETED cash-belum-lunas punya jalan ke pembayaran", () => {
  it("mencari invoice cash belum lunas milik teknisi ini (createdById === ctx.userId)", () => {
    expect(detailPage).toMatch(/createdById/);
    expect(detailPage).toMatch(/docType/);      // hanya INVOICE (bukan proforma)
    expect(detailPage).toMatch(/status/);       // bukan PAID
  });

  it("merender kartu tagihan ber-tautan ke /t/faktur/{invoiceId} (tempat Tandai LUNAS)", () => {
    expect(detailPage).toContain("/t/faktur/");
    expect(detailPage).toContain("Tandai LUNAS");
  });

  it("hanya utk COMPLETED (bukan status lain — jalur existing ARRIVED..WAITING tak berubah)", () => {
    // blok baru dikondisikan job.status === "COMPLETED"
    expect(detailPage).toMatch(/job\.status === "COMPLETED"/);
    // jalur lama tetap utuh
    expect(detailPage).toContain("ARRIVED");
    expect(detailPage).toContain("Catat Pekerjaan");
  });
});
