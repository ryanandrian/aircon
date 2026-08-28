/**
 * Asset Service — CRUD unit AC, WAJIB tenant-scoped + soft delete.
 * Semua query memfilter deletedAt = null dan menyertakan tenantId.
 * Pesan error user-facing dalam Bahasa Indonesia.
 */
import type { Asset, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ServiceError } from "@/lib/services/customer-service";
import { assertQuota } from "@/lib/services/quota-guard";
import type {
  CreateAssetInput,
  UpdateAssetInput,
} from "@/lib/validation/asset";

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;
/** Jumlah job terakhir yang disertakan di riwayat asset. */
const HISTORY_JOB_LIMIT = 10;

function clampLimit(limit?: number): number {
  if (!limit || Number.isNaN(limit) || limit <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(limit), MAX_LIMIT);
}

export interface ListAssetsParams {
  search?: string;
  cursor?: string;
  limit?: number;
}

export interface ListAssetsResult {
  data: Asset[];
  nextCursor: string | null;
}

/** Baris unit AC untuk UI daftar (lazy-load): + nama pelanggan, jumlah riwayat, servis berikutnya. */
export interface AssetRow {
  id: string;
  brand: string | null;
  model: string | null;
  type: string;
  capacityPk: number | null;
  roomLocation: string | null;
  quantity: number;
  customerName: string;
  jobCount: number;
  nextServiceDate: string | null;
}

export interface ListAssetRowsResult {
  rows: AssetRow[];
  nextCursor: string | null;
}

/**
 * List unit AC untuk UI (lazy-load): cursor pagination (id desc) + nama pelanggan & jumlah riwayat.
 * Antisipasi ratusan unit (institusi besar) tanpa membebani satu halaman.
 */
