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
 * Resolusi diskon untuk sebuah checkout (dipakai BERSAMA oleh previewCheckout & startPayment
 * → satu sumber kebenaran). Menentukan potongan dari:
 *  - Kode MANUAL (owner ketik) → validasi penuh (kuota/masa berlaku/per-tenant). Melempar bila tak valid.
 *  - Bila tak ada kode manual → diskon RECURRING melekat di tenant (otomatis, tanpa validasi kuota ulang).
 * Return discount=0 bila tak ada diskon berlaku. recurringApplied=true hanya bila diskon datang dari
 * recurring melekat (bukan manual) — dipakai webhook utk cabang tebus yang benar.
 */
export async function resolveCheckoutDiscount(params: {
  tenantId: string;
  plan: TenantPlan;
  months: number;
  base: number;
  couponCode?: string;
  now?: Date;
}): Promise<{ discount: number; couponCode: string | null; recurringApplied: boolean }> {
  if (params.couponCode?.trim()) {
    // MANUAL: validasi penuh — melempar CouponError bila tak valid (ditangkap pemanggil).
    const v = await validateCoupon({
      code: params.couponCode, tenantId: params.tenantId, plan: params.plan, months: params.months, base: params.base, now: params.now,
    });
    return { discount: v.discount, couponCode: v.code, recurringApplied: false };
  }
  // RECURRING melekat: terapkan tanpa validasi kuota (sudah divalidasi saat tebus awal).
  const tenant = await prisma.tenant.findUnique({
    where: { id: params.tenantId },
    select: { activeCouponCode: true, couponPeriodsLeft: true },
  });
  if (tenant?.activeCouponCode && (tenant.couponPeriodsLeft == null || tenant.couponPeriodsLeft > 0)) {
    const c = await prisma.coupon.findUnique({ where: { code: tenant.activeCouponCode } });
    if (c && c.active && (c.appliesToPlans.length === 0 || c.appliesToPlans.includes(params.plan))) {
      const discount = computeDiscount({ type: c.type, value: c.value, base: params.base });
      if (discount > 0) return { discount, couponCode: c.code, recurringApplied: true };
    }
  }
  return { discount: 0, couponCode: null, recurringApplied: false };
}

/**
 * Tebus kupon SAAT PEMBAYARAN LUNAS (idempoten via paymentOrderId). Dipanggil dari webhook.
 *
 * DUA cabang, dibedakan oleh `recurringApplied`:
 *
 * A. recurringApplied=false → PENEBUSAN AWAL (kupon manual diketik owner):
 *    - Catat CouponRedemption + naikkan Coupon.redeemedCount (kuota global & per-tenant).
 *    - Bila kupon recurring: MELEKATKAN diskon ke tenant untuk perpanjangan berikutnya.
 *      Semantik recurringMonths = TOTAL periode berdiskon TERMASUK pembelian ini.
 *        recurringMonths null  → selamanya (couponPeriodsLeft = null).
 *        recurringMonths = N≥2 → sisa (N-1) perpanjangan berdiskon (couponPeriodsLeft = N-1).
 *        recurringMonths = 1   → hanya pembelian ini, tak ada perpanjangan berdiskon (tak melekat).
 *
 * B. recurringApplied=true → PERPANJANGAN OTOMATIS (diskon melekat, owner tak ketik kode):
 *    - TIDAK menaikkan kuota / TIDAK reset. Hanya KURANGI couponPeriodsLeft (bila berhingga).
 *    - Habis (≤0) → lepas diskon (activeCouponCode=null). null tetap null (selamanya).
 *    - Tetap catat CouponRedemption sbg audit (idempoten).
 *
 * Idempoten: bila CouponRedemption utk paymentOrderId sudah ada → tak melakukan apa-apa.
 */
export async function redeemCouponOnPaid(params: {
  code: string;
  tenantId: string;
  paymentOrderId: string;
  discountAmount: number;
  recurringApplied: boolean;
}): Promise<void> {
  const code = params.code.trim().toUpperCase();
  const coupon = await prisma.coupon.findUnique({ where: { code } });
  if (!coupon) return; // kupon terhapus? abaikan dengan aman.

  await prisma.$transaction(async (tx) => {
    // IDEMPOTEN: bila redemption utk order ini sudah ada, jangan proses ulang apa pun.
    const existing = await tx.couponRedemption.findUnique({ where: { paymentOrderId: params.paymentOrderId } });
    if (existing) return;

    // Audit trail selalu dicatat (kedua cabang), unik per order.
    await tx.couponRedemption.create({
      data: {
        couponId: coupon.id,
        tenantId: params.tenantId,
        paymentOrderId: params.paymentOrderId,
        discountAmount: params.discountAmount,
      },
    });

    if (!params.recurringApplied) {
      // ── Cabang A: penebusan AWAL (manual) ──
      await tx.coupon.update({ where: { id: coupon.id }, data: { redeemedCount: { increment: 1 } } });

      if (coupon.recurring) {
        // Melekatkan diskon recurring. periodsLeft = sisa perpanjangan (di luar pembelian ini).
        // recurringMonths null → selamanya; N≥2 → N-1; N≤1 → tak melekat (tak ada perpanjangan berdiskon).
        const periodsLeft =
          coupon.recurringMonths == null ? null : coupon.recurringMonths - 1;
        if (periodsLeft == null || periodsLeft >= 1) {
          await tx.tenant.update({
            where: { id: params.tenantId },
            data: { activeCouponCode: coupon.code, couponPeriodsLeft: periodsLeft },
          });
        }
      }
    } else {
      // ── Cabang B: PERPANJANGAN otomatis (diskon melekat) ──
      const t = await tx.tenant.findUnique({
        where: { id: params.tenantId },
        select: { activeCouponCode: true, couponPeriodsLeft: true },
      });
      // Hanya proses bila diskon melekat memang kupon ini.
      if (t?.activeCouponCode === coupon.code) {
        if (t.couponPeriodsLeft == null) {
          // selamanya → tak berubah.
        } else {
          const left = t.couponPeriodsLeft - 1;
          await tx.tenant.update({
            where: { id: params.tenantId },
            data: left >= 1
              ? { couponPeriodsLeft: left }
              : { couponPeriodsLeft: 0, activeCouponCode: null }, // jatah habis → lepas
          });
        }
      }
    }
  });
}
