import type { TenantStatus, PaymentStatus } from "@prisma/client";
import { formatTenantStatus, formatPaymentStatus } from "@/lib/services/platform-format";

const TENANT_BADGE: Record<TenantStatus, string> = {
  TRIAL: "bg-amber-100 text-amber-800",
  ACTIVE: "bg-emerald-100 text-emerald-800",
  PAST_DUE: "bg-orange-100 text-orange-800",
  SUSPENDED: "bg-rose-100 text-rose-800",
  CANCELLED: "bg-slate-200 text-slate-700",
};

const PAYMENT_BADGE: Record<PaymentStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  PAID: "bg-emerald-100 text-emerald-800",
  FAILED: "bg-rose-100 text-rose-800",
  EXPIRED: "bg-slate-200 text-slate-700",
  REFUNDED: "bg-sky-100 text-sky-800",
};

const BASE = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium";

export function TenantStatusBadge({ status }: { status: TenantStatus }) {
  return <span className={`${BASE} ${TENANT_BADGE[status]}`}>{formatTenantStatus(status)}</span>;
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <span className={`${BASE} ${PAYMENT_BADGE[status]}`}>{formatPaymentStatus(status)}</span>;
}
