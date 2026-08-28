"use server";

import { revalidatePath } from "next/cache";
import { getServerContext } from "@/lib/auth/context";
import {
  openWorkSession, addWorkItem, removeWorkItem, getWorkSession, closeWorkSession,
} from "@/lib/services/worksession-service";
import { listCatalog } from "@/lib/services/service-catalog-service";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

function msg(e: unknown, fb: string): string {
  return e instanceof Error ? e.message : fb;
}

/** Buka/ambil sesi kerja OPEN untuk pelanggan (dipanggil teknisi dari job). */
export async function actionOpenWorkSession(customerId: string, jobId?: string): Promise<Result<{ id: string }>> {
  try {
    const ctx = await getServerContext();
    const id = await openWorkSession(ctx.tenantId, customerId, ctx.userId, jobId);
    return { ok: true, data: { id } };
  } catch (e) {
    return { ok: false, error: msg(e, "Gagal membuka sesi") };
  }
}

/** Katalog layanan aktif (untuk dropdown minim-ketik). */
export async function actionCatalogForWork(): Promise<Result<{ id: string; name: string; unit: string; standardPrice: number; category: string }[]>> {
  try {
    const ctx = await getServerContext();
    const rows = await listCatalog(ctx.tenantId, { activeOnly: true });
    return { ok: true, data: rows.map((r) => ({ id: r.id, name: r.name, unit: r.unit, standardPrice: Number(r.standardPrice), category: r.category })) };
  } catch (e) {
    return { ok: false, error: msg(e, "Gagal memuat layanan") };
  }
}

export async function actionAddWorkItem(
  workSessionId: string,
  input: { assetId?: string; serviceId: string; qty: number; techIds?: string[]; kernetIds?: string[] },
): Promise<Result> {
  try {
    const ctx = await getServerContext();
    await addWorkItem(ctx.tenantId, workSessionId, input);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: msg(e, "Gagal menambah pekerjaan") };
  }
}

export async function actionRemoveWorkItem(workSessionId: string, itemId: string): Promise<Result> {
  try {
    const ctx = await getServerContext();
    await removeWorkItem(ctx.tenantId, workSessionId, itemId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: msg(e, "Gagal menghapus") };
  }
}

/** Snapshot isi sesi (item + total berjalan). */
export async function actionGetWorkSession(workSessionId: string): Promise<Result<{
  status: string;
  items: { id: string; desc: string; qty: number; unit: string; unitPrice: number; lineTotal: number; assetLabel: string | null }[];
  runningTotal: number;
}>> {
  try {
    const ctx = await getServerContext();
    const ws = await getWorkSession(ctx.tenantId, workSessionId);
    const items = ws.items.map((it) => ({
      id: it.id,
      desc: it.descSnapshot,
      qty: Number(it.qty),
      unit: it.unit,
      unitPrice: Number(it.unitPriceSnapshot),
      lineTotal: Number(it.lineTotal),
      assetLabel: it.asset ? [it.asset.brand, it.asset.roomLocation].filter(Boolean).join(" · ") || null : null,
    }));
    const runningTotal = items.reduce((s, i) => s + i.lineTotal, 0);
    return { ok: true, data: { status: ws.status, items, runningTotal } };
  } catch (e) {
    return { ok: false, error: msg(e, "Gagal memuat sesi") };
  }
}

/** Tutup sesi → auto-generate Invoice(Cash)/Proforma(Tempo). */
export async function actionCloseWorkSession(workSessionId: string): Promise<Result<{ invoiceId: string; docType: string; number: string }>> {
  try {
    const ctx = await getServerContext();
    const r = await closeWorkSession(ctx.tenantId, workSessionId, ctx.userId);
    revalidatePath("/t");
    return { ok: true, data: r };
  } catch (e) {
    return { ok: false, error: msg(e, "Gagal menutup sesi") };
  }
}
