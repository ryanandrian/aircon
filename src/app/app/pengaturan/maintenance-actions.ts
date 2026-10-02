"use server";

import { revalidatePath } from "next/cache";
import { getServerContext } from "@/lib/auth/context";
import { assertRole, AuthError } from "@/lib/auth/guard";
import { getMaintenanceInterval, updateMaintenanceInterval, updateReminderLeadDays } from "@/lib/services/tenant-profile-service";
import { ServiceError } from "@/lib/services/customer-service";

export type MaintenanceIntervalResult =
  | { ok: true; days: number }
  | { ok: false; error: string };

export type ReminderLeadResult =
  | { ok: true; days: number }
  | { ok: false; error: string };

function toMessage(e: unknown, fallback: string): string {
  if (e instanceof AuthError) return e.message;
  if (e instanceof ServiceError) return e.message;
  console.error("[pengaturan/maintenance] gagal:", e);
  return fallback;
}

/** Baca interval servis default usaha yang sedang login. */
export async function actionGetMaintenanceInterval(): Promise<MaintenanceIntervalResult> {
  try {
    const ctx = await getServerContext();
    assertRole(ctx.role, ["OWNER", "ADMIN"]);
    const days = await getMaintenanceInterval(ctx.tenantId);
    return { ok: true, days };
  } catch (e) {
    return { ok: false, error: toMessage(e, "Gagal memuat jadwal servis.") };
  }
}

/** Simpan interval servis default usaha. tenantId diambil dari sesi terverifikasi, bukan input. */
export async function actionSaveMaintenanceInterval(days: number): Promise<MaintenanceIntervalResult> {
  try {
    const ctx = await getServerContext();
    assertRole(ctx.role, ["OWNER", "ADMIN"]);
    await updateMaintenanceInterval(ctx.tenantId, days);
    revalidatePath("/app/pengaturan");
    revalidatePath("/app");
    revalidatePath("/app/pelanggan");
    return { ok: true, days };
  } catch (e) {
    return { ok: false, error: toMessage(e, "Gagal menyimpan jadwal servis.") };
  }
}

/** Simpan jarak kirim pengingat. tenantId diambil dari sesi terverifikasi, bukan input. */
export async function actionSaveReminderLeadDays(days: number): Promise<ReminderLeadResult> {
  try {
    const ctx = await getServerContext();
    assertRole(ctx.role, ["OWNER", "ADMIN"]);
    await updateReminderLeadDays(ctx.tenantId, days);
    revalidatePath("/app/pengaturan");
    revalidatePath("/app");
    return { ok: true, days };
  } catch (e) {
    return { ok: false, error: toMessage(e, "Gagal menyimpan jarak kirim pengingat.") };
  }
}
