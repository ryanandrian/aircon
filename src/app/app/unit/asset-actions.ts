"use server";

import { revalidatePath } from "next/cache";
import { tryGetServerContext } from "@/lib/auth/context";
import { createAssetSchema } from "@/lib/validation/asset";
import {
  createAsset, createAssetsBulk, suggestLocations, findPossibleDuplicates,
  updateAsset, softDeleteAsset, listAssetRows, type ListAssetRowsResult,
} from "@/lib/services/asset-service";
import { listCustomers } from "@/lib/services/customer-service";

type Result = { ok: boolean; error?: string; createdCount?: number };

/** Saran lokasi utk combobox (prioritas pelanggan). */
export async function actionSuggestLocations(customerId?: string): Promise<string[]> {
  const ctx = await tryGetServerContext();
  if (!ctx?.tenantId) return [];
  return suggestLocations(ctx.tenantId, customerId || undefined);
}

/** Cek unit mirip (dedup-warning lunak) SEBELUM simpan. */
export async function actionCheckDuplicates(
  customerId: string,
  candidate: { brand?: string; capacityPk?: number; roomLocation?: string },
): Promise<{ id: string; label: string }[]> {
  const ctx = await tryGetServerContext();
  if (!ctx?.tenantId || !customerId) return [];
  const dups = await findPossibleDuplicates(ctx.tenantId, customerId, candidate);
  return dups.map((a) => ({
    id: a.id,
    label: `${a.brand ?? "AC"}${a.capacityPk ? ` ${a.capacityPk} PK` : ""}${a.roomLocation ? ` — ${a.roomLocation}` : ""}`,
  }));
}

/** Daftar pelanggan utk dropdown form unit. */
export async function actionListCustomersForAsset(): Promise<{ id: string; name: string }[]> {
  const ctx = await tryGetServerContext();
  if (!ctx?.tenantId) return [];
  const res = await listCustomers(ctx.tenantId, {});
  return res.data.map((c) => ({ id: c.id, name: c.name }));
}

/** Simpan unit: 1 record, atau N record (buat-massal) bila count>1. */
export async function actionCreateAsset(raw: {
  customerId: string;
  type: string;
  brand?: string;
  model?: string;
  capacityPk?: number;
  roomLocation?: string;
  serial?: string;
  count?: number;
}): Promise<Result> {
  const ctx = await tryGetServerContext();
  if (!ctx?.tenantId) return { ok: false, error: "Sesi tidak valid" };

  const parsed = createAssetSchema.safeParse({
    customerId: raw.customerId,
    type: raw.type,
    brand: raw.brand || undefined,
    model: raw.model || undefined,
    capacityPk: raw.capacityPk,
    roomLocation: raw.roomLocation || undefined,
    serial: raw.serial || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  }

  const count = Math.max(1, Math.min(Math.floor(raw.count ?? 1), 100));
  try {
    if (count > 1) {
      const created = await createAssetsBulk(ctx.tenantId, parsed.data, count);
      revalidatePath("/app/unit");
      return { ok: true, createdCount: created.length };
    }
    await createAsset(ctx.tenantId, parsed.data);
    revalidatePath("/app/unit");
    return { ok: true, createdCount: 1 };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal menyimpan unit" };
  }
}

/** Ubah unit AC (tenant-scoped). */
export async function actionUpdateAsset(id: string, raw: {
  type?: string; brand?: string; model?: string; capacityPk?: number; roomLocation?: string; serial?: string;
}): Promise<Result> {
  const ctx = await tryGetServerContext();
  if (!ctx?.tenantId) return { ok: false, error: "Sesi tidak valid" };
  try {
    await updateAsset(ctx.tenantId, id, {
      type: raw.type as never,
      brand: raw.brand ?? undefined,
      model: raw.model ?? undefined,
      capacityPk: raw.capacityPk,
      roomLocation: raw.roomLocation ?? undefined,
      serial: raw.serial ?? undefined,
    });
    revalidatePath("/app/unit");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal mengubah unit" };
  }
}

/** Hapus (soft-delete) unit AC. Riwayat job tetap tersimpan. */
export async function actionDeleteAsset(id: string): Promise<Result> {
  const ctx = await tryGetServerContext();
  if (!ctx?.tenantId) return { ok: false, error: "Sesi tidak valid" };
  try {
    await softDeleteAsset(ctx.tenantId, id);
    revalidatePath("/app/unit");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal menghapus unit" };
  }
}

/** Muat batch unit AC berikutnya (lazy-load / pencarian). */
export async function actionLoadAssets(
  params: { search?: string; cursor?: string },
): Promise<{ ok: boolean; error?: string } & Partial<ListAssetRowsResult>> {
  const ctx = await tryGetServerContext();
  if (!ctx?.tenantId) return { ok: false, error: "Sesi tidak valid" };
  try {
    const res = await listAssetRows(ctx.tenantId, { search: params.search, cursor: params.cursor });
    return { ok: true, ...res };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal memuat unit" };
  }
}
