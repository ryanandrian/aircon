"use server";

import { revalidatePath } from "next/cache";
import { tryGetServerContext } from "@/lib/auth/context";
import {
  generateBatch, listCodes, exportCodesCsv, bindCode, unbindCode,
  resolveCodeForTenant,
} from "@/lib/services/unit-code-service";

/** Base URL untuk QR (no-hardcode: env, fallback subdomain lumite). */
function cardBaseUrl(): string {
  return process.env.UNIT_CODE_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://aircon-peach.vercel.app";
}

export async function actionGenerateCodes(count: number): Promise<{ ok: boolean; error?: string; batchId?: string; codes?: string[] }> {
  const ctx = await tryGetServerContext();
  if (!ctx?.tenantId) return { ok: false, error: "Sesi tidak valid" };
  try {
    const res = await generateBatch(ctx.tenantId, count);
    revalidatePath("/app/unit");
    return { ok: true, batchId: res.batchId, codes: res.codes };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal generate kode" };
  }
}

export async function actionListCodes(): Promise<{ code: string; status: string; assetLabel: string | null; batchId: string | null }[]> {
  const ctx = await tryGetServerContext();
  if (!ctx?.tenantId) return [];
  const rows = await listCodes(ctx.tenantId);
  return rows.map((r) => ({ code: r.code, status: r.status, assetLabel: r.assetLabel, batchId: r.batchId }));
}

export async function actionExportCodesCsv(batchId?: string): Promise<{ ok: boolean; csv?: string; error?: string }> {
  const ctx = await tryGetServerContext();
  if (!ctx?.tenantId) return { ok: false, error: "Sesi tidak valid" };
  try {
    const csv = await exportCodesCsv(ctx.tenantId, cardBaseUrl(), batchId);
    return { ok: true, csv };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal export" };
  }
}

export async function actionBindCode(code: string, assetId: string): Promise<{ ok: boolean; error?: string }> {
  const ctx = await tryGetServerContext();
  if (!ctx?.tenantId) return { ok: false, error: "Sesi tidak valid" };
  try {
    await bindCode(ctx.tenantId, code, assetId);
    revalidatePath("/app/unit");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal pasang kode" };
  }
}

export async function actionUnbindCode(code: string): Promise<{ ok: boolean; error?: string }> {
  const ctx = await tryGetServerContext();
  if (!ctx?.tenantId) return { ok: false, error: "Sesi tidak valid" };
  try {
    await unbindCode(ctx.tenantId, code);
    revalidatePath("/app/unit");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal lepas kode" };
  }
}

/**
 * Scan in-app: resolve kode → aksi. BOUND(tenant ini)=buka unit; POOL=boleh bind; lainnya=tolak.
 */
export async function actionResolveScan(code: string): Promise<
  { ok: false; error: string } | { ok: true; status: string; assetId: string | null }
> {
  const ctx = await tryGetServerContext();
  if (!ctx?.tenantId) return { ok: false, error: "Sesi tidak valid" };
  const res = await resolveCodeForTenant(ctx.tenantId, code);
  if (!res) return { ok: false, error: "Kode tidak dikenal" };
  if (res.status === "BOUND_OTHER") return { ok: false, error: "Kode milik unit usaha lain" };
  if (res.status === "POOL_OTHER") return { ok: false, error: "Kode milik usaha lain" };
  return { ok: true, status: res.status, assetId: res.assetId };
}

/** Daftar pelanggan + link kartu perawatan (untuk tenant bagikan). */
export async function actionListCustomerCards(): Promise<{ id: string; name: string; url: string }[]> {
  const ctx = await tryGetServerContext();
  if (!ctx?.tenantId) return [];
  const { listCustomers } = await import("@/lib/services/customer-service");
  const { getOrCreateCardToken } = await import("@/lib/services/customer-card-service");
  const { customerCardUrl } = await import("@/lib/unit-code/urls");
  const res = await listCustomers(ctx.tenantId, {});
  const out: { id: string; name: string; url: string }[] = [];
  for (const c of res.data) {
    const token = await getOrCreateCardToken(ctx.tenantId, c.id);
    if (token) out.push({ id: c.id, name: c.name, url: customerCardUrl(token) });
  }
  return out;
}
