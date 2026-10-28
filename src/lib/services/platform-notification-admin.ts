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
  tenantName: string;
  channel: string;
  templateKey: string;
  toAddress: string;
  status: string;
  error: string | null;
  createdAt: Date;
  sentAt: Date | null;
}

export interface PlatformNotifSummary {
  queued: number; sent: number; failed: number; sending: number;
  /** Hasil kirim tak pasti (lease kedaluwarsa) — perlu review operator (G9/G29). */
  unknown: number;
}

export async function getPlatformNotifSummary(): Promise<PlatformNotifSummary> {
  const grouped = await prisma.platformNotification.groupBy({
    by: ["status"], _count: { _all: true },
  });
  const by = (s: string) => grouped.find((g) => g.status === s)?._count._all ?? 0;
  return { queued: by("QUEUED"), sent: by("SENT"), failed: by("FAILED"), sending: by("SENDING"), unknown: by("UNKNOWN") };
}

export async function listPlatformNotifs(limit = 50): Promise<PlatformNotifRow[]> {
  const rows = await prisma.platformNotification.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { tenant: { select: { name: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    tenantName: r.tenant?.name ?? r.tenantId,
    channel: r.channel,
    templateKey: r.templateKey,
    toAddress: r.toAddress,
    status: r.status,
    error: r.error,
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
