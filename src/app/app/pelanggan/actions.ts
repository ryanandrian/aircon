"use server";

import { revalidatePath } from "next/cache";
import { tryGetServerContext } from "@/lib/auth/context";
import { createCustomerSchema, updateCustomerSchema } from "@/lib/validation/customer";
import {
  createCustomer, updateCustomer, softDeleteCustomer, ServiceError,
} from "@/lib/services/customer-service";

type Result = { ok: boolean; error?: string };

const SOURCE_VALUES = ["REFERRAL", "WHATSAPP", "WALK_IN", "MARKETING", "WEBSITE", "IOT_ALERT", "REPEAT", "OTHER"] as const;

function normSource(v: string): (typeof SOURCE_VALUES)[number] | undefined {
  return SOURCE_VALUES.includes(v as never) ? (v as (typeof SOURCE_VALUES)[number]) : undefined;
}

/** Tambah pelanggan. */
export async function actionCreateCustomer(raw: {
  name: string; phone: string; address?: string; source?: string; notes?: string;
}): Promise<Result> {
  const ctx = await tryGetServerContext();
  if (!ctx?.tenantId) return { ok: false, error: "Sesi tidak valid" };

  const parsed = createCustomerSchema.safeParse({
    name: raw.name,
    phone: raw.phone,
    address: raw.address || undefined,
    source: normSource(raw.source ?? ""),
    notes: raw.notes || undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };

  try {
    await createCustomer(ctx.tenantId, parsed.data);
    revalidatePath("/app/pelanggan");
    return { ok: true };
  } catch (e) {
    if (e instanceof ServiceError) return { ok: false, error: e.message };
    return { ok: false, error: e instanceof Error ? e.message : "Gagal menambah pelanggan" };
  }
}

/** Ubah pelanggan. */
export async function actionUpdateCustomer(id: string, raw: {
  name?: string; phone?: string; address?: string; source?: string; notes?: string;
}): Promise<Result> {
  const ctx = await tryGetServerContext();
  if (!ctx?.tenantId) return { ok: false, error: "Sesi tidak valid" };

  const parsed = updateCustomerSchema.safeParse({
    name: raw.name,
    phone: raw.phone,
    address: raw.address ?? undefined,
    source: raw.source ? normSource(raw.source) : undefined,
    notes: raw.notes ?? undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };

  try {
    await updateCustomer(ctx.tenantId, id, parsed.data);
    revalidatePath("/app/pelanggan");
    return { ok: true };
  } catch (e) {
    if (e instanceof ServiceError) return { ok: false, error: e.message };
    return { ok: false, error: e instanceof Error ? e.message : "Gagal mengubah pelanggan" };
  }
}

/** Hapus (soft-delete) pelanggan. */
export async function actionDeleteCustomer(id: string): Promise<Result> {
  const ctx = await tryGetServerContext();
  if (!ctx?.tenantId) return { ok: false, error: "Sesi tidak valid" };
  try {
    await softDeleteCustomer(ctx.tenantId, id);
    revalidatePath("/app/pelanggan");
    return { ok: true };
  } catch (e) {
    if (e instanceof ServiceError) return { ok: false, error: e.message };
    return { ok: false, error: e instanceof Error ? e.message : "Gagal menghapus pelanggan" };
  }
}
