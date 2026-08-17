/**
 * Subscription Service — orkestrasi langganan berbayar.
 * Buat pembayaran (Snap), aktivasi setelah PAID, sinkron status tenant.
 * Semua tenant-scoped.
 */
import { prisma } from "@/lib/prisma";
import type { TenantPlan, PaymentStatus } from "@prisma/client";
import { getPlanConfig, getBillingPolicy, withTax } from "@/lib/billing/config";
import { createSnapTransaction, isMidtransConfigured } from "@/lib/billing/midtrans-client";
import {
  makeOrderId,
  parseMidtransStatus,
  subscriptionPeriodEnd,
} from "@/lib/billing/midtrans-logic";

export class BillingError extends Error {
  code: "NOT_CONFIGURED" | "NOT_FOUND" | "INVALID" | "UNEXPECTED";
  constructor(code: BillingError["code"], message: string) {
    super(message);
    this.name = "BillingError";
    this.code = code;
  }
}

/**
 * Mulai pembayaran langganan: buat Payment(PENDING) + Snap token.
 * Harga & pajak DIBACA DARI DATABASE (PlanConfig + BillingPolicy) — no hardcode.
 * SECURITY: tenantId dari session (dipanggil oleh action ber-auth).
 */
export async function startSubscriptionPayment(params: {
  tenantId: string;
  plan: TenantPlan;
  periodMonths?: number;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
}): Promise<{ snapToken: string; redirectUrl: string; orderId: string }> {
  if (!isMidtransConfigured()) {
    throw new BillingError("NOT_CONFIGURED", "Pembayaran belum dikonfigurasi. Hubungi admin.");
  }
  const planCfg = await getPlanConfig(params.plan);
  if (!planCfg || !planCfg.active) throw new BillingError("INVALID", "Paket tidak tersedia");
  if (planCfg.priceMonthly <= 0) throw new BillingError("INVALID", "Paket ini gratis, tak perlu bayar");

  const policy = await getBillingPolicy();
  const months = params.periodMonths ?? 1;
  const base = planCfg.priceMonthly * months;
  const taxPercent = planCfg.taxable ? policy.taxPercent : 0;
  const { subtotal, taxAmount, total: amount } = withTax(base, taxPercent);
  const orderId = makeOrderId(params.tenantId);

  // Catat Payment PENDING dulu (idempoten via orderId unik).
  await prisma.payment.create({
    data: {
      tenantId: params.tenantId,
      orderId,
      plan: params.plan,
      amount,
      periodMonths: months,
      status: "PENDING",
    },
  });

  // Rincian item: harga paket + baris pajak terpisah agar transparan di Midtrans
  // (jumlah item_details HARUS = gross_amount).
  const items = [
    {
      id: `plan-${planCfg.plan}`,
      name: `Langganan ${planCfg.displayName} (${months} bln)`,
      price: subtotal,
      quantity: 1,
      category: "subscription",
    },
    ...(taxAmount > 0
      ? [{ id: "tax", name: `Pajak ${taxPercent}%`, price: taxAmount, quantity: 1, category: "tax" }]
      : []),
  ];

  const snap = await createSnapTransaction({
    orderId,
    amount,
    customer: {
      firstName: params.customerName,
      email: params.customerEmail,
      phone: params.customerPhone,
    },
    items,
  });

  await prisma.payment.update({
    where: { orderId },
    data: { snapToken: snap.token, snapRedirect: snap.redirectUrl },
  });

  return { snapToken: snap.token, redirectUrl: snap.redirectUrl, orderId };
}

/**
 * Proses notifikasi Midtrans (webhook). Idempoten.
 * Update Payment + aktivasi tenant bila PAID.
 */
export async function processPaymentNotification(notif: {
  order_id: string;
  transaction_status?: string;
  fraud_status?: string;
  transaction_id?: string;
  payment_type?: string;
  gross_amount?: string;
  raw: unknown;
}): Promise<{ status: PaymentStatus; tenantId: string | null }> {
  const payment = await prisma.payment.findUnique({ where: { orderId: notif.order_id } });
  if (!payment) {
    // order tak dikenal — abaikan dengan aman
    return { status: "FAILED", tenantId: null };
  }

  // Lapisan tambahan anti-tamper: gross_amount harus cocok dengan amount tersimpan.
  // (Signature sudah mengikat gross_amount, ini pertahanan berlapis.)
  if (notif.gross_amount !== undefined) {
    const notifAmount = Math.round(Number(notif.gross_amount));
    if (!Number.isFinite(notifAmount) || notifAmount !== payment.amount) {
      await prisma.payment.update({
        where: { orderId: notif.order_id },
        data: { status: "FAILED", rawNotif: notif.raw as never },
      });
      return { status: "FAILED", tenantId: payment.tenantId };
    }
  }

  const newStatus = parseMidtransStatus(notif);

  // Idempoten: kalau sudah PAID, jangan proses ulang aktivasi.
  const alreadyPaid = payment.status === "PAID";

  await prisma.payment.update({
    where: { orderId: notif.order_id },
    data: {
      status: newStatus,
      midtransTxId: notif.transaction_id ?? payment.midtransTxId,
      paymentType: notif.payment_type ?? payment.paymentType,
      paidAt: newStatus === "PAID" ? new Date() : payment.paidAt,
      rawNotif: notif.raw as never,
    },
  });

  if (newStatus === "PAID" && !alreadyPaid) {
    await activateSubscription(payment.tenantId, payment.plan, payment.periodMonths, payment.amount);
  }

  return { status: newStatus, tenantId: payment.tenantId };
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
