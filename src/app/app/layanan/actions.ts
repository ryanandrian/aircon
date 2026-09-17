"use server";

import { revalidatePath } from "next/cache";
import { tryGetServerContext } from "@/lib/auth/context";
import {
  createCatalogItem, updateCatalogItem, deleteCatalogItem, listOverridesForService,
  setCatalogActive,
  type CatalogInput,
} from "@/lib/services/service-catalog-service";
import { ServiceError } from "@/lib/services/customer-service";

type Result = { ok: boolean; error?: string };

function canManage(role: string): boolean {
  return role === "OWNER" || role === "ADMIN";
}

const CATEGORIES = ["MAINTENANCE", "SERVICE", "CONSUMABLE", "SPAREPART", "PAKET", "SURVEI", "GARANSI", "LAINNYA"] as const;
const INC = ["PERCENT", "VALUE"] as const;

function sanitize(raw: Record<string, unknown>): CatalogInput {
  const cat = String(raw.category ?? "");
  const catVal = CATEGORIES.includes(cat as typeof CATEGORIES[number]) ? (cat as typeof CATEGORIES[number]) : "SERVICE";
  const incT = String(raw.techIncentiveType ?? "");
  const techIncType = INC.includes(incT as typeof INC[number]) ? (incT as typeof INC[number]) : "VALUE";
  const kncT = String(raw.kernetIncentiveType ?? "");
  const kncIncType = INC.includes(kncT as typeof INC[number]) ? (kncT as typeof INC[number]) : "VALUE";
  return {
    code: String(raw.code ?? "").trim(),
    name: String(raw.name ?? "").trim(),
    category: catVal,
    standardPrice: Number(raw.standardPrice) || 0,
    unit: String(raw.unit ?? "unit").trim() || "unit",
    description: raw.description ? String(raw.description).trim() : undefined,
    active: raw.active !== false,
    techIncentiveType: techIncType,
    techIncentiveValue: Number(raw.techIncentiveValue) || 0,
    kernetIncentiveType: kncIncType,
    kernetIncentiveValue: Number(raw.kernetIncentiveValue) || 0,
  };
}

export async function actionCreateCatalog(raw: Record<string, unknown>): Promise<Result> {
  const ctx = await tryGetServerContext();
  if (!ctx?.tenantId) return { ok: false, error: "Sesi tidak valid" };
  if (!canManage(ctx.role)) return { ok: false, error: "Tidak berwenang" };
  const input = sanitize(raw);
  if (!input.code) return { ok: false, error: "Kode layanan wajib diisi" };
  if (!input.name) return { ok: false, error: "Nama layanan wajib diisi" };
  try {
    await createCatalogItem(ctx.tenantId, input);
    revalidatePath("/app/layanan");
    return { ok: true };
  } catch (e) {
    if (e instanceof ServiceError) return { ok: false, error: e.message };
    return { ok: false, error: e instanceof Error ? e.message : "Gagal membuat layanan" };
  }
}

export async function actionUpdateCatalog(id: string, raw: Record<string, unknown>): Promise<Result> {
  const ctx = await tryGetServerContext();
  if (!ctx?.tenantId) return { ok: false, error: "Sesi tidak valid" };
  if (!canManage(ctx.role)) return { ok: false, error: "Tidak berwenang" };
  try {
    await updateCatalogItem(ctx.tenantId, id, sanitize(raw));
    revalidatePath("/app/layanan");
    return { ok: true };
  } catch (e) {
    if (e instanceof ServiceError) return { ok: false, error: e.message };
    return { ok: false, error: e instanceof Error ? e.message : "Gagal memperbarui layanan" };
  }
}

export async function actionDeleteCatalog(id: string): Promise<Result> {
  const ctx = await tryGetServerContext();
  if (!ctx?.tenantId) return { ok: false, error: "Sesi tidak valid" };
  if (!canManage(ctx.role)) return { ok: false, error: "Tidak berwenang" };
  try {
    await deleteCatalogItem(ctx.tenantId, id);
    revalidatePath("/app/layanan");
    return { ok: true };
  } catch (e) {
    if (e instanceof ServiceError) return { ok: false, error: e.message };
    return { ok: false, error: e instanceof Error ? e.message : "Gagal menghapus layanan" };
  }
}

/** Nonaktifkan / aktifkan kembali layanan (soft-delete; histori tetap utuh). */
export async function actionSetCatalogActive(id: string, active: boolean): Promise<Result> {
  const ctx = await tryGetServerContext();
  if (!ctx?.tenantId) return { ok: false, error: "Sesi tidak valid" };
  if (!canManage(ctx.role)) return { ok: false, error: "Tidak berwenang" };
  try {
    await setCatalogActive(ctx.tenantId, id, active);
    revalidatePath("/app/layanan");
    return { ok: true };
  } catch (e) {
    if (e instanceof ServiceError) return { ok: false, error: e.message };
    return { ok: false, error: e instanceof Error ? e.message : "Gagal mengubah status" };
  }
}

/** Drill-down K22-A: daftar pelanggan yang punya harga khusus utk 1 layanan. */
export async function actionListOverrides(serviceId: string): Promise<
  { ok: boolean; error?: string; rows?: { customerName: string; price: number }[] }
> {
  const ctx = await tryGetServerContext();
  if (!ctx?.tenantId) return { ok: false, error: "Sesi tidak valid" };
  try {
    const rows = await listOverridesForService(ctx.tenantId, serviceId);
    return { ok: true, rows };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal memuat" };
  }
}
