/**
 * Platform Notification — admin view & manual trigger.
 * READ: ringkasan status + log terbaru. WRITE: kirim event manual ke 1 tenant (uji/pengumuman).
 * Semua entry admin WAJIB requirePlatformAdmin (dilakukan di server action pemanggil).
 */
import "server-only";
import { prisma } from "@/lib/prisma";
import type { PlatformTemplateKey } from "@/lib/domain/platform-templates";
import { PLATFORM_TEMPLATES } from "@/lib/domain/platform-templates";

export interface PlatformNotifRow {
  id: string;
  /** NULL untuk notifikasi mitra (F4) — baris tsb tak punya tenant. */
  tenantName: string | null;
  channel: string;
  templateKey: string;
  toAddress: string;
  status: string;
  error: string | null;
  /** Alasan ditahan (G28) — terisi bila status SUPPRESSED. */
  suppressedReason: string | null;
  createdAt: Date;
  sentAt: Date | null;
}

export interface PlatformNotifSummary {
  queued: number; sent: number; failed: number; sending: number;
  /** Hasil kirim tak pasti (lease kedaluwarsa) — perlu review operator (G9/G29). */
  unknown: number;
  /** DITAHAN karena penerima kosong (G28) — perlu perbaikan data kontak. */
  suppressed: number;
}

export async function getPlatformNotifSummary(): Promise<PlatformNotifSummary> {
  const grouped = await prisma.platformNotification.groupBy({
    by: ["status"], _count: { _all: true },
  });
  const by = (s: string) => grouped.find((g) => g.status === s)?._count._all ?? 0;
  return {
    queued: by("QUEUED"), sent: by("SENT"), failed: by("FAILED"),
    sending: by("SENDING"), unknown: by("UNKNOWN"), suppressed: by("SUPPRESSED"),
  };
}

export async function listPlatformNotifs(limit = 50): Promise<PlatformNotifRow[]> {
  const rows = await prisma.platformNotification.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { tenant: { select: { name: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    // Notifikasi mitra (F4) tak punya tenant → label "Mitra (agen/reseller)".
    tenantName: r.tenant?.name ?? r.tenantId ?? (r.partnerKind ? `Mitra ${r.partnerKind}` : "—"),
    channel: r.channel,
    templateKey: r.templateKey,
    toAddress: r.toAddress,
    status: r.status,
    error: r.error,
    suppressedReason: r.suppressedReason ?? null,
    createdAt: r.createdAt,
    sentAt: r.sentAt,
  }));
}

/**
 * Template yang boleh dikirim manual dari panel admin.
 * TIDAK termasuk: `subscription_activated` (mengikat transaksi: nominal, periode,
 * paket — hanya sah dari webhook pembayaran) dan `booking_inapp` (butuh `nama`
 * pemesan; dikirim ke inbox in-app tenant, bukan lewat antrean platform).
 */
const MANUAL_TEMPLATE_KEYS: readonly PlatformTemplateKey[] = [
  "welcome_basic",
  "welcome_paid",
  "subscription_due",
  "subscription_overdue",
  "wa_connected",
  "wa_disconnected",
];

export function platformTemplateOptions(): {
  key: PlatformTemplateKey; label: string; manualAllowed: boolean;
}[] {
  return (Object.keys(PLATFORM_TEMPLATES) as PlatformTemplateKey[]).map((key) => ({
    key,
    label: PLATFORM_TEMPLATES[key].label,
    manualAllowed: MANUAL_TEMPLATE_KEYS.includes(key),
  }));
}

/**
 * Replay manual satu notifikasi platform (G30) — tenant-scoped, permission-checked,
 * audit-logged. Dipanggil dari server action yang sudah lewat requirePlatformAdmin.
 *
 * ATURAN:
 *  - Hanya baris berstatus UNKNOWN atau FAILED (hasil tak pasti / gagal) boleh
 *    di-replay; baris SENT/DELIVERED/READ TIDAK (memang sudah sampai).
 *  - dedupeKey DIPERTAHANKAN ⇒ gateway idempotency tetap sama ⇒ tak ada duplikat
 *    ke penerima; bila gateway masih menyimpan job itu, ia menolak dengan 409
 *    (dicatat sebagai "duplicate", bukan gagal).
 *  - attempts direset agar retry dibolehkan; hasil & jejak ditulis ke audit log.
 */
