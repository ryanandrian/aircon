/**
 * Webhook Midtrans untuk pesanan PERANGKAT IoT (terpisah dari langganan).
 * Verifikasi signature dulu, lalu proses. Idempoten.
 * Daftarkan di Midtrans bila pakai order_id IoT — atau arahkan notifikasi ke sini.
 */
import { NextRequest, NextResponse } from "next/server";
import { verifySignature } from "@/lib/billing/midtrans-client";
import { processIotPayment } from "@/lib/services/iot-order-service";

interface Notif {
  order_id?: string;
  status_code?: string;
  gross_amount?: string;
  signature_key?: string;
  transaction_status?: string;
  fraud_status?: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let notif: Notif;
  try {
    notif = (await req.json()) as Notif;
  } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }

  const { order_id, status_code, gross_amount, signature_key } = notif;
  if (!order_id || !status_code || !gross_amount || !signature_key) {
    return NextResponse.json({ error: "Field wajib kurang" }, { status: 400 });
  }

  if (!verifySignature({ orderId: order_id, statusCode: status_code, grossAmount: gross_amount, signatureKey: signature_key })) {
    return NextResponse.json({ error: "Signature tidak valid" }, { status: 403 });
  }

  try {
    await processIotPayment({
      order_id,
      transaction_status: notif.transaction_status,
      fraud_status: notif.fraud_status,
      gross_amount,
      raw: notif,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[iot-webhook] gagal:", err);
    return NextResponse.json({ error: "Gagal memproses" }, { status: 500 });
  }
}
