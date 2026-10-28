import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Notifikasi in-app "booking online baru" untuk owner tenant (G18).
 *
 * Copy: dari katalog template platform (`booking_inapp`) — dapat diedit admin
 * di Admin → Notifikasi; fallback ke default bila belum ada override.
 * Fallback default DIRENDER dari template yang sama (bukan string terpisah),
 * sehingga hanya ada SATU sumber copy.
 *
 * Idempoten: dedupeKey `new-lead:<leadId>`; P2002 = notifikasi sudah ada → null.
 */
export async function createTenantBookingNotification(input: { tenantId: string; leadId: string; name: string; service?: string | null }) {
  const { getActiveTemplate } = await import("@/lib/services/platform-template-service");
  const { renderPlatformTemplate } = await import("@/lib/domain/platform-templates");
  const active = await getActiveTemplate("booking_inapp");
  const rendered = renderPlatformTemplate("booking_inapp", {
    nama: input.name,
    // " · CLEANING" atau kosong — bila kosong, kalimat tetap rapi (tak ada
    // spasi/sektor gantung).
    layanan: input.service ? ` · ${input.service}` : "",
  }, { subject: active.subject, body: active.body });

  return prisma.tenantNotification.create({
    data: {
      tenantId: input.tenantId,
      type: "NEW_LEAD",
      title: rendered.subject,
      body: rendered.body,
      entityId: input.leadId,
      dedupeKey: `new-lead:${input.leadId}`,
    },
  }).catch((error: unknown) => {
    if (error instanceof Error && "code" in error && (error as { code?: string }).code === "P2002") return null;
    throw error;
  });
}

export async function listTenantNotifications(tenantId: string, unreadOnly = false) {
  return prisma.tenantNotification.findMany({
    where: { tenantId, ...(unreadOnly ? { readAt: null } : {}) },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function markTenantNotificationRead(tenantId: string, id: string) {
  return prisma.tenantNotification.updateMany({ where: { id, tenantId, readAt: null }, data: { readAt: new Date() } });
}
