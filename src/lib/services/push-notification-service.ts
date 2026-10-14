/**
 * Web Push Service — kirim notifikasi PWA ke perangkat teknisi/kernet (rute /t).
 *
 * FASE 1 (keputusan pemilik 2026-10-14): khusus notifikasi PENUGASAN.
 *
 * Jalur yang dipakai (semua sudah ada, nol modul baru):
 * - Auth: tryGetServerContext() — SATU-SATUNYA sumber tenantId/userId.
 * - Pola service: pola tenant-notification-service.ts (create/list/updateMany).
 * - Pola aman-gagal: pola platform-notification-dispatch.ts (per item, error tak
 *   menghentikan lain) — push TIDAK PERNAH memblokir penugasan.
 * - Kontrak klien: PushSubscriptionJSON { endpoint, keys:{p256dh,auth} } (W3C).
 *
 * KEPUTUSAN DESAIN (dokumentasi permanen, bukan komentar basi):
 * - Satu baris = satu perangkat (deviceId dari klien). Android = target fase 1.
 * - revokedAt (bukan hapus baris) saat endpoint basi 410 Gone → jejak audit +
 *   mencegah kirim ulang ke endpoint mati; baris lama tetap bisa dibaca.
 * - Env: PUSH_VAPID_PUBLIC_KEY / PUSH_VAPID_PRIVATE_KEY / PUSH_VAPID_SUBJECT.
 *   Bila belum diset → fitur nonaktif SENYAP tapi jujur (return ok:false +
 *   error jelas), TANPA crash — rollout additive seperti pola planConfig.
 */
import "server-only";
import webpush from "web-push";
import { prisma } from "@/lib/prisma";
import { tryGetServerContext } from "@/lib/auth/context";

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

function vapidConfigured(): boolean {
  return Boolean(
    (process.env.PUSH_VAPID_PUBLIC_KEY ?? "").trim() &&
    (process.env.PUSH_VAPID_PRIVATE_KEY ?? "").trim(),
  );
}

let vapidReady = false;
function ensureVapid(): boolean {
  if (!vapidConfigured()) return false;
  if (vapidReady) return true;
  webpush.setVapidDetails(
    process.env.PUSH_VAPID_SUBJECT ?? "mailto:admin@lumite.biz.id",
    process.env.PUSH_VAPID_PUBLIC_KEY as string,
    process.env.PUSH_VAPID_PRIVATE_KEY as string,
  );
  vapidReady = true;
  return true;
}

/** Validasi bentuk subscription W3C (endpoint https + dua key base64url). */
function isValidSubscription(input: unknown): input is { endpoint: string; keys: { p256dh: string; auth: string } } {
  if (!input || typeof input !== "object") return false;
  const s = input as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  return (
    typeof s.endpoint === "string" &&
    s.endpoint.startsWith("https://") &&
    typeof s.keys === "object" &&
    s.keys !== null &&
    typeof s.keys.p256dh === "string" && s.keys.p256dh.length > 20 &&
    typeof s.keys.auth === "string" && s.keys.auth.length > 10
  );
}

/**
 * Simpan/aktifkan subscription perangkat milik user yang sedang login.
 * Idempoten via unique (tenantId,userId,deviceId): ganti kredensial browser
 * (rotate key) → row diperbarui, bukan baris kembar.
 */
export async function upsertPushSubscription(input: {
  deviceId: string;
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
  userAgent?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const ctx = await tryGetServerContext();
  if (!ctx) return { ok: false, error: "Belum masuk" };
  if (!isValidSubscription(input.subscription)) return { ok: false, error: "Subscription tidak valid" };
  if (!input.deviceId || typeof input.deviceId !== "string") return { ok: false, error: "deviceId wajib" };

  const { endpoint, keys } = input.subscription;
  await prisma.pushSubscription.upsert({
    where: {
      tenantId_userId_deviceId: { tenantId: ctx.tenantId, userId: ctx.userId, deviceId: input.deviceId },
    },
    create: {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      deviceId: input.deviceId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent: input.userAgent ?? null,
    },
    update: {
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent: input.userAgent ?? null,
      revokedAt: null, // subscribe ulang = aktif kembali
      updatedAt: new Date(),
    },
  });
  return { ok: true };
}

/** Cabut subscription perangkat (logout/PWA uninstall). Aman-gagal. */
export async function revokePushSubscription(input: { deviceId: string }): Promise<{ ok: boolean }> {
  const ctx = await tryGetServerContext();
  if (!ctx) return { ok: false };
  await prisma.pushSubscription.updateMany({
    where: { tenantId: ctx.tenantId, userId: ctx.userId, deviceId: input.deviceId, revokedAt: null },
    data: { revokedAt: new Date() },
  }).catch(() => {});
  return { ok: true };
}

/** Revoke by endpoint — dipanggil dari jalur kirim saat endpoint basi (410). */
async function revokeByEndpoint(endpoint: string): Promise<void> {
  await prisma.pushSubscription.updateMany({
    where: { endpoint, revokedAt: null },
    data: { revokedAt: new Date() },
  }).catch(() => {});
}

export interface SendPushResult { sent: number; revoked: number; failed: number; skipped: number }

/**
 * Kirim push ke SEMUA perangkat aktif milik satu user (teknisi/kernet/admin).
 * Aman-gagal per perangkat; idempoten via tag payload.
 */
export async function sendPushToUser(input: {
  tenantId: string;
  userId: string;
  payload: PushPayload;
}): Promise<SendPushResult> {
  const result: SendPushResult = { sent: 0, revoked: 0, failed: 0, skipped: 0 };
  if (!ensureVapid()) return { ...result, skipped: 1 }; // env belum diset — jujur, tanpa crash

  const subs = await prisma.pushSubscription.findMany({
    where: { tenantId: input.tenantId, userId: input.userId, revokedAt: null },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  if (subs.length === 0) return { ...result, skipped: 1 };

  const body = JSON.stringify({
    title: input.payload.title,
    body: input.payload.body,
    url: input.payload.url ?? "/t",
    tag: input.payload.tag ?? null,
  });

  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        body,
        { TTL: 24 * 60 * 60, urgency: "high" }, // tugas lapangan: sampai cepat
      );
      await prisma.pushSubscription.update({ where: { id: s.id }, data: { lastSentAt: new Date() } }).catch(() => {});
      result.sent += 1;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        // Endpoint mati/basi → revoke (bukan hapus) supaya tidak dikirim lagi.
        await revokeByEndpoint(s.endpoint);
        result.revoked += 1;
      } else {
        // Gangguan sementara (5xx/network) → biarkan aktif, cron retry menanganinya.
        result.failed += 1;
      }
    }
  }
  return result;
}
