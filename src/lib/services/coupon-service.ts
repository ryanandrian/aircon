/**
 * Coupon Service — validasi & penerapan diskon langganan.
 *
 * Prinsip:
 * - PURE calc terpisah (computeDiscount) → mudah ditest, tanpa I/O.
 * - Diskon dihitung dari harga DASAR PRA-PAJAK (base = priceMonthly * months), SEBELUM pajak.
 *   Pajak lalu dihitung dari subtotal setelah diskon → gross_amount konsisten (anti-tamper utuh).
 * - Redeem (naikkan redeemedCount + catat CouponRedemption + set recurring di tenant) HANYA saat
 *   pembayaran LUNAS, idempoten via paymentOrderId unik. Kupon tak "hangus" bila user batal bayar.
 */
import { prisma } from "@/lib/prisma";
import type { CouponType, TenantPlan } from "@prisma/client";
import { computeDiscount, type CouponCalcInput } from "@/lib/domain/coupon-calc";

export { computeDiscount };
export type { CouponCalcInput };

export class CouponError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "CouponError";
  }
}

export interface ValidatedCoupon {
  id: string;
  code: string;
  type: CouponType;
  value: number;
  recurring: boolean;
  recurringMonths: number | null;
  discount: number; // potongan pra-pajak utk transaksi ini
  finalBase: number; // base setelah diskon (pra-pajak)
}

/**
 * Validasi kupon untuk sebuah tenant + paket + durasi + base. Melempar CouponError bila tidak valid.
 * TIDAK menulis apa pun (baca-saja) — aman dipanggil dari validasi realtime UI.
 */
export async function validateCoupon(params: {
  code: string;
  tenantId: string;
  plan: TenantPlan;
  months: number;
  base: number; // pra-pajak
  now?: Date;
}): Promise<ValidatedCoupon> {
  const now = params.now ?? new Date();
  const code = params.code.trim().toUpperCase();
  if (!code) throw new CouponError("EMPTY", "Kode kupon kosong");

  const coupon = await prisma.coupon.findUnique({ where: { code } });
  if (!coupon || !coupon.active) throw new CouponError("NOT_FOUND", "Kode kupon tidak ditemukan atau tidak aktif");

  if (coupon.validFrom && now < coupon.validFrom) throw new CouponError("NOT_STARTED", "Kupon belum berlaku");
  if (coupon.validUntil && now > coupon.validUntil) throw new CouponError("EXPIRED", "Kupon sudah kedaluwarsa");

  if (coupon.minMonths > params.months) {
    throw new CouponError("MIN_MONTHS", `Kupon butuh durasi minimal ${coupon.minMonths} bulan`);
  }

  if (coupon.appliesToPlans.length > 0 && !coupon.appliesToPlans.includes(params.plan)) {
    throw new CouponError("PLAN", "Kupon tidak berlaku untuk paket ini");
  }

  if (coupon.maxRedemptions != null && coupon.redeemedCount >= coupon.maxRedemptions) {
    throw new CouponError("QUOTA", "Kuota kupon sudah habis");
  }

  // Batas per tenant (hitung redemption LUNAS yang tercatat).
  const usedByTenant = await prisma.couponRedemption.count({
    where: { couponId: coupon.id, tenantId: params.tenantId },
  });
  if (usedByTenant >= coupon.perTenantLimit) {
    throw new CouponError("PER_TENANT", "Kupon sudah pernah Anda pakai");
  }

  const discount = computeDiscount({ type: coupon.type, value: coupon.value, base: params.base });
  if (discount <= 0) throw new CouponError("NO_EFFECT", "Kupon tidak memberi potongan untuk paket ini");

  return {
    id: coupon.id,
    code: coupon.code,
    type: coupon.type,
    value: coupon.value,
    recurring: coupon.recurring,
    recurringMonths: coupon.recurringMonths,
    discount,
    finalBase: params.base - discount,
  };
}

/**
 * Tebus kupon SAAT PEMBAYARAN LUNAS (idempoten). Dipanggil dari webhook.
 * - Catat CouponRedemption (unik per paymentOrderId → aman dipanggil berulang).
 * - Naikkan Coupon.redeemedCount.
 * - Bila recurring: set diskon melekat di tenant (activeCouponCode + couponPeriodsLeft).
 *   couponPeriodsLeft berkurang tiap pembayaran LUNAS berikutnya (di applyRecurringConsume).
 */
export async function redeemCouponOnPaid(params: {
  code: string;
  tenantId: string;
  paymentOrderId: string;
  discountAmount: number;
}): Promise<void> {
  const code = params.code.trim().toUpperCase();
  const coupon = await prisma.coupon.findUnique({ where: { code } });
  if (!coupon) return; // kupon terhapus? abaikan dengan aman.

  await prisma.$transaction(async (tx) => {
    // Idempoten: bila redemption utk order ini sudah ada, jangan proses ulang.
    const existing = await tx.couponRedemption.findUnique({ where: { paymentOrderId: params.paymentOrderId } });
    if (existing) return;

    await tx.couponRedemption.create({
      data: {
        couponId: coupon.id,
        tenantId: params.tenantId,
        paymentOrderId: params.paymentOrderId,
        discountAmount: params.discountAmount,
      },
    });
    await tx.coupon.update({ where: { id: coupon.id }, data: { redeemedCount: { increment: 1 } } });

    if (coupon.recurring) {
      // Melekatkan diskon recurring ke tenant. Jatah: recurringMonths (null=selamanya).
      // Penebusan awal TIDAK mengurangi jatah (transaksi ini sudah berdiskon); jatah untuk periode BERIKUTNYA.
      await tx.tenant.update({
        where: { id: params.tenantId },
        data: {
          activeCouponCode: coupon.code,
          couponPeriodsLeft: coupon.recurringMonths, // null = selamanya
        },
      });
    }
  });
}
