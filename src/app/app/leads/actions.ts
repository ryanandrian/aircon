"use server";

import { revalidatePath } from "next/cache";
import { tryGetServerContext } from "@/lib/auth/context";
import { convertLeadToCustomer } from "@/lib/services/lead-service";
import { prisma } from "@/lib/prisma";
import type { LeadStatus } from "@prisma/client";

type Result = { ok: boolean; error?: string };

function canManage(role: string) { return role === "OWNER" || role === "ADMIN"; }

export async function actionUpdateLeadStatus(leadId: string, status: LeadStatus): Promise<Result> {
  const ctx = await tryGetServerContext();
  if (!ctx?.tenantId) return { ok: false, error: "Sesi tidak valid" };
  if (!canManage(ctx.role)) return { ok: false, error: "Tidak berwenang" };
  if (!["NEW", "CONTACTED", "QUOTED", "LOST"].includes(status)) return { ok: false, error: "Status tidak valid" };
  const updated = await prisma.lead.updateMany({ where: { id: leadId, tenantId: ctx.tenantId }, data: { status } });
  if (!updated.count) return { ok: false, error: "Lead tidak ditemukan" };
  revalidatePath("/app/leads");
  return { ok: true };
}

export async function actionConvertLead(leadId: string): Promise<Result & { customerId?: string }> {
  const ctx = await tryGetServerContext();
  if (!ctx?.tenantId) return { ok: false, error: "Sesi tidak valid" };
  if (!canManage(ctx.role)) return { ok: false, error: "Tidak berwenang" };
  try {
    const result = await convertLeadToCustomer(ctx.tenantId, leadId);
    revalidatePath("/app/leads");
    revalidatePath("/app/pelanggan");
    return { ok: true, customerId: result.customer.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal mengubah lead menjadi pelanggan" };
  }
}
