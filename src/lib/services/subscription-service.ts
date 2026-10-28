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

/**
 * Nama tampilan paket dari PlanConfig; fallback ke enum bila konfig hilang.
 * Untuk payment outcome, paket yang dimaksud adalah PAKET YANG DIBELI
 * (payment.plan), bukan paket saat ini — pembayaran gagal tidak mengubah paket.
 */
async function planDisplayName(plan: TenantPlan): Promise<string> {
  try {
    const cfg = await prisma.planConfig.findUnique({ where: { plan } });
    if (cfg?.displayName) return cfg.displayName;
  } catch { /* konfig tak terbaca → pakai nama enum */ }
  return plan;
}

const rupiah = (n: number) => new Intl.NumberFormat("id-ID", {
  style: "currency", currency: "IDR", maximumFractionDigits: 0,
}).format(n);

const tanggalID = (d: Date) => d.toLocaleDateString("id-ID", {
  day: "numeric", month: "long", year: "numeric",
});

/**
 * G7 — notifikasi pembayaran GAGAL / KEDALUWARSA.
 *
 * Tiga aturan yang diuji (tests/payment-outcome-notify.test.ts):
 *  1. Terbit hanya pada TRANSISI nyata ke FAILED/EXPIRED — bukan saat baris
 *     sudah berstatus itu (webhook boleh diulang berkali-kali).
 *  2. `paket` berasal dari payment.plan (paket yang DIBELI). Tenant bisa saja
 *     masih TRIAL/Basic saat upgrade gagal — menyebut paket saat ini akan
 *     menyesatkan.
 *  3. Dedupe per (orderId, status) sehingga retry gateway tak menggandakan.
 *
 * Copy menegaskan status paket TIDAK berubah; link menunjuk halaman Langganan
 * yang memuat riwayat transaksi + tombol ulangi bayar untuk order yang sama.
 *
 * CATATAN KEBIJAKAN (dicatat di tracker, bukan diam-diam):
 *  - Cakupan: SEMUA tenant yang transaksinya gagal, termasuk yang masih Basic.
 *    Matriks F0 menuliskan "n/a" untuk kolom Basic, tetapi kolom itu menjelaskan
 *    tagihan BERULANG — sedangkan `startIpaymuPayment` menolak paket berharga 0,
 *    sehingga setiap Payment yang gagal SELALU milik paket berbayar. Menahan
 *    pesan dari pemilik yang baru saja mencoba upgrade justru meninggalkan
 *    kebingungan. Keputusan: gate-nya adalah pembayaran itu sendiri, bukan
 *    paket saat ini.
 *  - Kanal EMAIL saja, sesuai matriks ("email + halaman Langganan"). Kanal
 *    kedua = halaman Langganan, yang selalu menampilkan transaksi + tombol
 *    ulangi bayar tanpa perlu SMTP terkonfigurasi.
 */
