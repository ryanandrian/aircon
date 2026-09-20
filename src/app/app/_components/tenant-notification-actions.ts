"use server";

import { revalidatePath } from "next/cache";
import { tryGetServerContext } from "@/lib/auth/context";
import { listTenantNotifications, markTenantNotificationRead } from "@/lib/services/tenant-notification-service";

export async function actionMarkNotificationRead(id: string) {
  const ctx = await tryGetServerContext();
  if (!ctx?.tenantId) return { ok: false, error: "Sesi tidak valid" };
  await markTenantNotificationRead(ctx.tenantId, id);
  revalidatePath("/app");
  return { ok: true };
}

export async function actionListNotifications(unreadOnly = true) {
  const ctx = await tryGetServerContext();
  if (!ctx?.tenantId) return { ok: false as const, error: "Sesi tidak valid" };
  const rows = await listTenantNotifications(ctx.tenantId, unreadOnly);
  return { ok: true as const, rows: rows.map((row: { id: string; tenantId: string; type: string; title: string; body: string; entityId: string | null; dedupeKey: string; readAt: Date | null; createdAt: Date }) => ({ ...row, createdAt: row.createdAt.toISOString(), readAt: row.readAt?.toISOString() ?? null })) };
}
