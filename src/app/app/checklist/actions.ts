"use server";

import { getServerContext } from "@/lib/auth/context";
import { assertRole } from "@/lib/auth/guard";
import { saveServiceChecklist, removeServiceChecklist } from "@/lib/services/checklist-template-service";
import type { ChecklistItem } from "@/lib/domain/defaults";
import { revalidatePath } from "next/cache";

export type ClResult = { ok: true; items?: ChecklistItem[] } | { ok: false; error: string };

/** Simpan & terapkan checklist satu LAYANAN. SECURITY: OWNER/ADMIN + tenant dari sesi. */
export async function actionSaveServiceChecklist(serviceId: string, items: ChecklistItem[]): Promise<ClResult> {
  try {
    const ctx = await getServerContext();
    assertRole(ctx.role, ["OWNER", "ADMIN"]);
    await saveServiceChecklist(ctx.tenantId, serviceId, items);
    revalidatePath("/app/checklist");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal menyimpan" };
  }
}

/** Nonaktifkan checklist satu LAYANAN (opt-out). */
export async function actionRemoveServiceChecklist(serviceId: string): Promise<ClResult> {
  try {
    const ctx = await getServerContext();
    assertRole(ctx.role, ["OWNER", "ADMIN"]);
    await removeServiceChecklist(ctx.tenantId, serviceId);
    revalidatePath("/app/checklist");
    return { ok: true, items: [] };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal menonaktifkan" };
  }
}
