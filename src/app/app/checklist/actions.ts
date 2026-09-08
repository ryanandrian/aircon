"use server";

import { getServerContext } from "@/lib/auth/context";
import { assertRole } from "@/lib/auth/guard";
import { saveChecklist, removeChecklist, saveServiceChecklist, removeServiceChecklist } from "@/lib/services/checklist-template-service";
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

/** Nonaktifkan checklist satu jenis servis (opt-out) → kembali kosong/tak berlaku. */
export async function actionRemoveChecklist(serviceType: string): Promise<ClResult> {
  try {
    const ctx = await getServerContext();
    assertRole(ctx.role, ["OWNER", "ADMIN"]);
    await removeChecklist(ctx.tenantId, serviceType);
    revalidatePath("/app/checklist");
    return { ok: true, items: [] };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal menonaktifkan" };
  }
}

// ── FASE 2: checklist per LAYANAN (serviceId) ──

/** Simpan & terapkan checklist satu LAYANAN. */
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
