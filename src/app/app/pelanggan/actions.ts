"use server";

import { revalidatePath } from "next/cache";
import { tryGetServerContext } from "@/lib/auth/context";
import { createCustomerSchema, updateCustomerSchema } from "@/lib/validation/customer";
import {
  createCustomer, updateCustomer, softDeleteCustomer, listCustomerRows, ServiceError,
  type ListCustomerRowsResult,
} from "@/lib/services/customer-service";
import { getAssetWithHistory } from "@/lib/services/asset-service";
import { SERVICE_TYPE_LABEL } from "@/lib/copy/terms";

type Result = { ok: boolean; error?: string };

const SOURCE_VALUES = ["REFERRAL", "WHATSAPP", "WALK_IN", "MARKETING", "WEBSITE", "IOT_ALERT", "REPEAT", "OTHER"] as const;
const CATEGORY_VALUES = ["RUMAH", "SEKOLAH_KAMPUS", "MASJID_MUSHOLA", "TOKO_OUTLET", "RUKO_RUKAN", "KANTOR_PERUSAHAAN", "LAINNYA"] as const;
const TYPE_VALUES = ["PERORANGAN", "BADAN"] as const;
const TOP_VALUES = ["CASH", "TEMPO_7", "TEMPO_14", "TEMPO_30", "TEMPO_45", "TEMPO_60", "TEMPO_90"] as const;

function pick<T extends readonly string[]>(vals: T, v: string | undefined): T[number] | undefined {
  return v && vals.includes(v as never) ? (v as T[number]) : undefined;
}

/** Payload form pelanggan (client mengirim string; enum divalidasi di sini + Zod). */
export type CustomerFormInput = {
  name: string; phone: string; address?: string; source?: string; notes?: string;
  category?: string; customerType?: string; topType?: string; npwp?: string;
  isPphWithholder?: boolean; billingCustomerId?: string;
  picWorkName?: string; picWorkPhone?: string; picWorkRole?: string;
  picFinanceName?: string; picFinancePhone?: string;
};

function buildPayload(raw: CustomerFormInput) {
  return {
    name: raw.name,
    phone: raw.phone,
    address: raw.address || undefined,
    source: pick(SOURCE_VALUES, raw.source),
    notes: raw.notes || undefined,
    category: pick(CATEGORY_VALUES, raw.category),
    customerType: pick(TYPE_VALUES, raw.customerType),
    topType: pick(TOP_VALUES, raw.topType),
    npwp: raw.npwp || undefined,
    isPphWithholder: raw.isPphWithholder,
    billingCustomerId: raw.billingCustomerId || undefined,
    picWorkName: raw.picWorkName || undefined,
    picWorkPhone: raw.picWorkPhone || undefined,
    picWorkRole: raw.picWorkRole || undefined,
    picFinanceName: raw.picFinanceName || undefined,
    picFinancePhone: raw.picFinancePhone || undefined,
  };
}

/** Tambah pelanggan. */
export async function actionCreateCustomer(raw: CustomerFormInput): Promise<Result> {
  const ctx = await tryGetServerContext();
  if (!ctx?.tenantId) return { ok: false, error: "Sesi tidak valid" };
  const parsed = createCustomerSchema.safeParse(buildPayload(raw));
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
export async function actionUpdateCustomer(id: string, raw: CustomerFormInput): Promise<Result> {
  const ctx = await tryGetServerContext();
  if (!ctx?.tenantId) return { ok: false, error: "Sesi tidak valid" };
  const parsed = updateCustomerSchema.safeParse(buildPayload(raw));
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

/** Muat batch pelanggan berikutnya (lazy-load / pencarian). */
export async function actionLoadCustomers(
  params: { search?: string; cursor?: string },
): Promise<{ ok: boolean; error?: string } & Partial<ListCustomerRowsResult>> {
  const ctx = await tryGetServerContext();
  if (!ctx?.tenantId) return { ok: false, error: "Sesi tidak valid" };
  try {
    const res = await listCustomerRows(ctx.tenantId, { search: params.search, cursor: params.cursor });
    return { ok: true, ...res };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal memuat pelanggan" };
  }
}

export type UnitHistoryItem = {
  id: string; serviceType: string; status: string; date: string | null; notes: string | null;
};

/** Riwayat servis satu unit (lazy saat kartu unit dibuka). tenant-scoped. */
export async function actionUnitHistory(
  assetId: string,
): Promise<{ ok: boolean; error?: string; items?: UnitHistoryItem[] }> {
  const ctx = await tryGetServerContext();
  if (!ctx?.tenantId) return { ok: false, error: "Sesi tidak valid" };
  try {
    const asset = await getAssetWithHistory(ctx.tenantId, assetId);
    const items: UnitHistoryItem[] = asset.jobs.map((j) => ({
      id: j.id,
      serviceType: SERVICE_TYPE_LABEL[j.serviceType] ?? j.serviceType,
      status: j.status,
      date: (j.completedAt ?? j.scheduledDate ?? j.createdAt)?.toISOString() ?? null,
      notes: j.notes ?? null,
    }));
    return { ok: true, items };
  } catch (e) {
    if (e instanceof ServiceError && e.code === "NOT_FOUND") return { ok: false, error: "Unit tidak ditemukan" };
    return { ok: false, error: e instanceof Error ? e.message : "Gagal memuat riwayat" };
  }
}
