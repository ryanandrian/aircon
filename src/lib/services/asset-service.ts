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
  if (input.installedAt !== undefined) data.installedAt = input.installedAt;
  if (input.maintenanceIntervalDays !== undefined) {
    data.maintenanceIntervalDays = input.maintenanceIntervalDays;
  }
  if (input.deviceId !== undefined) {
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
