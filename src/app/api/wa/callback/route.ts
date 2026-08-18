/**
 * Callback dari Messaging Gateway (VPS-INFRA) → update status kirim & simpan pesan masuk.
 * AUTH: header X-Callback-Secret = WA_GATEWAY_CALLBACK_SECRET (server-only, timing-safe).
 * Payload: { type, externalId(=tenantId), ... } sesuai 10_WhatsApp_Gateway_Integration_Guide.md.
 */
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

function authorized(req: NextRequest): boolean {
  const secret = process.env.WA_GATEWAY_CALLBACK_SECRET;
  if (!secret) return false;
  const got = req.headers.get("x-callback-secret") ?? "";
  const a = Buffer.from(got);
  const b = Buffer.from(secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 }); }

  const type = String(body.type ?? "");
  const tenantId = String(body.externalId ?? "");
  if (!type || !tenantId) return NextResponse.json({ ok: false, error: "type/externalId wajib" }, { status: 400 });

  try {
    if (type === "inbound") {
      // Simpan pesan masuk customer.
      await prisma.messageLog.create({
        data: {
          tenantId, channel: "WA", direction: "INBOUND", status: "DELIVERED",
          toPhone: String(body.fromPhone ?? ""), body: String(body.body ?? ""),
        },
      }).catch(() => { /* MessageLog opsional; jangan gagalkan callback */ });
    } else if (type === "sent" || type === "failed") {
      // Update status pesan keluar bila messageId dikenal (best-effort).
      const messageId = body.messageId ? String(body.messageId) : null;
      if (messageId) {
        await prisma.messageLog.updateMany({
          where: { tenantId, gatewayMessageId: messageId },
          data: { status: type === "sent" ? "SENT" : "FAILED" },
        }).catch(() => {});
      }
    }
    // type qr/ready/disconnected: informasi sesi — bisa diproses UI nanti; ack 200.
  } catch (err) {
    console.error("[wa-callback] error:", err);
  }
  return NextResponse.json({ ok: true });
}
