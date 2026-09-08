"use server";

import { revalidatePath } from "next/cache";
import { getServerContext } from "@/lib/auth/context";
import {
  openWorkSession, addWorkItem, removeWorkItem, getWorkSession, closeWorkSession,
} from "@/lib/services/worksession-service";
import { listCatalog } from "@/lib/services/service-catalog-service";
import { createAsset, updateAsset, suggestBrands, suggestModels } from "@/lib/services/asset-service";
import { createAssetSchema } from "@/lib/validation/asset";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

function msg(e: unknown, fb: string): string {
  return e instanceof Error ? e.message : fb;
}

/** Saran merek (kanonik + data tenant) untuk form unit teknisi. */
export async function actionTechSuggestBrands(): Promise<string[]> {
  try { const ctx = await getServerContext(); return await suggestBrands(ctx.tenantId); }
  catch { return []; }
}

/** Saran model per-merek untuk form unit teknisi. */
export async function actionTechSuggestModels(brand?: string): Promise<string[]> {
  try { const ctx = await getServerContext(); return await suggestModels(ctx.tenantId, brand || undefined); }
  catch { return []; }
}

/** Teknisi tambah unit AC untuk pelanggan (kunjungan pertama sering belum terdaftar). */
export async function actionTechCreateAsset(customerId: string, raw: {
  type: string; brand?: string; model?: string; capacityPk?: number; roomLocation?: string;
}): Promise<Result<{ id: string; label: string }>> {
  try {
    const ctx = await getServerContext();
    const parsed = createAssetSchema.safeParse({
      customerId,
      type: raw.type,
      brand: raw.brand || undefined,
      model: raw.model || undefined,
      capacityPk: raw.capacityPk,
      roomLocation: raw.roomLocation || undefined,
    });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
    const a = await createAsset(ctx.tenantId, parsed.data);
    const label = [a.brand, a.capacityPk ? `${a.capacityPk}PK` : null, a.roomLocation].filter(Boolean).join(" · ") || "Unit AC";
    return { ok: true, data: { id: a.id, label } };
  } catch (e) {
    return { ok: false, error: msg(e, "Gagal menambah unit") };
  }
}

/** Teknisi ubah data unit AC (mereka yang tahu persis unit di lapangan). */
export async function actionTechUpdateAsset(assetId: string, raw: {
  type?: string; brand?: string; model?: string; capacityPk?: number; roomLocation?: string;
}): Promise<Result<{ id: string; label: string }>> {
  try {
    const ctx = await getServerContext();
    const a = await updateAsset(ctx.tenantId, assetId, {
      type: raw.type as never,
      brand: raw.brand ?? undefined,
      model: raw.model ?? undefined,
      capacityPk: raw.capacityPk,
      roomLocation: raw.roomLocation ?? undefined,
    });
    const label = [a.brand, a.capacityPk ? `${a.capacityPk}PK` : null, a.roomLocation].filter(Boolean).join(" · ") || "Unit AC";
    return { ok: true, data: { id: a.id, label } };
  } catch (e) {
    return { ok: false, error: msg(e, "Gagal mengubah unit") };
  }
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
    const { prisma } = await import("@/lib/prisma");
    let techIds = input.techIds;
    let kernetIds = input.kernetIds;

    // B6 fix: bila roster tak diberikan, ambil dari JobAssignment job terkait sesi
    // (TECHNICIAN→techIds, KERNET→kernetIds) agar kernet/rekan tim ikut dapat insentif.
    if (!techIds || techIds.length === 0) {
      const ws = await prisma.workSession.findFirst({
        where: { id: workSessionId, tenantId: ctx.tenantId }, select: { jobId: true },
      });
      if (ws?.jobId) {
        const roster = await prisma.jobAssignment.findMany({
          where: { tenantId: ctx.tenantId, jobId: ws.jobId }, select: { personId: true, roleOnJob: true },
        });
        const rosterTech = roster.filter((r) => r.roleOnJob === "TECHNICIAN").map((r) => r.personId);
        const rosterKernet = roster.filter((r) => r.roleOnJob === "KERNET").map((r) => r.personId);
        if (rosterTech.length > 0) techIds = rosterTech;
        if ((!kernetIds || kernetIds.length === 0) && rosterKernet.length > 0) kernetIds = rosterKernet;
      }
      // Fallback: teknisi yang sedang login (agar insentif tetap terhitung bila tak ada roster).
      if (!techIds || techIds.length === 0) {
        const tech = await prisma.technician.findFirst({
          where: { tenantId: ctx.tenantId, userId: ctx.userId }, select: { id: true },
        });
        techIds = tech ? [tech.id] : [];
      }
    }
    await addWorkItem(ctx.tenantId, workSessionId, { ...input, techIds, kernetIds });
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

// ── FASE 2: checklist per WorkItem (layanan × unit) ──

type ChecklistRow = { key: string; label: string; type: "bool" | "number" | "text" | "photo"; required: boolean; checked: boolean; value: string | null };

/** Ambil checklist satu WorkItem (kosong bila layanannya tak punya template). */
export async function actionGetItemChecklist(workItemId: string): Promise<Result<ChecklistRow[]>> {
  try {
    const ctx = await getServerContext();
    const { getWorkItemChecklist } = await import("@/lib/services/job-work-service");
    const rows = await getWorkItemChecklist(ctx.tenantId, workItemId);
    return { ok: true, data: rows as ChecklistRow[] };
  } catch (e) {
    return { ok: false, error: msg(e, "Gagal memuat checklist") };
  }
}

/** Simpan satu jawaban checklist WorkItem. */
export async function actionSetItemChecklist(
  workItemId: string, itemKey: string, data: { checked?: boolean; value?: string | null },
): Promise<Result> {
  try {
    const ctx = await getServerContext();
    const { setWorkItemChecklistItem } = await import("@/lib/services/job-work-service");
    await setWorkItemChecklistItem(ctx.tenantId, workItemId, itemKey, data);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: msg(e, "Gagal menyimpan checklist") };
  }
}
