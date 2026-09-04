"use server";

import { getServerContext } from "@/lib/auth/context";
import { assertRole } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { startSubscriptionPayment, BillingError } from "@/lib/services/subscription-service";
import { midtransClientConfig, type MidtransClientConfig } from "@/lib/billing/midtrans-client";
import type { TenantPlan } from "@prisma/client";

export type StartPaymentResult =
  | { ok: true; snapToken: string; redirectUrl: string; client: MidtransClientConfig }
  | { ok: false; error: string };

/** Owner memulai pembayaran langganan. SECURITY: hanya OWNER. */
export async function startPayment(
  plan: TenantPlan,
  periodMonths: number,
  couponCode?: string,
): Promise<StartPaymentResult> {
  try {
    const ctx = await getServerContext();
    assertRole(ctx.role, ["OWNER"]);

    const tenant = await prisma.tenant.findUnique({ where: { id: ctx.tenantId } });
    if (!tenant) return { ok: false, error: "Usaha tidak ditemukan." };

    const res = await startSubscriptionPayment({
      tenantId: ctx.tenantId,
      plan,
      periodMonths,
      customerName: ctx.name,
      customerEmail: ctx.email ?? undefined,
      customerPhone: tenant.phone ?? undefined,
      couponCode: couponCode?.trim() || undefined,
    });
    return { ok: true, snapToken: res.snapToken, redirectUrl: res.redirectUrl, client: midtransClientConfig() };
  } catch (err) {
    if (err instanceof BillingError) {
      return { ok: false, error: err.message };
    }
    console.error("[startPayment] gagal:", err);
    return { ok: false, error: "Gagal memulai pembayaran. Coba lagi." };
  }
}

/** Validasi kupon realtime (baca-saja) untuk pratinjau harga di UI owner. */
export async function previewCoupon(
  code: string,
  plan: TenantPlan,
  periodMonths: number,
): Promise<
  | { ok: true; code: string; discount: number; recurring: boolean; recurringMonths: number | null }
  | { ok: false; error: string }
> {
  try {
    const ctx = await getServerContext();
    assertRole(ctx.role, ["OWNER"]);
    const { getPlanConfig } = await import("@/lib/billing/config");
    const planCfg = await getPlanConfig(plan);
    if (!planCfg || planCfg.priceMonthly <= 0) return { ok: false, error: "Paket ini gratis." };
    const base = planCfg.priceMonthly * Math.max(1, periodMonths);
    const { validateCoupon } = await import("@/lib/services/coupon-service");
    const v = await validateCoupon({ code, tenantId: ctx.tenantId, plan, months: periodMonths, base });
    return { ok: true, code: v.code, discount: v.discount, recurring: v.recurring, recurringMonths: v.recurringMonths };
  } catch (err) {
    const { CouponError } = await import("@/lib/services/coupon-service");
    if (err instanceof CouponError) return { ok: false, error: err.message };
    console.error("[previewCoupon] gagal:", err);
    return { ok: false, error: "Gagal memeriksa kupon." };
  }
}
