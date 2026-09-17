import { prisma } from "@/lib/prisma";
import { checkIpaymuTransaction } from "@/lib/billing/ipaymu-client";
import { mapIpaymuStatus, mapIpaymuStatusCode } from "@/lib/billing/ipaymu-logic";
import { processIpaymuNotification } from "@/lib/services/subscription-service";
import { processIotPayment } from "@/lib/services/iot-order-service";

const MAX_AGE_HOURS = 48;

interface ReconcileSummary {
  checkedSubscriptions: number;
  checkedIotOrders: number;
  settled: number;
}

export async function reconcilePendingPayments(): Promise<ReconcileSummary> {
  const cutoff = new Date(Date.now() - MAX_AGE_HOURS * 3_600_000);
  const summary: ReconcileSummary = { checkedSubscriptions: 0, checkedIotOrders: 0, settled: 0 };
  const subscriptions = await prisma.payment.findMany({
    where: { status: { in: ["PENDING", "FAILED", "EXPIRED"] }, createdAt: { gte: cutoff } },
    select: { orderId: true, amount: true }, orderBy: { createdAt: "asc" }, take: 300,
  });
  for (const payment of subscriptions) {
    summary.checkedSubscriptions++;
    try {
      const status = await checkIpaymuTransaction(payment.orderId);
      const mapped = status.paidStatus.toLowerCase() === "paid" || status.statusCode === 1 || status.transactionStatusCode === 7
        ? "PAID" : status.status ? mapIpaymuStatus(status.status) : mapIpaymuStatusCode(status.statusCode);
      const result = await processIpaymuNotification({ referenceId: payment.orderId, status: mapped, transactionId: status.transactionId, amount: status.subtotal || payment.amount, raw: status });
      if (result.status === "PAID") summary.settled++;
    } catch (error) { console.warn(`[reconcile] subscription ${payment.orderId} failed`, error); }
  }
  const orders = await prisma.iotOrder.findMany({
    where: { status: "PENDING_PAYMENT", paymentOrderId: { not: null }, createdAt: { gte: cutoff } },
    select: { paymentOrderId: true }, take: 200,
  });
  for (const order of orders) {
    if (!order.paymentOrderId) continue;
    summary.checkedIotOrders++;
    try {
      const status = await checkIpaymuTransaction(order.paymentOrderId);
      const mapped = status.paidStatus.toLowerCase() === "paid" || status.statusCode === 1 || status.transactionStatusCode === 7
        ? "PAID" : status.status ? mapIpaymuStatus(status.status) : mapIpaymuStatusCode(status.statusCode);
      const result = await processIotPayment({ order_id: order.paymentOrderId, status: mapped, status_code: mapped === "PAID" ? 1 : 0, amount: status.subtotal, raw: status });
      if (result.paid) summary.settled++;
    } catch (error) { console.warn(`[reconcile] IoT ${order.paymentOrderId} failed`, error); }
  }
  return summary;
}