export async function listAssetRows(
  tenantId: string,
  params: { search?: string; cursor?: string; limit?: number } = {},
): Promise<ListAssetRowsResult> {
  const limit = clampLimit(params.limit);
  const search = params.search?.trim();
  const where: Prisma.AssetWhereInput = {
    tenantId,
    deletedAt: null,
    ...(search
      ? {
          OR: [
            { brand: { contains: search, mode: "insensitive" } },
            { model: { contains: search, mode: "insensitive" } },
            { roomLocation: { contains: search, mode: "insensitive" } },
            { customer: { is: { name: { contains: search, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };

  try {
    const rows = await prisma.asset.findMany({
      where,
      orderBy: { id: "desc" },
      take: limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      include: {
        customer: { select: { name: true } },
        _count: { select: { jobs: true } },
      },
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? page[page.length - 1].id : null;
    return {
      rows: page.map((a) => ({
        id: a.id,
        brand: a.brand,
        model: a.model,
        type: a.type,
        capacityPk: a.capacityPk,
        roomLocation: a.roomLocation,
        quantity: a.quantity,
        customerName: a.customer?.name ?? "—",
        jobCount: a._count.jobs,
        nextServiceDate: a.nextServiceDate ? a.nextServiceDate.toISOString() : null,
      })),
      nextCursor,
    };
  } catch (err) {
    throw new ServiceError(
      "UNEXPECTED",
      "Gagal memuat daftar unit AC",
      err instanceof Error ? err.message : String(err),
    );
  }
}

/**
 * List asset aktif milik tenant dengan cursor pagination.
 * Urutan stabil berdasarkan id agar cursor konsisten.
 */
export async function listAssets(
  tenantId: string,
  params: ListAssetsParams = {},
): Promise<ListAssetsResult> {
  const limit = clampLimit(params.limit);
  const search = params.search?.trim();

  // SECURITY: tenant-scoped
  const where: Prisma.AssetWhereInput = {
    tenantId,
    deletedAt: null,
    ...(search
      ? {
          OR: [
            { brand: { contains: search, mode: "insensitive" } },
            { model: { contains: search, mode: "insensitive" } },
            { serial: { contains: search, mode: "insensitive" } },
            { roomLocation: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  try {
    const rows = await prisma.asset.findMany({
      where,
      orderBy: { id: "asc" },
      take: limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? data[data.length - 1].id : null;
    return { data, nextCursor };
  } catch (err) {
    throw new ServiceError(
      "UNEXPECTED",
      "Gagal memuat daftar asset",
      err instanceof Error ? err.message : String(err),
    );
  }
}

/** List asset aktif milik seorang pelanggan (tenant-scoped). */
export async function listAssetsByCustomer(
  tenantId: string,
  customerId: string,
): Promise<Asset[]> {
  try {
    // SECURITY: tenant-scoped
    return await prisma.asset.findMany({
      where: { tenantId, customerId, deletedAt: null },
      orderBy: { id: "asc" },
    });
  } catch (err) {
    throw new ServiceError(
      "UNEXPECTED",
      "Gagal memuat asset pelanggan",
      err instanceof Error ? err.message : String(err),
    );
  }
}

/** Ambil satu asset aktif milik tenant. Throw NOT_FOUND bila tidak ada. */
export async function getAsset(tenantId: string, id: string): Promise<Asset> {
  // SECURITY: tenant-scoped
  const asset = await prisma.asset.findFirst({
    where: { id, tenantId, deletedAt: null },
  });
  if (!asset) {
    throw new ServiceError("NOT_FOUND", "Asset tidak ditemukan");
  }
  return asset;
}

/** Asset beserta riwayat job terakhir (untuk halaman detail). */
export type AssetWithHistory = Prisma.AssetGetPayload<{
  include: { jobs: true };
}>;

/**
 * Ambil asset + job terakhir (riwayat servis). Throw NOT_FOUND bila tidak ada.
 * Job diurutkan terbaru dulu, dibatasi HISTORY_JOB_LIMIT.
 */
export async function getAssetWithHistory(
  tenantId: string,
  id: string,
): Promise<AssetWithHistory> {
  // SECURITY: tenant-scoped — filter di asset dan di relasi jobs.
  const asset = await prisma.asset.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: {
      jobs: {
        where: { tenantId, deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: HISTORY_JOB_LIMIT,
      },
    },
  });
  if (!asset) {
    throw new ServiceError("NOT_FOUND", "Asset tidak ditemukan");
  }
  return asset;
}

/**
 * Buat asset baru. Memvalidasi bahwa customerId milik tenant yang sama.
 * Throw CONFLICT bila pelanggan tidak valid.
 */
/** SECURITY: pastikan device milik tenant. Cegah penautan device lintas tenant (hijack). */
async function assertDeviceOwnedByTenant(tenantId: string, deviceId: string): Promise<void> {
  const device = await prisma.device.findFirst({
    where: { id: deviceId, tenantId },
    select: { id: true },
  });
  if (!device) {
    throw new ServiceError("CONFLICT", "Perangkat tidak valid untuk usaha ini");
  }
}

export async function createAsset(
  tenantId: string,
  input: CreateAssetInput,
): Promise<Asset> {
  // Kuota paket: tolak bila batas unit AC tercapai (dari PlanConfig, no hardcode).
  await assertQuota(tenantId, "acUnits");
  // SECURITY: tenant-scoped — pastikan customer milik tenant ini.
  const customer = await prisma.customer.findFirst({
    where: { id: input.customerId, tenantId, deletedAt: null },
    select: { id: true },
  });
  if (!customer) {
    throw new ServiceError(
      "CONFLICT",
      "Pelanggan tidak valid untuk tenant ini",
    );
  }

  // SECURITY: bila deviceId disertakan, pastikan device milik tenant ini (cegah device-hijack lintas tenant).
  if (input.deviceId) {
    await assertDeviceOwnedByTenant(tenantId, input.deviceId);
  }

  try {
    return await prisma.asset.create({
      data: {
        tenantId,
        customerId: input.customerId,
        type: input.type,
        brand: input.brand ?? null,
        model: input.model ?? null,
        capacityPk: input.capacityPk ?? null,
        roomLocation: input.roomLocation ?? null,
        serial: input.serial ?? null,
        quantity: input.quantity ?? 1,
        installedAt: input.installedAt ?? null,
        maintenanceIntervalDays: input.maintenanceIntervalDays ?? null,
        deviceId: input.deviceId ?? null,
      },
    });
  } catch (err) {
    throw new ServiceError(
      "UNEXPECTED",
      "Gagal membuat asset",
      err instanceof Error ? err.message : String(err),
    );
  }
}

/**
 * Buat BANYAK unit sekaligus (buat-massal) untuk unit kembar (mis. masjid 8 AC).
 * Menghasilkan N record TERPISAH (Pola A) dengan label posisi "{roomLocation} #1..#N" bila count>1.
 * Hormati kuota paket (acUnits) untuk seluruh N. Transaksi: semua atau tidak sama sekali.
 */
export async function createAssetsBulk(
  tenantId: string,
  input: CreateAssetInput,
  count: number,
): Promise<Asset[]> {
  const n = Math.max(1, Math.min(Math.floor(count), 100));
  // Kuota: pastikan menambah N unit tak melewati batas paket.
  await assertQuota(tenantId, "acUnits", n);

  // SECURITY: tenant-scoped — pastikan customer milik tenant ini.
  const customer = await prisma.customer.findFirst({
    where: { id: input.customerId, tenantId, deletedAt: null },
    select: { id: true },
  });
  if (!customer) {
    throw new ServiceError("CONFLICT", "Pelanggan tidak valid untuk tenant ini");
  }

  const baseLoc = (input.roomLocation ?? "").trim();
  try {
    const created = await prisma.$transaction(
      Array.from({ length: n }, (_, i) => {
        const loc = n > 1 && baseLoc ? `${baseLoc} #${i + 1}` : baseLoc || null;
        return prisma.asset.create({
          data: {
            tenantId,
            customerId: input.customerId,
            type: input.type,
            brand: input.brand ?? null,
            model: input.model ?? null,
            capacityPk: input.capacityPk ?? null,
            roomLocation: loc,
            serial: null, // serial per-unit diisi belakangan (kembar)
            quantity: 1,
            installedAt: input.installedAt ?? null,
            maintenanceIntervalDays: input.maintenanceIntervalDays ?? null,
          },
        });
      }),
    );
    return created;
  } catch (err) {
    throw new ServiceError(
      "UNEXPECTED",
      "Gagal membuat unit massal",
      err instanceof Error ? err.message : String(err),
    );
  }
}

/**
 * Saran lokasi ruangan: distinct roomLocation yang PERNAH dipakai.
 * Prioritas lokasi milik pelanggan ini dulu, lalu lokasi lain di tenant (dedupe, case-insensitive).
 * Untuk combobox anti-duplikat ("kamar depan" vs "k.tamu").
 */
export async function suggestLocations(
  tenantId: string,
  customerId?: string,
): Promise<string[]> {
  const rows = await prisma.asset.findMany({
    where: { tenantId, deletedAt: null, roomLocation: { not: null } },
    select: { roomLocation: true, customerId: true },
    orderBy: { updatedAt: "desc" },
    take: 500,
  });
  const seen = new Set<string>();
  const mine: string[] = [];
  const others: string[] = [];
  for (const r of rows) {
    const loc = (r.roomLocation ?? "").trim();
    if (!loc) continue;
    const key = loc.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (customerId && r.customerId === customerId) mine.push(loc);
    else others.push(loc);
  }
  return [...mine, ...others].slice(0, 30);
}

/**
 * Cari unit yang MIRIP untuk pelanggan (dedup-warning LUNAK — bukan blokir).
 * Kriteria: brand + capacityPk + roomLocation cocok (case-insensitive) di pelanggan yang sama.
 * Unit kembar itu SAH; ini hanya peringatan agar teknisi sadar mungkin sudah terdaftar.
 */
export async function findPossibleDuplicates(
  tenantId: string,
  customerId: string,
  candidate: { brand?: string | null; capacityPk?: number | null; roomLocation?: string | null },
): Promise<Asset[]> {
  const existing = await prisma.asset.findMany({
    where: { tenantId, customerId, deletedAt: null },
  });
  const norm = (s?: string | null) => (s ?? "").trim().toLowerCase();
  const cb = norm(candidate.brand);
  const cl = norm(candidate.roomLocation);
  const cp = candidate.capacityPk ?? null;
  return existing.filter((a) => {
    const brandMatch = cb !== "" && norm(a.brand) === cb;
    const locMatch = cl !== "" && norm(a.roomLocation) === cl;
    const pkMatch = cp !== null && a.capacityPk === cp;
    // dianggap "mirip" bila lokasi sama DAN (brand sama atau PK sama)
    return locMatch && (brandMatch || pkMatch);
  });
}

/** Update asset milik tenant. Throw NOT_FOUND bila milik tenant lain/terhapus. */
export async function updateAsset(
  tenantId: string,
  id: string,
  input: UpdateAssetInput,
): Promise<Asset> {
  // SECURITY: tenant-scoped
  const existing = await prisma.asset.findFirst({
    where: { id, tenantId, deletedAt: null },
    select: { id: true },
  });
  if (!existing) {
    throw new ServiceError("NOT_FOUND", "Asset tidak ditemukan");
  }

  // Bila customerId diubah, pastikan customer baru milik tenant ini.
  if (input.customerId !== undefined) {
    const customer = await prisma.customer.findFirst({
      where: { id: input.customerId, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!customer) {
      throw new ServiceError(
        "CONFLICT",
        "Pelanggan tidak valid untuk tenant ini",
      );
    }
  }

  const data: Prisma.AssetUpdateInput = {};
  if (input.customerId !== undefined) {
    data.customer = { connect: { id: input.customerId } };
  }
  if (input.type !== undefined) data.type = input.type;
  if (input.brand !== undefined) data.brand = input.brand;
  if (input.model !== undefined) data.model = input.model;
  if (input.capacityPk !== undefined) data.capacityPk = input.capacityPk;
  if (input.roomLocation !== undefined) data.roomLocation = input.roomLocation;
  if (input.serial !== undefined) data.serial = input.serial;
  if (input.quantity !== undefined) data.quantity = input.quantity;
  if (input.installedAt !== undefined) data.installedAt = input.installedAt;
  if (input.maintenanceIntervalDays !== undefined) {
    data.maintenanceIntervalDays = input.maintenanceIntervalDays;
  }
  if (input.deviceId !== undefined) {
    // SECURITY: pastikan device milik tenant ini sebelum ditautkan (cegah hijack lintas tenant).
    if (input.deviceId) await assertDeviceOwnedByTenant(tenantId, input.deviceId);
    data.device = { connect: { id: input.deviceId } };
  }

  try {
    return await prisma.asset.update({ where: { id }, data });
  } catch (err) {
    throw new ServiceError(
      "UNEXPECTED",
      "Gagal memperbarui asset",
      err instanceof Error ? err.message : String(err),
    );
  }
}

/** Soft delete asset milik tenant. Throw NOT_FOUND bila tidak ada. */
export async function softDeleteAsset(
  tenantId: string,
  id: string,
): Promise<Asset> {
  // SECURITY: tenant-scoped
  const existing = await prisma.asset.findFirst({
    where: { id, tenantId, deletedAt: null },
    select: { id: true },
  });
  if (!existing) {
    throw new ServiceError("NOT_FOUND", "Asset tidak ditemukan");
  }

  try {
    return await prisma.asset.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  } catch (err) {
    throw new ServiceError(
      "UNEXPECTED",
      "Gagal menghapus asset",
      err instanceof Error ? err.message : String(err),
    );
  }
}
