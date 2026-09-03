/**
 * Callback dari Messaging Gateway (VPS-INFRA) → update status kirim & simpan pesan masuk.
 * AUTH: header X-Callback-Secret = WA_GATEWAY_CALLBACK_SECRET (server-only, timing-safe).
 * Payload: { type, externalId(=tenantId), ... } sesuai 10_WhatsApp_Gateway_Integration_Guide.md.
 */
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { getInfraSecrets } from "@/lib/services/infra-config-service";

async function authorized(req: NextRequest): Promise<boolean> {
  const { callbackSecret } = await getInfraSecrets();
  const secret = callbackSecret || process.env.WA_GATEWAY_CALLBACK_SECRET;
  if (!secret) return false;
  const got = req.headers.get("x-callback-secret") ?? "";
  const a = Buffer.from(got);
  const b = Buffer.from(secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  if (!(await authorized(req))) {
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
    } else if (type === "disconnected") {
      // AUTOPILOT: WA tenant putus → beri tahu tenant agar hubungkan ulang (pulihkan money-loop).
      // Sesi platform (lumite-platform) TAK memicu ini — hanya sesi tenant nyata.
      if (tenantId !== "lumite-platform") {
        const stamp = new Date().toISOString().slice(0, 10);
        const { notifyPlatform } = await import("@/lib/services/platform-notification-service");
        await notifyPlatform({
          tenantId, templateKey: "wa_disconnected",
          dedupeKey: `wa_disconnected:${tenantId}:${stamp}`, // maks 1x/hari
        }).catch(() => {});
      }
    }
    // type qr/ready: informasi sesi — diproses UI (polling). Ack 200.
  } catch (err) {
    console.error("[wa-callback] error:", err);
  }
  return NextResponse.json({ ok: true });
}
