/**
 * Coupon PURE calc — tanpa I/O / prisma, agar bisa ditest langsung & dipakai lintas layer.
 */
export type CouponTypeValue = "PERCENT" | "FIXED" | "OVERRIDE";

export interface CouponCalcInput {
  type: CouponTypeValue;
  value: number;
  base: number; // harga dasar pra-pajak (IDR) = priceMonthly * months
}

/**
 * Hitung potongan (discount) pra-pajak dari sebuah kupon terhadap base.
 * Return potongan dalam IDR (>=0), tak pernah melebihi base (harga tak boleh negatif).
 * OVERRIDE: harga jadi `value` tetap → potongan = base - value (diklamp).
 */
export function computeDiscount(input: CouponCalcInput): number {
  const { type, value, base } = input;
  if (base <= 0) return 0;
  let discount = 0;
  if (type === "PERCENT") {
    const pct = Math.max(0, Math.min(100, value));
    discount = Math.round((base * pct) / 100);
  } else if (type === "FIXED") {
    discount = Math.max(0, value);
  } else if (type === "OVERRIDE") {
    const target = Math.max(0, value);
    discount = base - target;
  }
  return Math.max(0, Math.min(discount, base));
}

export interface CheckoutBreakdown {
  base: number;          // harga dasar pra-pajak (priceMonthly * months)
  discount: number;      // potongan pra-pajak
  subtotal: number;      // base - discount (pra-pajak, dasar hitung pajak)
  taxPercent: number;    // persen pajak efektif (0 bila non-PKP / non-taxable)
  taxAmount: number;     // nominal pajak atas subtotal
  total: number;         // subtotal + taxAmount (= gross_amount ke Midtrans)
}

/**
 * PURE: rincian harga lengkap satu sumber kebenaran.
 * Pajak dihitung dari subtotal SETELAH diskon. Semua nilai bulat (IDR).
 * base & taxPercent datang dari server (PlanConfig + kebijakan PKP) — fungsi ini murni aritmetika.
 */
export function resolveCheckout(base: number, discount: number, taxPercent: number): CheckoutBreakdown {
  const safeBase = Math.max(0, Math.round(base));
  const safeDiscount = Math.max(0, Math.min(Math.round(discount), safeBase));
  const subtotal = safeBase - safeDiscount;
  const pct = Math.max(0, taxPercent);
  const taxAmount = Math.round((subtotal * pct) / 100);
  return {
    base: safeBase,
    discount: safeDiscount,
    subtotal,
    taxPercent: pct,
    taxAmount,
    total: subtotal + taxAmount,
  };
}