export async function replayPlatformNotification(
  id: string,
  adminEmail: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const row = await prisma.platformNotification.findUnique({
    where: { id },
    select: { id: true, tenantId: true, status: true, templateKey: true, attempts: true, dedupeKey: true },
  });
  if (!row) return { ok: false, error: "Notifikasi tidak ditemukan" };
  if (!["UNKNOWN", "FAILED"].includes(row.status)) {
    // SUPPRESSED sengaja TIDAK bisa di-replay: penyebabnya penerima kosong,
    // jadi harus diperbaiki DATANYA dulu (bukan kirim ulang yang tetap gagal).
    return { ok: false, error: `Status ${row.status} tidak boleh di-replay (hanya UNKNOWN/FAILED)` };
  }
  await prisma.platformNotification.update({
    where: { id },
    data: {
      status: "QUEUED",
      attempts: 0,
      error: null,
      sendingAt: null,
      leaseExpiresAt: null,
      sentAt: null,
    },
  });
  await prisma.platformAuditLog.create({
    data: {
      actor: adminEmail,
      action: "PLATFORM_NOTIFICATION_REPLAY",
      target: `platform-notification:${id}`,
      metadata: {
        tenantId: row.tenantId,
        templateKey: row.templateKey,
        fromStatus: row.status,
        previousAttempts: row.attempts,
        dedupeKey: row.dedupeKey,
      },
    },
  });
  return { ok: true };
}

/**
 * Ringkasan tier bukti + tanda tidak sehat (F3: alert/dashboard).
 *
 * Tier pemisahan (prinsip: SENT ≠ delivered/read):
 *  - accepted : SENT (provider menerima operasi) — belum bukti sampai.
 *  - delivered: DELIVERED.
 *  - read     : READ_CONFIRMED / READ_UNOBSERVED.
 *  - unknown  : UNKNOWN (hasil tak pasti) — perlu review.
 *  - failed   : FAILED.
 * Plus penanda operasional: antrean menua (QUEUED lebih tua dari ambang) dan
 * SENDING tanpa lease (hasil tak pasti) — keduanya terlihat, tak diam-diam.
 */
export interface PlatformNotifHealth {
  accepted: number;
  delivered: number;
  read: number;
  unknown: number;
  failed: number;
  queued: number;
  sending: number;
  /** DITAHAN karena penerima kosong (G28) — butuh perbaikan data kontak. */
  suppressed: number;
  /** Antrean terlalu lama (menunggu terlalu lama tanpa dikirim). */
  queuedTooOld: number;
  /** SENDING tanpa lease = hasil tak pasti (proses kemungkinan mati di tengah). */
  sendingWithoutLease: number;
  /** Ada masalah yang perlu tindakan operator. */
  needsAttention: boolean;
}

/** Umur antrean dianggap terlalu lama (menit). */
export const QUEUED_STALE_MINUTES = 60;

export async function getPlatformNotifHealth(): Promise<PlatformNotifHealth> {
  const grouped = await prisma.platformNotification.groupBy({
    by: ["status"], _count: { _all: true },
  });
  const by = (s: string) => grouped.find((g) => g.status === s)?._count._all ?? 0;
  const staleBefore = new Date(Date.now() - QUEUED_STALE_MINUTES * 60_000);
  const queuedTooOld = await prisma.platformNotification.count({
    where: { status: "QUEUED", createdAt: { lt: staleBefore } },
  });
  const sendingWithoutLease = await prisma.platformNotification.count({
    where: { status: "SENDING", OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lt: new Date() } }] },
  });
  const accepted = by("SENT");
  const delivered = by("DELIVERED");
  const read = by("READ_CONFIRMED") + by("READ_UNOBSERVED");
  const unknown = by("UNKNOWN");
  const failed = by("FAILED");
  const queued = by("QUEUED");
  const sending = by("SENDING");
  const suppressed = by("SUPPRESSED");
  return {
    accepted, delivered, read, unknown, failed, queued, sending, suppressed,
    queuedTooOld, sendingWithoutLease,
    // SUPPRESSED ikut "perlu tindakan": penerima kosong = data kontak yang
    // harus diperbaiki operator, bukan sekadar catatan.
    needsAttention: unknown > 0 || failed > 0 || queuedTooOld > 0 || sendingWithoutLease > 0 || suppressed > 0,
  };
}
