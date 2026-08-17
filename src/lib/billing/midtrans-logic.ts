/**
 * Logika murni Midtrans (teruji, tanpa I/O).
 * Pemetaan status & helper order — dipisah agar mudah diuji.
 */
import type { PaymentStatus } from "@prisma/client";

/** Order ID unik untuk Midtrans. Format: AIRCON-<tenant6>-<ts>-<rand>. */
export function makeOrderId(tenantId: string): string {
  const t = tenantId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase();
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `AIRCON-${t}-${ts}-${rand}`;
}

interface MidtransNotif {
  transaction_status?: string;
  fraud_status?: string;
}

/** Peta transaction_status Midtrans -> PaymentStatus domain. */
export function parseMidtransStatus(notif: MidtransNotif): PaymentStatus {
  const s = notif.transaction_status;
  switch (s) {
    case "settlement":
      return "PAID";
    case "capture":
      // capture butuh fraud_status accept
      return notif.fraud_status === "accept" ? "PAID" : "PENDING";
    case "pending":
      return "PENDING";
    case "deny":
    case "cancel":
      return "FAILED";
    case "expire":
      return "EXPIRED";
    case "refund":
    case "partial_refund":
      return "REFUNDED";
    default:
      return "PENDING";
  }
}

/** Akhir periode langganan = start + N bulan. */
export function subscriptionPeriodEnd(start: Date, months: number): Date {
  const d = new Date(start);
  d.setMonth(d.getMonth() + months);
  return d;
}
