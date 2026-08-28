"use server";

import { revalidatePath } from "next/cache";
import { tryGetServerContext } from "@/lib/auth/context";
import {
  setCustomerPrice, removeCustomerPrice,
} from "@/lib/services/service-catalog-service";
import { ServiceError } from "@/lib/services/customer-service";

type Result = { ok: boolean; error?: string };

function canManage(role: string): boolean {
  return role === "OWNER" || role === "ADMIN";
}

/** Tambah/ubah harga khusus (K21 pola tambah per item). */
export async function actionSetCustomerPrice(customerId: string, serviceId: string, price: number): Promise<Result> {
  const ctx = await tryGetServerContext();
  if (!ctx?.tenantId) return { ok: false, error: "Sesi tidak valid" };
  if (!canManage(ctx.role)) return { ok: false, error: "Tidak berwenang" };
  if (!Number.isFinite(price) || price < 0) return { ok: false, error: "Harga tidak valid" };
  try {
    await setCustomerPrice(ctx.tenantId, customerId, serviceId, price);
    revalidatePath(`/app/pelanggan/${customerId}/harga`);
    return { ok: true };
  } catch (e) {
    if (e instanceof ServiceError) return { ok: false, error: e.message };
    return { ok: false, error: e instanceof Error ? e.message : "Gagal menyimpan harga khusus" };
  }
}

/** Hapus harga khusus → kembali ke harga standar. */
export async function actionRemoveCustomerPrice(customerId: string, serviceId: string): Promise<Result> {
  const ctx = await tryGetServerContext();
  if (!ctx?.tenantId) return { ok: false, error: "Sesi tidak valid" };
  if (!canManage(ctx.role)) return { ok: false, error: "Tidak berwenang" };
  try {
    await removeCustomerPrice(ctx.tenantId, customerId, serviceId);
    revalidatePath(`/app/pelanggan/${customerId}/harga`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal menghapus" };
  }
}
