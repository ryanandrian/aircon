/**
 * Webhook Midtrans — menerima notifikasi status pembayaran.
 * Verifikasi signature sebelum memproses. Idempoten.
 * URL ini didaftarkan di dashboard Midtrans: /api/billing/midtrans-webhook
 */
import { NextRequest, NextResponse } from "next/server";
import { verifySignature } from "@/lib/billing/midtrans-client";
import { processPaymentNotification } from "@/lib/services/subscription-service";

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

  // SECURITY: verifikasi signature agar hanya Midtrans yang bisa update status.
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
    await processPaymentNotification({
      order_id,
      transaction_status: notif.transaction_status,
      fraud_status: notif.fraud_status,
      transaction_id: notif.transaction_id,
      payment_type: notif.payment_type,
      gross_amount,
      raw: notif,
    });
    // Midtrans hanya butuh 200 OK.
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[midtrans-webhook] gagal proses:", err);
    // 500 agar Midtrans retry.
    return NextResponse.json({ error: "Gagal memproses" }, { status: 500 });
  }
}