async function notifyPaymentOutcome(
  payment: { tenantId: string; orderId: string; plan: TenantPlan; amount: number },
  status: "FAILED" | "EXPIRED",
): Promise<void> {
  const { notifyPlatform } = await import("@/lib/services/platform-notification-service");
  await notifyPlatform({
    tenantId: payment.tenantId,
    templateKey: status === "EXPIRED" ? "payment_expired" : "payment_failed",
    channels: ["EMAIL"],
    vars: {
      paket: await planDisplayName(payment.plan),
      nominal: rupiah(payment.amount),
      tanggal: tanggalID(new Date()),
    },
    dedupeKey: `payment:${payment.orderId}:${status}`,
  });
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
  // G7: notifikasi outcome hanya pada TRANSISI PENDING → FAILED/EXPIRED,
  // yaitu satu-satunya jalur terminal pertama untuk order ini. Syarat
  // `payment.status === "PENDING"` menjamin tepat SATU pesan outcome per order
  // walau gateway mengirim ulang atau status berpindah antar-terminal.
  const transitionedToFailure = payment.status === "PENDING" && (next === "FAILED" || next === "EXPIRED");
  // GATE IDEMPOTENSI. `updateMany` dengan predicate status lama = gerbang atomik
  // transisi: count=1 berarti PEMANGGIL INI yang memenangkan transisi; count=0
  // berarti callback lain sudah menerapkannya lebih dulu. Tanpa gerbang ini,
  // dua webhook paralel yang sama-sama membaca PENDING akan sama-sama menghitung
  // transisi dan berdua mencoba enqueue. (dedupeKey tetap jaring pengaman
  // kedua, tapi tidak boleh menjadi satu-satunya.)
  const applied = await prisma.payment.updateMany({ where: { orderId: payment.orderId, status: payment.status }, data: { status: next, providerTransactionId: notif.transactionId ?? payment.providerTransactionId, providerPaymentType: notif.paymentType ?? payment.providerPaymentType, paidAt: next === "PAID" ? new Date() : payment.paidAt, rawNotif: notif.raw as never } });
  const wonTransition = applied.count > 0;
  if (transitionedToPaid && wonTransition) {
    await activateSubscription(payment.tenantId, payment.plan, payment.periodMonths, payment.amount);
    // G2 — Konfirmasi paket aktif setelah pembayaran benar-benar lunas.
    // Sekali per transisi (transitionedToPaid), idempoten per orderId, gagal-jujur:
    // kegagalan antre tidak membatalkan aktivasi langganan yang sudah commit.
    try {
      const platform = await import("@/lib/services/platform-notification-service");
      const periodEnd = await prisma.tenant.findUnique({
        where: { id: payment.tenantId },
        select: { currentPeriodEnd: true },
      });
      const sub = await prisma.subscription.findUnique({
        where: { tenantId: payment.tenantId },
        select: { currentPeriodEnd: true },
      });
      // Tanggal periode WAJIB dari data periode yang benar-benar ditulis aktivasi.
      // `activateSubscription` menulis kolom yang sama di Tenant DAN Subscription;
      // keduanya dibaca karena satu bisa null walau aktivasi berhasil. `new Date()`
      // TIDAK PERNAH dipakai sebagai fallback — itu memalsukan batas periode.
      // Tanpa tanggal sama sekali, konfirmasi dilewati: lebih jujur daripada
      // mengarang, dan kasus ini tercatat sebagai error untuk ditindak.
      const periodEndDate = periodEnd?.currentPeriodEnd ?? sub?.currentPeriodEnd ?? null;
      if (!periodEndDate) {
        console.error(`[subscription-activated] lewati: tenant=${payment.tenantId} order=${payment.orderId} tidak punya currentPeriodEnd di Tenant maupun Subscription (periode tidak tertulis) — konfirmasi tidak dikirim agar tidak menyebut tanggal salah`);
      } else {
        // CTA sambung WA HANYA bila paket yang DIBELI mengizinkan autoReminder.
        // Tanpa gerbang ini, tenant yang membeli paket tanpa otomasi akan menerima
        // ajakan mengaktifkan fitur yang tidak tersedia bagi mereka.
        const allowAuto = await platform.isAutoReminderPlan(payment.plan);
        await platform.notifyPlatform({
          tenantId: payment.tenantId,
          templateKey: "subscription_activated",
          vars: {
            tanggal: periodEndDate.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }),
            nominal: new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(payment.amount),
            cta: allowAuto
              ? "Untuk mengaktifkan pengingat servis otomatis, sambungkan WhatsApp usaha di Pengaturan → Hubungkan WhatsApp. Pengiriman otomatis dimulai setelah status koneksi tersambung. "
              : "Paket ini tidak memiliki pengiriman otomatis; kelola pengingat Anda dari menu Pengingat. ",
          },
          dedupeKey: `payment:${payment.orderId}:PAID`, // idempoten: webhook boleh ulang, pesan tetap 1
        });
      }
    } catch (err) {
      console.error(`[subscription-activated] gagal antre (aktivasi tetap sukses) tenant=${payment.tenantId}:`, err);
    }
  }
  if (transitionedToFailure && wonTransition) {
    // Kegagalan notifikasi TIDAK boleh membatalkan pemrosesan pembayaran yang sudah commit.
    try {
      await notifyPaymentOutcome(payment, next as "FAILED" | "EXPIRED");
    } catch (err) {
      console.error(`[payment-outcome] gagal antre tenant=${payment.tenantId} order=${payment.orderId} status=${next}:`, err);
    }
  }
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
