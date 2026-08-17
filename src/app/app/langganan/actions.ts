"use server";

import { getServerContext } from "@/lib/auth/context";
import { assertRole } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { startSubscriptionPayment, BillingError } from "@/lib/services/subscription-service";
import type { TenantPlan } from "@prisma/client";

export type StartPaymentResult =
  | { ok: true; snapToken: string; redirectUrl: string }
  | { ok: false; error: string };

/** Owner memulai pembayaran langganan. SECURITY: hanya OWNER. */
export async function startPayment(
  plan: TenantPlan,
  periodMonths: number,
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
    });
    return { ok: true, snapToken: res.snapToken, redirectUrl: res.redirectUrl };
  } catch (err) {
    if (err instanceof BillingError) {
      return { ok: false, error: err.message };
    }
    console.error("[startPayment] gagal:", err);
    return { ok: false, error: "Gagal memulai pembayaran. Coba lagi." };
  }
}
