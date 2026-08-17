/**
 * IoT Order Service — pemesanan device jual-putus + pembayaran Midtrans.
 * Harga dari IotProduct (DB, editable admin). Semua tenant-scoped.
 */
import { prisma } from "@/lib/prisma";
import type { IotOrder, IotProduct } from "@prisma/client";
import { getBillingPolicy } from "@/lib/billing/config";
import { createSnapTransaction, isMidtransConfigured } from "@/lib/billing/midtrans-client";
import { makeOrderId, parseMidtransStatus } from "@/lib/billing/midtrans-logic";
import { makeIotOrderNo, computeOrderTotals } from "@/lib/services/iot-order-logic";

export class IotOrderError extends Error {
  code: "NOT_CONFIGURED" | "NOT_FOUND" | "INVALID";
  constructor(code: IotOrderError["code"], message: string) {
    super(message);
    this.name = "IotOrderError";
    this.code = code;
  }
}

/** Daftar produk device aktif (untuk halaman pemesanan). */
export async function listProducts(): Promise<IotProduct[]> {
  return prisma.iotProduct.findMany({ where: { active: true }, orderBy: { priceUnit: "asc" } });
}

/** Jumlah device terpasang milik tenant (untuk gating monitor). */
export async function countInstalledDevices(tenantId: string): Promise<number> {
  // SECURITY: tenant-scoped.
  return prisma.device.count({ where: { tenantId } });
}

/**
 * Buat pesanan device (PENDING_PAYMENT). Harga & pajak dari DB.
 * SECURITY: tenantId dari session pemanggil.
 */
export async function createIotOrder(params: {
  tenantId: string;
  productId: string;
  quantity: number;
  createdById: string;
  shippingAddress?: string;
}): Promise<IotOrder> {
  const product = await prisma.iotProduct.findFirst({
    where: { id: params.productId, active: true },
  });
  if (!product) throw new IotOrderError("NOT_FOUND", "Produk tidak tersedia");

  const policy = await getBillingPolicy();
  const qty = Math.max(1, Math.floor(params.quantity));
  const { subtotal, taxAmount, total } = computeOrderTotals(product.priceUnit, qty, policy.taxPercent);

  return prisma.iotOrder.create({
    data: {
      tenantId: params.tenantId,
      orderNo: makeIotOrderNo(params.tenantId),
      status: "PENDING_PAYMENT",
      quantity: qty,
      unitPrice: product.priceUnit,
      subtotal,
      taxPercent: policy.taxPercent,
      taxAmount,
      total,
      shippingAddress: params.shippingAddress ?? null,
      createdById: params.createdById,
      items: {
        create: [{ productId: product.id, quantity: qty, unitPrice: product.priceUnit }],
      },
    },
  });
}

/**
 * Mulai pembayaran Snap untuk pesanan device.
 * SECURITY: tenant-scoped (findFirst id+tenantId).
 */
export async function startIotOrderPayment(
  orderId: string,
  tenantId: string,
  customerName: string,
  email?: string,
): Promise<{ snapToken: string; redirectUrl: string }> {
  if (!isMidtransConfigured()) {
    throw new IotOrderError("NOT_CONFIGURED", "Pembayaran belum dikonfigurasi. Hubungi admin.");
  }
  const order = await prisma.iotOrder.findFirst({ where: { id: orderId, tenantId } });
  if (!order) throw new IotOrderError("NOT_FOUND", "Pesanan tidak ditemukan");
  if (order.status !== "PENDING_PAYMENT") throw new IotOrderError("INVALID", "Pesanan sudah diproses");

  const paymentOrderId = makeOrderId(tenantId);
  const snap = await createSnapTransaction({
    orderId: paymentOrderId,
    amount: order.total,
    customerName,
    customerEmail: email,
    itemName: `Perangkat IoT Aircon (${order.quantity} unit)`,
  });

  await prisma.iotOrder.update({
    where: { id: order.id },
    data: { paymentOrderId, snapToken: snap.token, snapRedirect: snap.redirectUrl },
  });

  return { snapToken: snap.token, redirectUrl: snap.redirectUrl };
}

/** Proses notifikasi Midtrans untuk pesanan IoT (dipanggil webhook). Idempoten. */
export async function processIotPayment(notif: {
  order_id: string;
  transaction_status?: string;
  fraud_status?: string;
  gross_amount?: string;
  raw: unknown;
}): Promise<{ paid: boolean; tenantId: string | null }> {
  const order = await prisma.iotOrder.findUnique({ where: { paymentOrderId: notif.order_id } });
  if (!order) return { paid: false, tenantId: null };

  // Anti-tamper: gross_amount harus cocok total.
  if (notif.gross_amount !== undefined) {
    const amt = Math.round(Number(notif.gross_amount));
    if (!Number.isFinite(amt) || amt !== order.total) {
      return { paid: false, tenantId: order.tenantId };
    }
  }

  const status = parseMidtransStatus(notif);
  const alreadyPaid = order.status !== "PENDING_PAYMENT";

  if (status === "PAID" && !alreadyPaid) {
    await prisma.iotOrder.update({
      where: { id: order.id },
      data: { status: "PAID", paidAt: new Date() },
    });
    return { paid: true, tenantId: order.tenantId };
  }
  return { paid: false, tenantId: order.tenantId };
}

/** Daftar pesanan device milik tenant. */
export async function listTenantOrders(tenantId: string): Promise<IotOrder[]> {
  return prisma.iotOrder.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" } });
}

/** Ambil satu pesanan (tenant-scoped). */
export async function getOrder(orderId: string, tenantId: string): Promise<IotOrder | null> {
  return prisma.iotOrder.findFirst({ where: { id: orderId, tenantId } });
}
