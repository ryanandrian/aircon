/**
 * iPaymu pure logic — status mapping + decisions (no I/O).
 * Sources: https://docs.ipaymu.com/id/docs/callback
 *
 * Callback fields from docs:
 *   status: "berhasil" | "pending" | "expired"
 *   status_code: 1 (success), 0 (pending), -2 (expired)
 *   transaction_status_code: 1 (settlement), 6 (pending)
 *
 * Domain PaymentStatus Aircon: PENDING | PAID | FAILED | EXPIRED | REFUNDED
 */
import type { PaymentStatus } from "@prisma/client";

/** Map iPaymu callback status → Aircon PaymentStatus. */
export function mapIpaymuStatus(status: string): PaymentStatus {
  switch (status.toLowerCase()) {
    case "berhasil":
    case "success":
    case "paid": return "PAID";
    case "pending": return "PENDING";
    case "expired": return "EXPIRED";
    case "failed":
    case "cancelled":
    case "canceled": return "FAILED";
    default: return "PENDING";
  }
}

/** Map iPaymu status_code number → Aircon PaymentStatus. */
export function mapIpaymuStatusCode(statusCode: number): PaymentStatus {
  switch (statusCode) {
    case 1: return "PAID";
    case 0: return "PENDING";
    case -2: return "EXPIRED";
    default: return "PENDING";
  }
}

/** Settlement is terminal; late non-refund notifications cannot downgrade it. */
export function isPaymentStatusUpdateAllowed(current: PaymentStatus, next: PaymentStatus): boolean {
  if (current === "PAID") return next === "PAID" || next === "REFUNDED";
  if (current === "REFUNDED") return next === "REFUNDED";
  return true;
}

/** End of a subscription period measured in months. */
export function subscriptionPeriodEnd(start: Date, months: number): Date {
  const result = new Date(start);
  result.setMonth(result.getMonth() + months);
  return result;
}
