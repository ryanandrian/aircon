/**
 * Webhook Midtrans TUNGGAL — menangani pembayaran LANGGANAN dan PERANGKAT IoT.
 * Verifikasi signature dulu, lalu bedakan jenis transaksi berdasar SUMBER DATA:
 *   - order_id terdaftar di tabel Payment   -> pembayaran langganan
 *   - order_id terdaftar di tabel IotOrder  -> pembayaran perangkat IoT
 * (Keduanya memakai format order_id yang sama, jadi dibedakan lewat lookup, bukan prefix.)
 *
 * Daftarkan SATU URL ini di dashboard Midtrans:
 *   https://<domain>/api/billing/midtrans-webhook
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySignature } from "@/lib/billing/midtrans-client";
import { processPaymentNotification } from "@/lib/services/subscription-service";
import { processIotPayment } from "@/lib/services/iot-order-service";

interface MidtransNotification {
  order_id?: string;
  status_code?: string;
  gross_amount?: string;
  signature_key?: string;
  transaction_status?: string;
  fraud_status?: string;
  transaction_id?: string;
  payment_type?: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let notif: MidtransNotification;
  try {
    notif = (await req.json()) as MidtransNotification;
  } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }

  const { order_id, status_code, gross_amount, signature_key } = notif;
  if (!order_id || !status_code || !gross_amount || !signature_key) {
    return NextResponse.json({ error: "Field wajib kurang" }, { status: 400 });
  }

  // SECURITY: verifikasi signature agar hanya Midtrans yang bisa mengubah status.
  const valid = verifySignature({
    orderId: order_id,
    statusCode: status_code,
    grossAmount: gross_amount,
    signatureKey: signature_key,
  });
  if (!valid) {
    return NextResponse.json({ error: "Signature tidak valid" }, { status: 403 });
  }

  try {
    // Bedakan jenis transaksi via lookup order_id (bukan tebak prefix).
    const iotOrder = await prisma.iotOrder.findUnique({
      where: { paymentOrderId: order_id },
      select: { id: true },
    });

    if (iotOrder) {
      // Pembayaran PERANGKAT IoT.
      await processIotPayment({
        order_id,
        transaction_status: notif.transaction_status,
        fraud_status: notif.fraud_status,
        gross_amount,
        raw: notif,
      });
      return NextResponse.json({ ok: true, kind: "iot" });
    }

    // Selain itu → pembayaran LANGGANAN (processPaymentNotification aman bila order tak dikenal).
    await processPaymentNotification({
      order_id,
      transaction_status: notif.transaction_status,
      fraud_status: notif.fraud_status,
      transaction_id: notif.transaction_id,
      payment_type: notif.payment_type,
      gross_amount,
      raw: notif,
    });
    return NextResponse.json({ ok: true, kind: "subscription" });
  } catch (err) {
    console.error("[midtrans-webhook] gagal proses:", err);
    // 500 agar Midtrans retry.
    return NextResponse.json({ error: "Gagal memproses" }, { status: 500 });
  }
}
