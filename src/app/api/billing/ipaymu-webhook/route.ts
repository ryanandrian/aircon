import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mapIpaymuStatus, mapIpaymuStatusCode } from "@/lib/billing/ipaymu-logic";
import { verifyIpaymuCallback } from "@/lib/billing/ipaymu-client";
import { processIpaymuNotification } from "@/lib/services/subscription-service";
import { processIotPayment } from "@/lib/services/iot-order-service";

function normalizeData(raw: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(raw)) {
    const value = raw[key];
    if (key === "is_escrow") result[key] = value === "true" || value === "1" || value === 1;
    else if (["trx_id", "status_code", "transaction_status_code", "paid_off"].includes(key)) result[key] = Number.parseInt(String(value), 10);
    else if (key === "additional_info") result[key] = value === "[]" ? [] : value;
    else result[key] = String(value);
  }
  if (!Object.prototype.hasOwnProperty.call(result, "additional_info")) result.additional_info = [];
  return result;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawText = await req.text();
  let body: Record<string, unknown>;
  try {
    const trimmed = rawText.trim();
    if (trimmed.startsWith("{")) body = JSON.parse(trimmed) as Record<string, unknown>;
    else {
      const form = Object.fromEntries(new URLSearchParams(trimmed));
      const values = Object.values(form);
      body = values.length === 1 && typeof values[0] === "string" && values[0].trim().startsWith("{") ? JSON.parse(values[0]) as Record<string, unknown> : form;
    }
  } catch { return NextResponse.json({ error: "Body tidak valid" }, { status: 400 }); }

  const signature = req.headers.get("x-signature") ?? "";
  if (!(await verifyIpaymuCallback(normalizeData(body), signature))) return NextResponse.json({ error: "Signature tidak valid" }, { status: 403 });
  const referenceId = String(body.reference_id ?? body.referenceId ?? "");
  if (!referenceId) return NextResponse.json({ error: "reference_id wajib" }, { status: 400 });

  try {
    const rawStatus = String(body.status ?? "");
    const statusCode = Number(body.status_code ?? -99);
    const transactionStatusCode = Number(body.transaction_status_code ?? -99);
    const paid = ["berhasil", "success", "paid"].includes(rawStatus.toLowerCase()) || statusCode === 1 || transactionStatusCode === 1 || String(body.paid_status ?? "").toLowerCase() === "paid";
    const status = paid ? "PAID" : rawStatus ? mapIpaymuStatus(rawStatus) : mapIpaymuStatusCode(statusCode);
    const amount = Number(body.sub_total ?? body.amount ?? 0);
    const iot = await prisma.iotOrder.findUnique({ where: { paymentOrderId: referenceId }, select: { id: true } });
    if (iot) {
      await processIotPayment({ order_id: referenceId, status, status_code: paid ? 1 : statusCode, amount, raw: body });
    } else {
      await processIpaymuNotification({ referenceId, status, transactionId: String(body.trx_id ?? ""), amount, paymentType: String(body.channel ?? body.via ?? ""), raw: body });
    }
  } catch (error) {
    console.error("[ipaymu-webhook] gagal proses:", error);
    return NextResponse.json({ error: "Gagal memproses" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
