/**
 * Platform-format — helper PURE (tanpa DB) untuk halaman Admin Platform.
 * Dipakai UI internal (istilah bisnis normal). Diuji di tests/platform.test.ts.
 */
import type { TenantStatus, PaymentStatus } from "@prisma/client";

/** Kesehatan langganan untuk badge ringkas. */
export type TenantHealth = "sehat" | "perhatian" | "bermasalah";

const TENANT_STATUS_LABEL: Record<TenantStatus, string> = {
  TRIAL: "Basic (Gratis)",
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

/**
 * Ringkas kesehatan langganan untuk badge:
 * - ACTIVE => sehat
 * - TRIAL (Basic gratis selamanya) => sehat
 * - PAST_DUE => perhatian
 * - SUSPENDED / CANCELLED => bermasalah
 */
// Parameter kedua & ketiga dipertahankan agar kompatibel dengan pemanggil lama;
// keputusan kesehatan kini murni dari status, bukan dari masa coba yang tidak ada.
export function tenantHealth(status: TenantStatus): TenantHealth {
  switch (status) {
    case "ACTIVE":
      return "sehat";
    case "PAST_DUE":
      return "perhatian";
    case "SUSPENDED":
    case "CANCELLED":
      return "bermasalah";
    case "TRIAL":
      // Basic = paket gratis selamanya; tidak ada masa coba, jadi tidak ada
      // "perhatian" yang menyesatkan pada akun gratis yang justru sehat.
      return "sehat";
    default: {
      // Exhaustiveness guard (TS strict).
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}
