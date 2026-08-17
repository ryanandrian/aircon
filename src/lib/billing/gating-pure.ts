/**
 * Fungsi MURNI billing/kuota — TANPA import DB. Aman diuji unit.
 * gating.ts & config.ts mengimpor dari sini (jangan sebaliknya).
 */
import type { TenantStatus, PlanConfig } from "@prisma/client";

/** Status yang masih boleh memakai aplikasi (login & operasi). */
export function isTenantUsable(status: TenantStatus): boolean {
  return status === "TRIAL" || status === "ACTIVE" || status === "PAST_DUE";
}

/** Akhir masa trial = start + N hari. */
export function computeTrialEnd(start: Date, days: number): Date {
  const d = new Date(start);
  d.setDate(d.getDate() + days);
  return d;
}

/** Apakah trial sudah lewat. */
export function isTrialExpired(trialEndsAt: Date | null, now = new Date()): boolean {
  if (!trialEndsAt) return false;
  return now.getTime() > trialEndsAt.getTime();
}

export type QuotaKind = "admins" | "technicians" | "customers" | "acUnits";

/** Ambil batas kuota dari PlanConfig. null = unlimited. */
export function quotaLimit(cfg: PlanConfig, kind: QuotaKind): number | null {
  switch (kind) {
    case "admins":
      return cfg.maxAdmins;
    case "technicians":
      return cfg.maxTechnicians;
    case "customers":
      return cfg.maxCustomers;
    case "acUnits":
      return cfg.maxAcUnits;
    default:
      return null;
  }
}

/** Cek murni: boleh menambah bila current < limit (null limit = unlimited). */
export function withinQuota(limit: number | null, current: number): boolean {
  if (limit === null) return true;
  return current < limit;
}

/** Hitung total dengan pajak. */
export function withTax(amount: number, taxPercent: number): {
  subtotal: number;
  taxAmount: number;
  total: number;
} {
  const taxAmount = Math.round((amount * taxPercent) / 100);
  return { subtotal: amount, taxAmount, total: amount + taxAmount };
}

/**
 * Pajak EFEKTIF (persen) yang boleh dipungut.
 * Bukan PKP → 0 (tak boleh pungut PPN), apa pun rate kebijakan.
 * PKP → pakai rate kebijakan (mis. 11, atau nilai lain untuk jasa).
 */
export function effectiveTaxPercent(isPkp: boolean, policyTaxPercent: number): number {
  if (!isPkp) return 0;
  return Math.max(0, policyTaxPercent);
}

/** Parse "0,1,3" -> [0,1,3] terurut. */
export function parseReminderDays(csv: string): number[] {
  return csv
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n >= 0)
    .sort((a, b) => a - b);
}

/** Label kuota untuk pesan. */
export const QUOTA_LABEL: Record<QuotaKind, string> = {
  admins: "admin",
  technicians: "teknisi",
  customers: "pelanggan",
  acUnits: "unit AC",
};
