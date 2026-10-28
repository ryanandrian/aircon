/**
 * FALLBACK PUSH (G14) — bila pesan utama (WA/email) GAGAL PERMANEN, kirim push
 * ke owner tenant sebagai jalur cadangan.
 *
 * KAPAN dipakai:
 *  - `MessageLog` (WA tenant→pelanggan) gagal permanen → push ke OWNER tenant,
 *    supaya owner tahu ada pelanggan yang tak bisa dihubungi (bisa dihubungi
 *    manual).
 *  - `PlatformNotification` (Aircon→owner) gagal permanen → push ke owner itu
 *    sendiri.
 *
 * KAPAN TIDAK dipakai:
 *  - Kegagalan TRANSIENT (sesi penuh, tekanan memori, karantina): pesan dikembalikan
 *    ke antrean (deferred) dan akan dikirim ulang — fallback akan dobel.
 *  - Duplikat (409): pesan sebenarnya sudah terkirim — tak perlu fallback.
 *  - Status UNKNOWN: hasil tak pasti; kirim ulang bisa dobel ke penerima.
 *
 * Prinsip: fallback TIDAK boleh mengubah status/keberadaan pesan utama. Pesan
 * utama tetap FAILED (atau apa pun) — push hanya menambah buktiVia.
 */
import "server-only";
import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/services/push-notification-service";

export interface PushFallbackResult {
  attempted: boolean;
  sent: number;
  skipped: number;
  failed: number;
  revoked: number;
  reason?: string;
}

/** Ambil owner (role OWNER) pertama tenant. Null bila tenant tanpa owner. */
async function findOwnerId(tenantId: string): Promise<string | null> {
  const owner = await prisma.user.findFirst({
    where: { tenantId, role: "OWNER", status: "ACTIVE" },
    select: { id: true },
  });
  return owner?.id ?? null;
}

/**
 * Fallback push untuk pesan OWNER (PlatformNotification) yang gagal permanen.
 * `templateKey` dipakai sebagai tag push (dedupe per event di sisi perangkat).
 */
export async function pushFallbackForOwnerMessage(params: {
  tenantId: string;
  title: string;
  body: string;
  tag: string;
}): Promise<PushFallbackResult> {
  try {
    const ownerId = await findOwnerId(params.tenantId);
    if (!ownerId) {
      return { attempted: false, sent: 0, skipped: 0, failed: 0, revoked: 0, reason: "tenant tanpa owner aktif" };
    }
    const r = await sendPushToUser({
      tenantId: params.tenantId,
      userId: ownerId,
      payload: { title: params.title, body: params.body, url: "/app", tag: params.tag },
    });
    return { attempted: true, sent: r.sent, skipped: r.skipped, failed: r.failed, revoked: r.revoked };
  } catch (e) {
    console.error("[push-fallback] gagal:", e instanceof Error ? e.message : e);
    return { attempted: false, sent: 0, skipped: 0, failed: 0, revoked: 0, reason: "error" };
  }
}

/**
 * Fallback push untuk pesan WA tenant→PELANGGAN yang gagal permanen: push ke
 * OWNER tenant supaya ia tahu pelanggan tak bisa dihubungi via WA.
 */
export async function pushFallbackForCustomerMessage(params: {
  tenantId: string;
  customerLabel: string;
  templateKey: string;
}): Promise<PushFallbackResult> {
  try {
    const ownerId = await findOwnerId(params.tenantId);
    if (!ownerId) {
      return { attempted: false, sent: 0, skipped: 0, failed: 0, revoked: 0, reason: "tenant tanpa owner aktif" };
    }
    const r = await sendPushToUser({
      tenantId: params.tenantId,
      userId: ownerId,
      payload: {
        title: "Pesan tak terkirim",
        body: `Pesan untuk ${params.customerLabel} gagal terkirim (${params.templateKey}). Hubungi manual.`,
        url: "/app/pesan",
        tag: `fallback:${params.templateKey}`,
      },
    });
    return { attempted: true, sent: r.sent, skipped: r.skipped, failed: r.failed, revoked: r.revoked };
  } catch (e) {
    console.error("[push-fallback] gagal:", e instanceof Error ? e.message : e);
    return { attempted: false, sent: 0, skipped: 0, failed: 0, revoked: 0, reason: "error" };
  }
}
