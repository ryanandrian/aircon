import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
// L6 (keputusan K1/K3/K4, 2026-10-18) — label POSISI UANG dari SATU sumber.
// Sebelumnya: label "Lunas" berdiri sendiri tanpa posisi uang; tiap halaman
// menyusun label sendiri (F-11) → berisiko dua halaman label beda utk keadaan sama.

import { MONEY_POSITION, moneyPositionOf } from "@/lib/copy/money-position";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

describe("L6 — kontrak sumber label posisi uang", () => {
  const base = { payMethod: null, cashRemitStatus: null, verifiedAt: null };

  it("CASH: belum disetor vs sudah disetor dibedakan tegas", () => {
    expect(moneyPositionOf({ ...base, payMethod: "CASH", cashRemitStatus: "HELD_BY_TECH" }).label).toBe("Tunai — di teknisi");
    expect(moneyPositionOf({ ...base, payMethod: "CASH", cashRemitStatus: "REMITTED", remittedAt: new Date() }).label).toBe("Tunai — sudah disetor");
    // CASH tanpa label juga = belum disetor (K9: label baru ada setelah pembayaran dicatat;
    // cashRemitStatus null pada cash lunas = belum pernah disetor)
    expect(moneyPositionOf({ ...base, payMethod: "CASH", cashRemitStatus: null }).label).toBe("Tunai — di teknisi");
  });

  // M7/K13 (audit 2026-10-18): tunai REMITTED TANPA jejak (`remittedAt` null) — data
  // setoran lama. SATU sumber label (aturan 12) → halaman faktur dan laporan tidak boleh
  // memberi label berbeda untuk keadaan yang sama. Kasus live: 7 invoice, Rp3.800.000.
  it("M7/K13: tunai disetor TANPA jejak punya label SENDIRI — bukan 'sudah disetor', bukan 'di teknisi'", () => {
    const noTrace = moneyPositionOf({ ...base, payMethod: "CASH", cashRemitStatus: "REMITTED", remittedAt: null });
    expect(noTrace.key).toBe("CASH_REMITTED_NO_TRACE");
    expect(noTrace.label).not.toBe(MONEY_POSITION.CASH_REMITTED.label);
    expect(noTrace.label).not.toBe(MONEY_POSITION.CASH_HELD.label);
    // Jangan pernah mengklaim bukti lengkap untuk baris yang jejaknya kosong.
    expect(noTrace.label.toLowerCase()).not.toContain("sudah disetor");
    expect(noTrace.hint.length).toBeGreaterThan(0);
    expect(noTrace.color.length).toBeGreaterThan(0);
  });

  it("TRANSFER/QRIS: terverifikasi vs menunggu dicek dibedakan tegas", () => {
    expect(moneyPositionOf({ ...base, payMethod: "TRANSFER", verifiedAt: null }).label).toBe("Transfer — menunggu dicek");
    expect(moneyPositionOf({ ...base, payMethod: "TRANSFER", verifiedAt: new Date() }).label).toBe("Transfer — sudah masuk");
    expect(moneyPositionOf({ ...base, payMethod: "QRIS", verifiedAt: null }).label).toBe("QRIS — menunggu dicek");
    expect(moneyPositionOf({ ...base, payMethod: "QRIS", verifiedAt: new Date() }).label).toBe("QRIS — sudah masuk");
  });

  it("lunas tanpa metode TIDAK diklaim posisi apa pun", () => {
    expect(moneyPositionOf(base).key).toBe("UNKNOWN");
  });

  it("setiap posisi punya label, penjelasan, dan kelas warna (tak ada label kosong)", () => {
    for (const p of Object.values(MONEY_POSITION)) {
      expect(p.label.length).toBeGreaterThan(0);
      expect(p.hint.length).toBeGreaterThan(0);
      expect(p.color.length).toBeGreaterThan(0);
    }
  });

  it("label tak pernah menyebut 'terverifikasi' untuk tunai (verifikasi = urusan transfer/QRIS)", () => {
    for (const p of [MONEY_POSITION.CASH_HELD, MONEY_POSITION.CASH_REMITTED, MONEY_POSITION.CASH_REMITTED_NO_TRACE]) {
      expect(p.label.toLowerCase()).not.toContain("terverifikasi");
    }
  });
});

describe("L6 — sumber label DIPAKAI oleh halaman (bukan label bertebaran)", () => {
  it("halaman laporan memakai getReceiptPositions (satu sumber posisi utk kartu)", () => {
    // Kartu laporan memecah posisi lewat getReceiptPositions — diuji penuh di
    // tests/ar-receipt-positions.test.ts; sini hanya memastikan jalurnya dipakai.
    const s = read("src/app/app/laporan/page.tsx");
    expect(s).toContain("getReceiptPositions");
  });

  it("daftar faktur admin memakai moneyPositionOf + menampilkan labelnya", () => {
    const s = read("src/app/app/faktur/invoices-board.tsx");
    expect(s).toContain("moneyPositionOf");
    expect(s).toContain("money-position");
  });
});
