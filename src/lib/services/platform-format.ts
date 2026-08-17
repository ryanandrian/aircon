/**
 * Platform-format — helper PURE (tanpa DB) untuk halaman Admin Platform.
 * Dipakai UI internal (istilah bisnis normal). Diuji di tests/platform.test.ts.
 */
import type { TenantStatus, PaymentStatus } from "@prisma/client";

/** Kesehatan langganan untuk badge ringkas. */
export type TenantHealth = "sehat" | "perhatian" | "bermasalah";

const TENANT_STATUS_LABEL: Record<TenantStatus, string> = {
  TRIAL: "Masa Coba",
  ACTIVE: "Aktif",
  PAST_DUE: "Menunggak",
  SUSPENDED: "Ditangguhkan",
  CANCELLED: "Berhenti",
};

const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  PENDING: "Menunggu",
  PAID: "Lunas",
  FAILED: "Gagal",
  EXPIRED: "Kedaluwarsa",
  REFUNDED: "Dikembalikan",
};

/** Label Indonesia untuk status langganan usaha. */
export function formatTenantStatus(status: TenantStatus): string {
  return TENANT_STATUS_LABEL[status];
}

/** Label Indonesia untuk status pembayaran. */
export function formatPaymentStatus(status: PaymentStatus): string {
  return PAYMENT_STATUS_LABEL[status];
}

/** Ambang "masa coba hampir habis" dalam hari. */
const TRIAL_WARNING_DAYS = 3;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Ringkas kesehatan langganan untuk badge:
 * - ACTIVE => sehat
 * - PAST_DUE => perhatian
 * - SUSPENDED / CANCELLED => bermasalah
 * - TRIAL => sehat bila masih > TRIAL_WARNING_DAYS lagi; selain itu perhatian
 *   (termasuk bila trialEndsAt null/tidak lengkap).
 */
export function tenantHealth(
  status: TenantStatus,
  trialEndsAt: Date | null,
  now: Date = new Date(),
): TenantHealth {
  switch (status) {
    case "ACTIVE":
      return "sehat";
    case "PAST_DUE":
      return "perhatian";
    case "SUSPENDED":
    case "CANCELLED":
      return "bermasalah";
    case "TRIAL": {
      if (!trialEndsAt) return "perhatian";
      const daysLeft = (trialEndsAt.getTime() - now.getTime()) / MS_PER_DAY;
      return daysLeft > TRIAL_WARNING_DAYS ? "sehat" : "perhatian";
    }
    default: {
      // Exhaustiveness guard (TS strict).
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}
