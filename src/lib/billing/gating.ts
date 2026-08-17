/**
 * Feature gating & kuota — enforcement terhadap DATABASE (PlanConfig).
 * Fungsi murni ada di gating-pure.ts (bebas DB, teruji unit).
 * Semua paket FITUR PENUH; pembeda = kuota (admin/teknisi/pelanggan/unit AC).
 */
import type { TenantPlan } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPlanConfig, getBillingPolicy } from "@/lib/billing/config";
import {
  quotaLimit,
  withinQuota,
  type QuotaKind,
} from "@/lib/billing/gating-pure";

// Re-export fungsi murni agar pemakai lama tetap jalan.
export {
  isTenantUsable,
  computeTrialEnd,
  isTrialExpired,
  quotaLimit,
  withinQuota,
  QUOTA_LABEL,
  type QuotaKind,
} from "@/lib/billing/gating-pure";

export interface QuotaCheck {
  allowed: boolean;
  limit: number | null;
  current: number;
  kind: QuotaKind;
}

/**
 * Cek kuota terhadap DB untuk sebuah tenant.
 * Menghitung pemakaian aktual (tenant-scoped) lalu bandingkan PlanConfig.
 * SECURITY: tenantId dari pemanggil ber-auth.
 */
export async function checkQuota(
  tenantId: string,
  plan: TenantPlan,
  kind: QuotaKind,
): Promise<QuotaCheck> {
  const cfg = await getPlanConfig(plan);
  const limit = cfg ? quotaLimit(cfg, kind) : null;

  let current = 0;
  switch (kind) {
    case "admins":
      // SECURITY: tenant-scoped. OWNER dihitung admin (pemilik = admin utama).
      current = await prisma.user.count({
        where: { tenantId, role: { in: ["OWNER", "ADMIN"] }, status: { not: "DISABLED" } },
      });
      break;
    case "technicians":
      // "Maksimum Teknisi termasuk akun admin" → hitung semua user aktif tenant.
      current = await prisma.user.count({
        where: { tenantId, status: { not: "DISABLED" } },
      });
      break;
    case "customers":
      current = await prisma.customer.count({ where: { tenantId, deletedAt: null } });
      break;
    case "acUnits":
      current = await prisma.asset.count({ where: { tenantId, deletedAt: null } });
      break;
  }

  return { allowed: withinQuota(limit, current), limit, current, kind };
}

/** Ambil trialDays terkini dari policy. */
export async function trialDays(): Promise<number> {
  const policy = await getBillingPolicy();
  return policy.trialDays;
}
