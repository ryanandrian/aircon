"use server";

import { revalidatePath } from "next/cache";
import { getServerContext } from "@/lib/auth/context";
import { markCashRemitted } from "@/lib/services/ar-service";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
const msg = (e: unknown, fb: string) => (e instanceof Error ? e.message : fb);

/** Tandai setoran kas teknisi (K17). Owner/admin only. */
export async function actionMarkCashRemitted(invoiceIds: string[]): Promise<Result<{ count: number }>> {
  try {
    const ctx = await getServerContext();
    if (ctx.role !== "OWNER" && ctx.role !== "ADMIN") {
      return { ok: false, error: "Hanya admin/pemilik yang boleh mencatat setoran." };
    }
    const count = await markCashRemitted(ctx.tenantId, invoiceIds);
    revalidatePath("/app/laporan");
    return { ok: true, data: { count } };
  } catch (e) {
    return { ok: false, error: msg(e, "Gagal mencatat setoran") };
  }
}
