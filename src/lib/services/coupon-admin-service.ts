/**
 * Coupon Admin Service — CRUD kupon. PLATFORM-ADMIN-ONLY (dipanggil setelah requirePlatformAdmin).
 * Terpisah dari coupon-service.ts (validasi/tebus sisi tenant) agar tanggung jawab jelas.
 */
import { prisma } from "@/lib/prisma";
import type { Coupon, CouponType, TenantPlan } from "@prisma/client";

export interface CouponInput {
  code: string;
  description?: string | null;
  type: CouponType;
  value: number;
  active: boolean;
  maxRedemptions?: number | null;
  perTenantLimit: number;
  validFrom?: Date | null;
  validUntil?: Date | null;
  appliesToPlans: TenantPlan[];
  minMonths: number;
  recurring: boolean;
  recurringMonths?: number | null;
}

export async function listCoupons(): Promise<(Coupon & { _count: { redemptions: number } })[]> {
  return prisma.coupon.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { redemptions: true } } },
  });
}

function normalize(input: CouponInput) {
  return {
    code: input.code.trim().toUpperCase(),
    description: input.description?.trim() || null,
    type: input.type,
    value: Math.max(0, Math.round(input.value)),
    active: input.active,
    maxRedemptions: input.maxRedemptions != null ? Math.max(0, Math.round(input.maxRedemptions)) : null,
    perTenantLimit: Math.max(1, Math.round(input.perTenantLimit)),
    validFrom: input.validFrom ?? null,
    validUntil: input.validUntil ?? null,
    appliesToPlans: input.appliesToPlans,
    minMonths: Math.max(1, Math.round(input.minMonths)),
    recurring: input.recurring,
    recurringMonths: input.recurring ? (input.recurringMonths != null ? Math.max(1, Math.round(input.recurringMonths)) : null) : null,
  };
}

export async function createCoupon(input: CouponInput): Promise<Coupon> {
  return prisma.coupon.create({ data: normalize(input) });
}

export async function updateCoupon(id: string, input: CouponInput): Promise<Coupon> {
  return prisma.coupon.update({ where: { id }, data: normalize(input) });
}

export async function toggleCoupon(id: string, active: boolean): Promise<Coupon> {
  return prisma.coupon.update({ where: { id }, data: { active } });
}
