"use server";

import { getServerContext } from "@/lib/auth/context";
import { assertRole } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import {
  createIotOrder,
  startIotOrderPayment,
  IotOrderError,
} from "@/lib/services/iot-order-service";

export type OrderActionResult =
  | { ok: true; snapToken: string; redirectUrl: string }
  | { ok: false; error: string };

/** Buat pesanan device lalu mulai pembayaran. SECURITY: OWNER/ADMIN saja. */
export async function orderAndPay(
  productId: string,
  quantity: number,
  shippingAddress: string,
): Promise<OrderActionResult> {
  try {
    const ctx = await getServerContext();
    assertRole(ctx.role, ["OWNER", "ADMIN"]);

    const order = await createIotOrder({
      tenantId: ctx.tenantId,
      productId,
      quantity,
      createdById: ctx.userId,
      shippingAddress: shippingAddress || undefined,
    });

    const tenant = await prisma.tenant.findUnique({
      where: { id: ctx.tenantId },
      select: { phone: true },
    });
    const pay = await startIotOrderPayment(order.id, ctx.tenantId, ctx.name, ctx.email ?? undefined, tenant?.phone ?? undefined);
    return { ok: true, snapToken: pay.snapToken, redirectUrl: pay.redirectUrl };
  } catch (err) {
    if (err instanceof IotOrderError) return { ok: false, error: err.message };
    console.error("[orderAndPay] gagal:", err);
    return { ok: false, error: "Gagal membuat pesanan. Coba lagi." };
  }
}
