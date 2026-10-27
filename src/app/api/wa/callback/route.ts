/**
 * Callback dari Messaging Gateway (VPS-INFRA) → update status kirim & simpan pesan masuk.
 * AUTH: header X-Callback-Secret = WA_GATEWAY_CALLBACK_SECRET (server-only, timing-safe).
 * Payload: { type, externalId(=tenantId), ... } sesuai 10_WhatsApp_Gateway_Integration_Guide.md.
 */
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { getInfraSecrets } from "@/lib/services/infra-config-service";

const PLATFORM_SESSION = "lumite-platform";

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
      // G7-Aircon: pesan TULISAN pelanggan TIDAK lagi ditulis ke DB.
      // BUKTI: 4.034 baris INBOUND (100% dari nomor yang tidak pernah dituju
      // aplikasi; NOL pembaca, NOL tindak lanjut) = percakapan pribadi pelanggan
      // menumpuk tanpa gunanya + risiko privasi/hukum. Aircon TIDAK membutuhkan
      // balasan teks — yang dipakai = status pengiriman keluar (delivery_status).
      // Jalur callback TETAP membalas 200 (transport netral — gateway tak boleh
      // dipaksa tahu urusan penyimpanan konsumen).
      // Sejalan dengan G7 gateway: listener "message" sudah dibuang (live b4268c4),
      // jadi tipe ini praktis tak lagi diproduksi — cabang disimpan untuk
      // kompatibilitas konsumen lama.
    } else if (type === "sent" || type === "failed" || type === "delivery_status") {
      // Update status pesan keluar bila messageId dikenal (best-effort).
      const messageId = body.gatewayMessageId ? String(body.gatewayMessageId) : body.messageId ? String(body.messageId) : null;
      if (messageId) {
        const target = type === "sent" ? "SENT" : type === "failed" ? "FAILED" : String(body.status ?? "").toUpperCase();
        // Kombinasi literal sesuai enum MessageStatus; cast sekali di sini (tanpa namespace Prisma,
        // karena Prisma 7 + driver adapter tidak mengekspor namespace tersebut).
        const status = target as "QUEUED" | "SENDING" | "SENT" | "DELIVERED" | "READ_CONFIRMED" | "READ_UNOBSERVED" | "FAILED" | "LOGGED";
        // Guard monotonic: QUEUED < SENT < DELIVERED < READ_CONFIRMED/READ_UNOBSERVED.
        const rank: Record<string, number> = { QUEUED: 0, SENDING: 0, SENT: 1, DELIVERED: 2, READ_CONFIRMED: 3, READ_UNOBSERVED: 3, FAILED: 1, LOGGED: 0 };
        if (type === "delivery_status") {
          if (rank[target] === undefined) {
            return NextResponse.json({ ok: true, ignored: "status tidak dikenal" });
          }
          const cur = await prisma.messageLog.findFirst({
            where: { tenantId, gatewayMessageId: messageId },
            select: { status: true },
          });
          const curRank = rank[cur?.status as string] ?? 0;
          if (rank[target] <= curRank) {
            return NextResponse.json({ ok: true, ignored: "status tidak naik" });
          }
        }
        await prisma.messageLog.updateMany({
          where: { tenantId, gatewayMessageId: messageId },
          data: { status },
        }).catch(() => {});

        // -------------------------------------------------------------------
        // NOTIFIKASI PLATFORM (Lumite → tenant, sesi "lumite-platform").
        //
        // Callback ini SEBELUMNYA hanya memperbarui `messageLog`, sehingga
        // notifikasi platform terkirim lewat sesi platform TIDAK PERNAH naik
        // statusnya: kartu admin selamanya "SENT" walau gateway sudah
        // melaporkan DELIVERED / READ_CONFIRMED. Bukti live 26 Okt 2026:
        // job `1793026292127-87` (welcome → ABC Teknik) READ_CONFIRMED di
        // gateway, sementara baris PlatformNotification-nya tetap SENT.
        //
        // Diperbarui di SINI (callback yang sudah ada) — bukan jalur baru:
        // koreksi yang sama untuk sesi platform, dengan aturan monotonic
        // yang sama, dan HANYA untuk baris channel WA (email tak punya ACK).
        // -------------------------------------------------------------------
        if (tenantId === PLATFORM_SESSION) {
          const curNotif = await prisma.platformNotification.findFirst({
            where: { gatewayMessageId: messageId },
            select: { status: true, channel: true },
          });
          const curNotifRank = rank[curNotif?.status as string] ?? 0;
          if (curNotif && curNotif.channel === "WA" && rank[target] > curNotifRank) {
            await prisma.platformNotification.updateMany({
              where: { gatewayMessageId: messageId, channel: "WA" },
              data: { status },
            }).catch(() => {});
          }
        }
      }
    } else if (type === "disconnected") {
      // Paket tanpa otomasi WA tidak boleh menerima pesan bahwa pengingat otomatis berhenti.
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { plan: true },
      });
      if (tenant && tenant.plan !== "TRIAL" && tenantId !== PLATFORM_SESSION) {
        const stamp = new Date().toISOString().slice(0, 10);
        const { notifyPlatform, isAutoReminderPlan } = await import("@/lib/services/platform-notification-service");
        if (await isAutoReminderPlan(tenant.plan)) {
          await notifyPlatform({
            tenantId, templateKey: "wa_disconnected",
            dedupeKey: `wa_disconnected:${tenantId}:${stamp}`,
          }).catch(() => {});
        }
      }
    }
    // type qr/ready: informasi sesi — diproses UI (polling). Ack 200.
  } catch (err) {
    console.error("[wa-callback] error:", err);
  }
  return NextResponse.json({ ok: true });
}
