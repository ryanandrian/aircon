/**
 * Reconciler pembayaran (PULL) — PENJAMIN bila webhook Midtrans meleset.
 * Penting untuk akun Midtrans BERBAGI (aiwa/mesinviral/aircon): notifikasi push bisa
 * terkirim ke URL app lain. Reconciler menanyakan status langsung ke API Midtrans
 * (terautentikasi server key = tepercaya) untuk semua pembayaran PENDING, lalu
 * menerapkan hasil lewat JALUR YANG SAMA dengan webhook (processPaymentNotification /
 * processIotPayment) — idempoten.
 */
import { prisma } from "@/lib/prisma";
import { getTransactionStatus } from "@/lib/billing/midtrans-client";
import { processPaymentNotification } from "@/lib/services/subscription-service";
import { processIotPayment } from "@/lib/services/iot-order-service";

const MAX_AGE_HOURS = 48;

interface ReconcileSummary {
  checkedSubscriptions: number;
  checkedIotOrders: number;
  settled: number;
}

/** Bangun objek notif dari status API (tepercaya — tanpa signature). */
function toNotif(orderId: string, s: {
  transaction_status?: string;
  fraud_status?: string;
  gross_amount?: string;
  transaction_id?: string;
  payment_type?: string;
}) {
  return {
    order_id: orderId,
    transaction_status: s.transaction_status,
    fraud_status: s.fraud_status,
    gross_amount: s.gross_amount,
    transaction_id: s.transaction_id,
    payment_type: s.payment_type,
    raw: s as unknown,
  };
}

function isHttp404(e: unknown): boolean {
  return typeof e === "object" && e !== null && "status" in e && (e as { status?: number }).status === 404;
}

/**
 * Rekonsiliasi semua pembayaran PENDING (langganan + IoT) berusia < 48 jam.
 * Fail-soft per baris (1 error tak menghentikan loop). Idempoten.
 */
export async function reconcilePendingPayments(): Promise<ReconcileSummary> {
  const cutoff = new Date(Date.now() - MAX_AGE_HOURS * 3_600_000);
  const summary: ReconcileSummary = { checkedSubscriptions: 0, checkedIotOrders: 0, settled: 0 };

  // ---- Langganan ----
  const subs = await prisma.payment.findMany({
    where: { status: "PENDING", createdAt: { gte: cutoff } },
    select: { orderId: true },
    take: 200,
  });
  for (const p of subs) {
    summary.checkedSubscriptions++;
    try {
      const s = await getTransactionStatus(p.orderId);
      const res = await processPaymentNotification(toNotif(p.orderId, s));
      if (res.status === "PAID") summary.settled++;
    } catch (e) {
      if (isHttp404(e)) continue; // belum dibayar — biarkan pending
      console.warn(`[reconcile] langganan ${p.orderId} gagal:`, e);
    }
  }

  // ---- Pesanan IoT ----
  const iot = await prisma.iotOrder.findMany({
    where: { status: "PENDING_PAYMENT", paymentOrderId: { not: null }, createdAt: { gte: cutoff } },
    select: { paymentOrderId: true },
    take: 200,
  });
  for (const o of iot) {
    if (!o.paymentOrderId) continue;
    summary.checkedIotOrders++;
    try {
      const s = await getTransactionStatus(o.paymentOrderId);
      const res = await processIotPayment(toNotif(o.paymentOrderId, s));
      if (res.paid) summary.settled++;
    } catch (e) {
      if (isHttp404(e)) continue;
      console.warn(`[reconcile] IoT ${o.paymentOrderId} gagal:`, e);
    }
  }

  return summary;
}
