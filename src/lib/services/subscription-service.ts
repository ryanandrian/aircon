/**
 * Subscription Service — orkestrasi pembayaran iPaymu-only.
 */
import { prisma } from "@/lib/prisma";
import type { TenantPlan, PaymentStatus } from "@prisma/client";
import { getBillingPolicy } from "@/lib/billing/config";
import { getCompanyProfile, effectiveTaxPercent } from "@/lib/services/company-service";
import { createIpaymuRedirect } from "@/lib/billing/ipaymu-client";
import { mapIpaymuStatus, mapIpaymuStatusCode, isPaymentStatusUpdateAllowed } from "@/lib/billing/ipaymu-logic";

function subscriptionPeriodEnd(start: Date, months: number): Date {
  const result = new Date(start);
  result.setMonth(result.getMonth() + months);
  return result;
}

export class BillingError extends Error {
  code: "NOT_CONFIGURED" | "NOT_FOUND" | "INVALID" | "UNEXPECTED" | "ZERO_TOTAL";
  constructor(code: BillingError["code"], message: string) { super(message); this.name = "BillingError"; this.code = code; }
}

function makeOrderId(tenantId: string): string {
  return `AIRCON-PAY-${tenantId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

export async function startIpaymuPayment(params: {
  tenantId: string; plan: TenantPlan; periodMonths?: number; customerName: string;
  customerEmail?: string; customerPhone?: string; couponCode?: string;
}): Promise<{ redirectUrl: string; orderId: string }> {
  const { listPlanConfigs } = await import("@/lib/services/admin-config-service");
  const { resolveCheckoutDiscount } = await import("@/lib/services/coupon-service");
  const { resolveCheckout } = await import("@/lib/domain/coupon-calc");
  const [plans, policy, company] = await Promise.all([listPlanConfigs(), getBillingPolicy(), getCompanyProfile()]);
  const plan = plans.find((candidate) => candidate.plan === params.plan);
  if (!plan || !plan.active || plan.priceMonthly <= 0) throw new BillingError("INVALID", "Paket tidak tersedia untuk pembayaran");
  const months = Math.max(1, params.periodMonths ?? 1);
  const base = plan.priceMonthly * months;
  const { discount, couponCode, recurringApplied } = await resolveCheckoutDiscount({ tenantId: params.tenantId, plan: params.plan, months, base, couponCode: params.couponCode });
  const checkout = resolveCheckout(base, discount, plan.taxable ? effectiveTaxPercent(company.isPkp, policy.taxPercent) : 0);
  if (checkout.total <= 0) throw new BillingError("ZERO_TOTAL", "Total pembayaran harus lebih dari Rp0");
  const referenceId = makeOrderId(params.tenantId);
  const app = (process.env.IPAYMU_APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");
  const redirect = await createIpaymuRedirect({
    referenceId, amount: checkout.total,
    product: [{ name: `Langganan ${plan.displayName} (${months} bulan)`, price: checkout.subtotal, qty: 1, description: `Paket ${plan.displayName} Aircon`, imageUrl: `${app}/brand/aircon-logo.png` }],
    buyerName: params.customerName, buyerEmail: params.customerEmail, buyerPhone: params.customerPhone,
    returnUrl: `${app}/app/langganan?payment=success&order_id=${referenceId}`,
    notifyUrl: `${app}/api/billing/ipaymu-webhook`,
    cancelUrl: `${app}/app/langganan?payment=cancel&order_id=${referenceId}`,
  });
  await prisma.payment.create({ data: {
    tenantId: params.tenantId, orderId: referenceId, plan: params.plan, amount: checkout.total,
    periodMonths: months, status: "PENDING", checkoutRedirect: redirect.url,
    commissionBaseIdr: checkout.subtotal, couponCode, discountAmount: discount, couponRecurringApplied: recurringApplied,
  } });
  return { redirectUrl: redirect.url, orderId: referenceId };
}

export async function resumeIpaymuPayment(params: {
  orderId: string; tenantId: string; customerName: string; customerEmail?: string; customerPhone?: string;
}): Promise<{ kind: "resume"; redirectUrl: string; orderId: string } | { kind: "paid" }> {
  const payment = await prisma.payment.findUnique({ where: { orderId: params.orderId } });
  if (!payment || payment.tenantId !== params.tenantId) throw new BillingError("NOT_FOUND", "Transaksi tidak ditemukan.");
  if (payment.status === "PAID") return { kind: "paid" };
  const fresh = await startIpaymuPayment({ tenantId: params.tenantId, plan: payment.plan, periodMonths: payment.periodMonths, customerName: params.customerName, customerEmail: params.customerEmail, customerPhone: params.customerPhone, couponCode: payment.couponCode ?? undefined });
  return { kind: "resume", redirectUrl: fresh.redirectUrl, orderId: fresh.orderId };
}

export async function processIpaymuNotification(notif: {
  referenceId: string; status?: string; statusCode?: number; transactionId?: string; paymentType?: string; amount?: number; raw: unknown;
}): Promise<{ status: PaymentStatus; tenantId: string | null }> {
  const payment = await prisma.payment.findUnique({ where: { orderId: notif.referenceId } });
  if (!payment) return { status: "FAILED", tenantId: null };
  const next = notif.status ? mapIpaymuStatus(notif.status) : mapIpaymuStatusCode(notif.statusCode ?? 0);
  if (!isPaymentStatusUpdateAllowed(payment.status, next)) return { status: payment.status, tenantId: payment.tenantId };
  if (notif.amount != null && notif.amount !== payment.amount) return { status: "FAILED", tenantId: payment.tenantId };
  const transitionedToPaid = next === "PAID" && payment.status !== "PAID";
  await prisma.payment.updateMany({ where: { orderId: payment.orderId, status: payment.status }, data: { status: next, providerTransactionId: notif.transactionId ?? payment.providerTransactionId, providerPaymentType: notif.paymentType ?? payment.providerPaymentType, paidAt: next === "PAID" ? new Date() : payment.paidAt, rawNotif: notif.raw as never } });
  if (transitionedToPaid) await activateSubscription(payment.tenantId, payment.plan, payment.periodMonths, payment.amount);
  if (next === "PAID") {
    try { const { accrueCommission } = await import("@/lib/partner/partner-service"); await accrueCommission({ orderId: payment.orderId, tenantId: payment.tenantId, plan: payment.plan, grossIdr: payment.commissionBaseIdr ?? payment.amount, monthsPaid: payment.periodMonths, settledAt: new Date() }); }
    catch (err) { console.error("[commission] accrue gagal:", err); }
  }
  if (["FAILED", "EXPIRED", "REFUNDED"].includes(next) && payment.status === "PAID") {
    try { const { reverseCommission } = await import("@/lib/partner/partner-service"); await reverseCommission(payment.orderId); }
    catch (err) { console.error("[commission] reversal gagal:", err); }
  }
  return { status: next, tenantId: payment.tenantId };
}

/** Aktifkan/perpanjang langganan tenant setelah pembayaran sukses. */
export async function activateSubscription(
  tenantId: string,
  plan: TenantPlan,
  months: number,
  amount: number,
): Promise<void> {
  const now = new Date();
  const periodEnd = subscriptionPeriodEnd(now, months);

  await prisma.$transaction([
    prisma.tenant.update({
      where: { id: tenantId },
      data: {
        plan,
        status: "ACTIVE",
        currentPeriodEnd: periodEnd,
        nextDueDate: periodEnd,
        // Reset dunning: pembayaran menyembuhkan keterlambatan.
        suspendedAt: null,
        markedForDeletionAt: null,
        lastDunningReminderAt: null,
      },
    }),
    prisma.subscription.upsert({
      where: { tenantId },
      create: {
        tenantId, plan, status: "ACTIVE",
        currentPeriodStart: now, currentPeriodEnd: periodEnd,
        amountMonthly: Math.round(amount / months),
      },
      update: {
        plan, status: "ACTIVE",
        currentPeriodStart: now, currentPeriodEnd: periodEnd,
        amountMonthly: Math.round(amount / months),
        cancelAtPeriodEnd: false,
      },
    }),
  ]);
}