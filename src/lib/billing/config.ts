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

/** Ambil kebijakan billing global (singleton). Buat default bila belum ada. */
export async function getBillingPolicy(): Promise<BillingPolicy> {
  const existing = await prisma.billingPolicy.findUnique({ where: { id: "singleton" } });
  if (existing) return existing;
  // Default aman bila belum di-seed (tetap bisa diubah admin).
  return prisma.billingPolicy.create({
    data: {
      id: "singleton",
      taxPercent: 11,
      trialDays: 14,
      graceDaysBeforeSuspend: 1,
      daysBeforeDelete: 7,
      dunningReminderDays: "0,1,3",
      deleteWarningDay: 3,
    },
  });
}
