/**
 * Subscription Service — orkestrasi langganan berbayar.
 * Buat pembayaran (Snap), aktivasi setelah PAID, sinkron status tenant.
 * Semua tenant-scoped.
 */
import { prisma } from "@/lib/prisma";
import type { TenantPlan, PaymentStatus } from "@prisma/client";
import { getPlanConfig, getBillingPolicy, withTax } from "@/lib/billing/config";
import { getCompanyProfile, effectiveTaxPercent } from "@/lib/services/company-service";
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
  /** Kode kupon yang diketik owner (opsional). Diskon manual satu-kali/awal recurring. */
  couponCode?: string;
}): Promise<{ snapToken: string; redirectUrl: string; orderId: string }> {
  if (!isMidtransConfigured()) {
    throw new BillingError("NOT_CONFIGURED", "Pembayaran belum dikonfigurasi. Hubungi admin.");
  }
  const planCfg = await getPlanConfig(params.plan);
  if (!planCfg || !planCfg.active) throw new BillingError("INVALID", "Paket tidak tersedia");
  if (planCfg.priceMonthly <= 0) throw new BillingError("INVALID", "Paket ini gratis, tak perlu bayar");

  const policy = await getBillingPolicy();
  const company = await getCompanyProfile();
  const months = params.periodMonths ?? 1;
  const base = planCfg.priceMonthly * months;

  // ── DISKON KUPON (server-side, SEBELUM pajak) ──
  // Prioritas: kode manual yang diketik owner. Bila kosong, cek diskon RECURRING melekat di tenant
  // (mis. tenant pendiri) yang otomatis berlaku di perpanjangan tanpa ketik ulang.
  let discount = 0;
  let appliedCouponCode: string | null = null;
  const { validateCoupon, computeDiscount } = await import("@/lib/services/coupon-service");
  if (params.couponCode?.trim()) {
    // Manual: validasi penuh (kuota, masa berlaku, per-tenant, dst). Melempar bila tak valid.
    const v = await validateCoupon({ code: params.couponCode, tenantId: params.tenantId, plan: params.plan, months, base });
    discount = v.discount;
    appliedCouponCode = v.code;
  } else {
    // Recurring melekat: terapkan tanpa validasi kuota (sudah pernah divalidasi saat tebus awal).
    const tenant = await prisma.tenant.findUnique({
      where: { id: params.tenantId },
      select: { activeCouponCode: true, couponPeriodsLeft: true },
    });
    if (tenant?.activeCouponCode && (tenant.couponPeriodsLeft == null || tenant.couponPeriodsLeft > 0)) {
      const c = await prisma.coupon.findUnique({ where: { code: tenant.activeCouponCode } });
      if (c && c.active && (c.appliesToPlans.length === 0 || c.appliesToPlans.includes(params.plan))) {
        discount = computeDiscount({ type: c.type, value: c.value, base });
        if (discount > 0) appliedCouponCode = c.code;
      }
    }
  }

  const discountedBase = Math.max(0, base - discount);
  // Pajak efektif: hanya dipungut bila perusahaan PKP (no hardcode; rate dari kebijakan).
  const taxPercent = planCfg.taxable ? effectiveTaxPercent(company.isPkp, policy.taxPercent) : 0;
  const taxLabel = company.taxLabel || "Pajak";
  const { subtotal, taxAmount, total: amount } = withTax(discountedBase, taxPercent);
  const orderId = makeOrderId(params.tenantId);

  // Catat Payment PENDING dulu (idempoten via orderId unik). Simpan jejak kupon.
  await prisma.payment.create({
    data: {
      tenantId: params.tenantId,
      orderId,
      plan: params.plan,
      amount,
      periodMonths: months,
      status: "PENDING",
      couponCode: appliedCouponCode,
      discountAmount: discount,
    },
  });

  // Rincian item: harga paket + baris pajak terpisah agar transparan di Midtrans
  // (jumlah item_details HARUS = gross_amount). Baris diskon ditampilkan negatif.
  const items = [
    {
      id: `plan-${planCfg.plan}`,
      name: `Langganan ${planCfg.displayName} (${months} bln)`,
      price: planCfg.priceMonthly * months,
      quantity: 1,
      category: "subscription",
    },
    ...(discount > 0
      ? [{ id: "discount", name: `Diskon${appliedCouponCode ? ` (${appliedCouponCode})` : ""}`, price: -discount, quantity: 1, category: "discount" }]
      : []),
    ...(taxAmount > 0
      ? [{ id: "tax", name: `${taxLabel} ${taxPercent}%`, price: taxAmount, quantity: 1, category: "tax" }]
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
    expiryHours: company.checkoutExpiryHours,
    finishUrl: company.finishUrl || undefined,
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

    // KUPON: tebus (idempoten) + konsumsi jatah recurring. Gagal-jujur: tak ganggu aktivasi.
    if (payment.couponCode) {
      try {
        const { redeemCouponOnPaid } = await import("@/lib/services/coupon-service");
        await redeemCouponOnPaid({
          code: payment.couponCode,
          tenantId: payment.tenantId,
          paymentOrderId: payment.orderId,
          discountAmount: payment.discountAmount,
        });
        // Konsumsi 1 periode jatah recurring bila diskon ini datang dari recurring melekat
        // (kode == activeCouponCode tenant). Batasi ke jatah berhingga (null=selamanya, tak dikurangi).
        const t = await prisma.tenant.findUnique({
          where: { id: payment.tenantId },
          select: { activeCouponCode: true, couponPeriodsLeft: true },
        });
        if (t?.activeCouponCode === payment.couponCode && t.couponPeriodsLeft != null) {
          const left = t.couponPeriodsLeft - 1;
          await prisma.tenant.update({
            where: { id: payment.tenantId },
            data: left > 0
              ? { couponPeriodsLeft: left }
              : { couponPeriodsLeft: 0, activeCouponCode: null }, // jatah habis → lepas diskon
          });
        }
      } catch (err) {
        console.error("[coupon] redeem gagal (pembayaran tetap sukses):", err);
      }
    }

    // KOMISI KEAGENAN (gagal-jujur: kegagalan komisi TAK mengganggu aktivasi tenant).
    try {
      const { accrueCommission } = await import("@/lib/partner/partner-service");
      // Basis komisi = subtotal PRA-PAJAK (PPN diteruskan ke negara, bukan pendapatan Lumite).
      const { getCompanyProfile, effectiveTaxPercent } = await import("@/lib/services/company-service");
      const { getBillingPolicy } = await import("@/lib/billing/config");
      const [company, policy] = await Promise.all([getCompanyProfile(), getBillingPolicy()]);
      const taxPct = effectiveTaxPercent(company.isPkp, policy.taxPercent);
      const commissionBase = taxPct > 0 ? Math.round(payment.amount / (1 + taxPct / 100)) : payment.amount;
      await accrueCommission({
        orderId: payment.orderId,
        tenantId: payment.tenantId,
        grossIdr: commissionBase, // pra-pajak (bukan porsi PPN)
        monthsPaid: payment.periodMonths,
        settledAt: new Date(),
      });
    } catch (err) {
      console.error("[commission] accrue gagal (pembayaran tetap sukses):", err);
    }
  }

  // Refund/pembatalan → tarik balik komisi (reversal append-only).
  if ((newStatus === "FAILED" || newStatus === "EXPIRED") && alreadyPaid) {
    try {
      const { reverseCommission } = await import("@/lib/partner/partner-service");
      await reverseCommission(payment.orderId);
    } catch (err) {
      console.error("[commission] reversal gagal:", err);
    }
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
