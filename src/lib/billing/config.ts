/**
 * Billing config — SUMBER TUNGGAL aturan bisnis, DIBACA DARI DATABASE.
 * TIDAK ADA harga/kuota/kebijakan yang hardcode. Semua diatur admin panel.
 * Perubahan berlaku untuk tagihan/aktivasi berikutnya.
 */
import { prisma } from "@/lib/prisma";
import type { TenantPlan, PlanConfig, BillingPolicy } from "@prisma/client";

// Re-export helper murni agar pemakai lama (import dari config) tetap jalan.
export { withTax, parseReminderDays } from "@/lib/billing/gating-pure";

/** Ambil semua paket aktif, terurut. */
export async function getActivePlans(): Promise<PlanConfig[]> {
  return prisma.planConfig.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
  });
}

/** Ambil satu paket. */
export async function getPlanConfig(plan: TenantPlan): Promise<PlanConfig | null> {
  return prisma.planConfig.findUnique({ where: { plan } });
}

/**
 * Peta harga paket aktif (IDR) — ambil SEKALI lalu pakai untuk banyak tenant
 * agar tidak terjadi N+1 query saat menyusun laporan.
 */
export async function getPlanPriceMap(): Promise<Record<string, number>> {
  const configs = await prisma.planConfig.findMany({ select: { plan: true, priceMonthly: true } });
  return Object.fromEntries(configs.map((c) => [c.plan, c.priceMonthly]));
}

/**
 * Nilai paket dari peta harga (hasil `getPlanPriceMap`).
 * SSOT: `Subscription.amountMonthly` = snapshot harga saat berlangganan.
 * Fallback ke `PlanConfig.priceMonthly` bila tenant belum punya subscription
 * (mis. masih TRIAL) — polanya sama dengan `platform-notify-cycle`.
 */
export function planAmountFromMap(
  plan: TenantPlan,
  subscriptionAmountMonthly: number | null | undefined,
  priceMap: Record<string, number>,
): number {
  if (subscriptionAmountMonthly && subscriptionAmountMonthly > 0) return subscriptionAmountMonthly;
  return priceMap[plan] ?? 0;
}

/** Ambil kebijakan billing global (singleton). Buat default bila belum ada. */
export async function getBillingPolicy(): Promise<BillingPolicy> {
  const existing = await prisma.billingPolicy.findUnique({ where: { id: "singleton" } });
  if (existing) return existing;
  // Default aman bila belum di-seed (tetap bisa diubah admin).
  return prisma.billingPolicy.create({
    data: {
      id: "singleton",
      taxPercent: 11,
      graceDaysBeforeSuspend: 1,
      daysBeforeDelete: 7,
      dunningReminderDays: "0,1,3",
      deleteWarningDay: 3,
    },
  });
}
