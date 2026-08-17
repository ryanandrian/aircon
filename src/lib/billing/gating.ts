/**
 * Feature gating & tenant lifecycle rules — best-practice SaaS multi-tenant.
 * Pure logic (teruji). Enforcement dilakukan di service/middleware.
 */
import type { TenantPlan, TenantStatus } from "@prisma/client";
import { PLANS, TRIAL_DAYS, type PlanFeatures } from "./plans";

/** Status yang masih boleh memakai aplikasi (baca/tulis). */
export function isTenantUsable(status: TenantStatus): boolean {
  return status === "TRIAL" || status === "ACTIVE" || status === "PAST_DUE";
}

/**
 * Plan efektif untuk gating. Saat TRIAL, beri akses fitur tertinggi (PRO)
 * agar calon pelanggan mencoba semuanya. Setelah bayar, pakai plan asli.
 */
export function effectivePlan(status: TenantStatus, plan: TenantPlan): TenantPlan {
  if (status === "TRIAL") return "PRO";
  return plan;
}

/** Apakah fitur tertentu aktif untuk plan ini. */
export function hasFeature(plan: TenantPlan, feature: keyof PlanFeatures): boolean {
  const v = PLANS[plan].features[feature];
  return typeof v === "boolean" ? v : Boolean(v);
}

/** Boleh menambah teknisi bila jumlah saat ini < batas plan. */
export function canAddTechnician(plan: TenantPlan, currentCount: number): boolean {
  return currentCount < PLANS[plan].features.maxTechnicians;
}

/** Akhir masa trial. */
export function computeTrialEnd(start: Date, days: number = TRIAL_DAYS): Date {
  const d = new Date(start);
  d.setDate(d.getDate() + days);
  return d;
}

/** Apakah trial sudah lewat. */
export function isTrialExpired(trialEndsAt: Date | null, now = new Date()): boolean {
  if (!trialEndsAt) return false;
  return now.getTime() > trialEndsAt.getTime();
}
