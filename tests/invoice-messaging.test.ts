import { describe, it, expect } from "vitest";
import { receiptNumber } from "../src/lib/domain/receipt";
import { terbilangRupiah } from "../src/lib/domain/terbilang";

describe("receiptNumber", () => {
  it("mengubah prefix INV → KW", () => {
    expect(receiptNumber("INV/2026/0007")).toBe("KW/2026/0007");
  });
  it("tak mengubah nomor non-INV", () => {
    expect(receiptNumber("PRO/2026/0001")).toBe("PRO/2026/0001");
  });
});

describe("terbilangRupiah (dipakai kwitansi)", () => {
  it("150000 → seratus lima puluh ribu rupiah", () => {
    expect(terbilangRupiah(150000).toLowerCase()).toBe("seratus lima puluh ribu rupiah");
  });
  it("kapital di huruf pertama", () => {
    expect(terbilangRupiah(1000)[0]).toBe("S");
  });
});
