"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { AuthError } from "@/lib/auth/guard";
import {
  addPlatformAdmin,
  setPlatformAdminActive,
  removePlatformAdmin,
  AdminMgmtError,
} from "@/lib/services/platform-admin-service";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

/** Guard bersama: setiap action WAJIB lolos requirePlatformAdmin. */
async function guard(): Promise<ActionResult | null> {
  try {
    await requirePlatformAdmin();
    return null;
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.message };
    return { ok: false, error: "Gagal memverifikasi akses admin." };
  }
}

function toResult(fn: () => Promise<void>): Promise<ActionResult> {
  return fn()
    .then(() => {
      revalidatePath("/admin/tim");
      return { ok: true };
    })
    .catch((e) => {
      if (e instanceof AdminMgmtError) return { ok: false, error: e.message };
      return { ok: false, error: (e as Error).message };
    });
}

export async function actionAddAdmin(email: string, name: string): Promise<ActionResult> {
  const g = await guard();
  if (g) return g;
  return toResult(() => addPlatformAdmin(email, name));
}

export async function actionSetAdminActive(id: string, active: boolean): Promise<ActionResult> {
  const g = await guard();
  if (g) return g;
  if (!id) return { ok: false, error: "ID admin wajib." };
  return toResult(() => setPlatformAdminActive(id, active));
}

export async function actionRemoveAdmin(id: string): Promise<ActionResult> {
  const g = await guard();
  if (g) return g;
  if (!id) return { ok: false, error: "ID admin wajib." };
  return toResult(() => removePlatformAdmin(id));
}
