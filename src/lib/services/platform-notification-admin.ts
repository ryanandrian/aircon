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
}

export async function getPlatformNotifSummary(): Promise<PlatformNotifSummary> {
  const grouped = await prisma.platformNotification.groupBy({
    by: ["status"], _count: { _all: true },
  });
  const by = (s: string) => grouped.find((g) => g.status === s)?._count._all ?? 0;
  return { queued: by("QUEUED"), sent: by("SENT"), failed: by("FAILED"), sending: by("SENDING") };
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

/** Daftar template (untuk dropdown UI). */
export function platformTemplateOptions(): { key: PlatformTemplateKey; label: string }[] {
  return (Object.keys(PLATFORM_TEMPLATES) as PlatformTemplateKey[]).map((key) => ({
    key, label: PLATFORM_TEMPLATES[key].label,
  }));
}
