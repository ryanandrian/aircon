import "server-only";
import { prisma } from "@/lib/prisma";

export async function createTenantBookingNotification(input: { tenantId: string; leadId: string; name: string; service?: string | null }) {
  const service = input.service ? ` · ${input.service}` : "";
  return prisma.tenantNotification.create({
    data: {
      tenantId: input.tenantId,
      type: "NEW_LEAD",
      title: "Booking online baru",
      body: `${input.name} mengirim permintaan booking${service}.`,
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
