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
