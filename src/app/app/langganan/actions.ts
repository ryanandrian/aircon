"use server";

import { getServerContext } from "@/lib/auth/context";
import { assertRole } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { startSubscriptionPayment, resumeSubscriptionPayment, BillingError } from "@/lib/services/subscription-service";
import { midtransClientConfig, type MidtransClientConfig } from "@/lib/billing/midtrans-client";
import type { TenantPlan } from "@prisma/client";

export type StartPaymentResult =
  | { ok: true; snapToken: string; redirectUrl: string; client: MidtransClientConfig }
  | { ok: false; error: string };

export type ResumePaymentResult =
  | { ok: true; kind: "resume"; snapToken: string; redirectUrl: string; client: MidtransClientConfig }
  | { ok: true; kind: "paid" }
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

/**
 * Pratinjau checkout untuk paket + durasi (+ kode kupon opsional). SATU SUMBER KEBENARAN harga:
 * server menghitung base/diskon/pajak/total. Client hanya menampilkan. Termasuk diskon RECURRING
 * melekat (auto, tanpa owner ketik kode). Bila kode manual invalid → error (harga normal tetap dihitung).
 */
export async function previewCheckout(
  plan: TenantPlan,
  periodMonths: number,
  code?: string,
): Promise<
  | {
      ok: true;
      base: number; discount: number; subtotal: number; taxPercent: number; taxAmount: number; total: number;
      couponCode: string | null; recurring: boolean; recurringMonths: number | null; couponError: string | null;
    }
  | { ok: false; error: string }
> {
  try {
    const ctx = await getServerContext();
    assertRole(ctx.role, ["OWNER"]);
    const months = Math.max(1, periodMonths);
    const { getPlanConfig, getBillingPolicy } = await import("@/lib/billing/config");
    const { getCompanyProfile, effectiveTaxPercent } = await import("@/lib/services/company-service");
    const planCfg = await getPlanConfig(plan);
    if (!planCfg || planCfg.priceMonthly <= 0) return { ok: false, error: "Paket ini gratis." };

    const [policy, company] = await Promise.all([getBillingPolicy(), getCompanyProfile()]);
    const base = planCfg.priceMonthly * months;
    const taxPercent = planCfg.taxable ? effectiveTaxPercent(company.isPkp, policy.taxPercent) : 0;

    const { resolveCheckoutDiscount, validateCoupon, CouponError } = await import("@/lib/services/coupon-service");
    const { resolveCheckout } = await import("@/lib/domain/coupon-calc");

    let discount = 0;
    let couponCode: string | null = null;
    let recurring = false;
    let recurringMonths: number | null = null;
    let couponError: string | null = null;

    if (code?.trim()) {
      // Kode manual: validasi penuh; bila invalid → couponError (harga normal tetap dikembalikan).
      try {
        const v = await validateCoupon({ code, tenantId: ctx.tenantId, plan, months, base });
        discount = v.discount; couponCode = v.code; recurring = v.recurring; recurringMonths = v.recurringMonths;
      } catch (e) {
        couponError = e instanceof CouponError ? e.message : "Kupon tidak valid.";
      }
    } else {
      // Tanpa kode manual: tampilkan diskon RECURRING melekat bila ada.
      const r = await resolveCheckoutDiscount({ tenantId: ctx.tenantId, plan, months, base });
      discount = r.discount; couponCode = r.couponCode;
    }

    const bd = resolveCheckout(base, discount, taxPercent);
    return {
      ok: true,
      base: bd.base, discount: bd.discount, subtotal: bd.subtotal,
      taxPercent: bd.taxPercent, taxAmount: bd.taxAmount, total: bd.total,
      couponCode, recurring, recurringMonths, couponError,
    };
  } catch (err) {
    console.error("[previewCheckout] gagal:", err);
    return { ok: false, error: "Gagal memuat rincian harga." };
  }
}

/**
 * LANJUTKAN pembayaran transaksi belum lunas (best-practice Midtrans: reuse token bila hidup,
 * regenerate bila mati). SECURITY: OWNER only + kepemilikan orderId diverifikasi di service.
 */
export async function resumePayment(orderId: string): Promise<ResumePaymentResult> {
  try {
    const ctx = await getServerContext();
    assertRole(ctx.role, ["OWNER"]);
    const tenant = await prisma.tenant.findUnique({ where: { id: ctx.tenantId } });
    if (!tenant) return { ok: false, error: "Usaha tidak ditemukan." };

    const res = await resumeSubscriptionPayment({
      orderId,
      tenantId: ctx.tenantId,
      customerName: ctx.name,
      customerEmail: ctx.email ?? undefined,
      customerPhone: tenant.phone ?? undefined,
    });
    if (res.kind === "paid") return { ok: true, kind: "paid" };
    return { ok: true, kind: "resume", snapToken: res.snapToken, redirectUrl: res.redirectUrl, client: midtransClientConfig() };
  } catch (err) {
    if (err instanceof BillingError) return { ok: false, error: err.message };
    console.error("[resumePayment] gagal:", err);
    return { ok: false, error: "Gagal melanjutkan pembayaran. Coba lagi." };
  }
}
