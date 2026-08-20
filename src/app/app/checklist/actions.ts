"use server";

import { getServerContext } from "@/lib/auth/context";
import { assertRole } from "@/lib/auth/guard";
import { saveChecklist, resetChecklist } from "@/lib/services/checklist-template-service";
import type { ChecklistItem } from "@/lib/domain/defaults";
import { revalidatePath } from "next/cache";

export type ClResult = { ok: true; items?: ChecklistItem[] } | { ok: false; error: string };

export async function actionSaveChecklist(serviceType: string, items: ChecklistItem[]): Promise<ClResult> {
  try {
    const ctx = await getServerContext();
    assertRole(ctx.role, ["OWNER", "ADMIN"]);
    await saveChecklist(ctx.tenantId, serviceType, items);
    revalidatePath("/app/checklist");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal menyimpan" };
  }
}

export async function actionResetChecklist(serviceType: string): Promise<ClResult> {
  try {
    const ctx = await getServerContext();
    assertRole(ctx.role, ["OWNER", "ADMIN"]);
    const items = await resetChecklist(ctx.tenantId, serviceType);
    revalidatePath("/app/checklist");
    return { ok: true, items };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal reset" };
  }
}
