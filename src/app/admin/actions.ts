"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { setTenantStatus } from "@/lib/services/platform-service";
import { AuthError } from "@/lib/auth/guard";
import type { TenantStatus } from "@prisma/client";

const VALID_STATUSES: readonly TenantStatus[] = [
  "TRIAL",
  "ACTIVE",
  "PAST_DUE",
  "SUSPENDED",
  "CANCELLED",
];

export interface ActionResult {
  ok: boolean;
  error?: string;
}

/**
 * Ubah status langganan sebuah usaha. Entry admin — WAJIB requirePlatformAdmin.
 * Error ditangani eksplisit dan dikembalikan ke UI.
 */
export async function actionSetTenantStatus(
  tenantId: string,
  status: string,
): Promise<ActionResult> {
  // GUARD: setiap action admin harus lolos requirePlatformAdmin.
  try {
    await requirePlatformAdmin();
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.message };
    return { ok: false, error: "Gagal memverifikasi akses admin." };
  }

  if (!tenantId) return { ok: false, error: "ID usaha wajib diisi." };
  if (!VALID_STATUSES.includes(status as TenantStatus)) {
    return { ok: false, error: `Status tidak valid: ${status}` };
  }

  try {
    await setTenantStatus(tenantId, status as TenantStatus);
    revalidatePath(`/admin/tenants/${tenantId}`);
    revalidatePath("/admin/tenants");
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
