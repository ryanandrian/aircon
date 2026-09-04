import { describe, it, expect } from "vitest";
import { angkaKeKata, terbilangRupiah } from "../src/lib/domain/terbilang";
import { extractGrossInfo, computeFinanceBreakdown } from "../src/lib/domain/finance-doc";

describe("terbilang (pure)", () => {
  it("angka dasar", () => {
    expect(angkaKeKata(0)).toBe("nol");
    expect(angkaKeKata(1)).toBe("satu");
    expect(angkaKeKata(11)).toBe("sebelas");
    expect(angkaKeKata(21)).toBe("dua puluh satu");
    expect(angkaKeKata(100)).toBe("seratus");
    expect(angkaKeKata(101)).toBe("seratus satu");
  });

  it("ribuan: seribu vs dua ribu", () => {
    expect(angkaKeKata(1000)).toBe("seribu");
    expect(angkaKeKata(2000)).toBe("dua ribu");
    expect(angkaKeKata(10000)).toBe("sepuluh ribu");
    expect(angkaKeKata(14440)).toBe("empat belas ribu empat ratus empat puluh");
  });

  it("juta & lebih", () => {
    expect(angkaKeKata(149000)).toBe("seratus empat puluh sembilan ribu");
    expect(angkaKeKata(1788000)).toBe("satu juta tujuh ratus delapan puluh delapan ribu");
    expect(angkaKeKata(1000000)).toBe("satu juta");
  });

  it("terbilangRupiah: kapital + rupiah", () => {
    expect(terbilangRupiah(10000)).toBe("Sepuluh ribu rupiah");
    expect(terbilangRupiah(0)).toBe("Nol rupiah");
    expect(terbilangRupiah(149000)).toBe("Seratus empat puluh sembilan ribu rupiah");
  });
});

describe("finance-doc (pure)", () => {
  it("extractGrossInfo: baca fee dari rawNotif Midtrans", () => {
    const raw = { metadata: { extra_info: { gross_amount_info: {
      gross_amount: "14440", original_amount: "10000", customer_imposed_payment_fee: "4440",
    } } } };
    expect(extractGrossInfo(raw)).toEqual({ originalAmount: 10000, customerImposedFee: 4440, grossPaidByCustomer: 14440 });
  });

  it("extractGrossInfo: tanpa info → objek kosong", () => {
    expect(extractGrossInfo(null)).toEqual({});
    expect(extractGrossInfo({})).toEqual({});
    expect(extractGrossInfo({ metadata: {} })).toEqual({});
  });

  it("computeFinanceBreakdown: diskon + non-PKP + fee channel (kasus nyata)", () => {
    // Professional 149rb, diskon 139rb → subtotal 10rb, non-PKP (0), fee channel 4.440.
    const bd = computeFinanceBreakdown({ amount: 10000, discount: 139000, taxPercent: 0, channelFee: 4440 });
    expect(bd.normalPrice).toBe(149000);
    expect(bd.discount).toBe(139000);
    expect(bd.subtotal).toBe(10000);
    expect(bd.taxAmount).toBe(0);
    expect(bd.total).toBe(10000);           // yang DITERIMA Lumite
    expect(bd.channelFee).toBe(4440);
    expect(bd.grandTotalPaid).toBe(14440);  // yang DIBAYAR pelanggan
  });

  it("computeFinanceBreakdown: PKP 11% pajak dihitung mundur", () => {
    // amount 111.000 = subtotal 100.000 + PPN 11.000
    const bd = computeFinanceBreakdown({ amount: 111000, discount: 0, taxPercent: 11, channelFee: 0 });
    expect(bd.subtotal).toBe(100000);
    expect(bd.taxAmount).toBe(11000);
    expect(bd.total).toBe(111000);
    expect(bd.grandTotalPaid).toBe(111000); // tanpa fee
  });

  it("computeFinanceBreakdown: tanpa diskon → normalPrice == subtotal", () => {
    const bd = computeFinanceBreakdown({ amount: 149000, discount: 0, taxPercent: 0, channelFee: 0 });
    expect(bd.normalPrice).toBe(149000);
    expect(bd.discount).toBe(0);
    expect(bd.channelFee).toBe(0);
  });
});
