"use server";

import { getServerContext } from "@/lib/auth/context";
import { assertRole } from "@/lib/auth/guard";
import { saveTemplate, resetTemplate } from "@/lib/services/message-template-service";
import { revalidatePath } from "next/cache";

export type TplResult = { ok: true; body?: string } | { ok: false; error: string };

export async function actionSaveTemplate(key: string, fd: FormData): Promise<TplResult> {
  try {
    const ctx = await getServerContext();
    assertRole(ctx.role, ["OWNER", "ADMIN"]);
    await saveTemplate(ctx.tenantId, key, String(fd.get("body") ?? ""));
    revalidatePath("/app/pesan");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal menyimpan" };
  }
}

export async function actionResetTemplate(key: string): Promise<TplResult> {
  try {
    const ctx = await getServerContext();
    assertRole(ctx.role, ["OWNER", "ADMIN"]);
    const body = await resetTemplate(ctx.tenantId, key);
    revalidatePath("/app/pesan");
    return { ok: true, body };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal reset" };
  }
}
