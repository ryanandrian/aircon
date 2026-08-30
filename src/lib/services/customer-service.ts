/**
 * Customer Service — CRUD pelanggan, WAJIB tenant-scoped + soft delete.
 * Semua query memfilter deletedAt = null dan menyertakan tenantId.
 * Pesan error user-facing dalam Bahasa Indonesia.
 */
import type { Customer, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertQuota } from "@/lib/services/quota-guard";
import { normalizePhone } from "@/lib/wa/gateway";
import type {
  CreateCustomerInput,
  UpdateCustomerInput,
} from "@/lib/validation/customer";

/** Error terstruktur untuk dipetakan ke HTTP status di route. */
export class ServiceError extends Error {
  code: "NOT_FOUND" | "CONFLICT" | "UNEXPECTED";
  details?: unknown;
  constructor(
    code: "NOT_FOUND" | "CONFLICT" | "UNEXPECTED",
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.name = "ServiceError";
    this.code = code;
    this.details = details;
  }
}

/** Batas atas jumlah item per halaman. */
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

function clampLimit(limit?: number): number {
  if (!limit || Number.isNaN(limit) || limit <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(limit), MAX_LIMIT);
}

export interface ListCustomersParams {
  search?: string;
  cursor?: string;
  limit?: number;
}

export interface ListCustomersResult {
  data: Customer[];
  nextCursor: string | null;
}

/** Baris pelanggan untuk UI daftar (dengan jumlah unit & pekerjaan). */
export interface CustomerRow {
  id: string;
  name: string;
  phone: string;
  address: string | null;
  source: string;
  category: string | null;
  customerType: string;
  topType: string;
  assetCount: number;
  jobCount: number;
}

export interface ListCustomerRowsResult {
  rows: CustomerRow[];
  nextCursor: string | null;
}

/**
 * List pelanggan untuk UI (lazy-load): cursor pagination + jumlah unit/pekerjaan.
 * Urutan id desc (cuid ~ monoton waktu → terbaru dulu) agar cursor stabil & unik.
 * Antisipasi ratusan pelanggan tanpa membebani satu halaman.
 */
export async function listCustomerRows(
  tenantId: string,
  params: { search?: string; cursor?: string; limit?: number } = {},
): Promise<ListCustomerRowsResult> {
  const limit = clampLimit(params.limit);
  const search = params.search?.trim();
  const where: Prisma.CustomerWhereInput = {
    tenantId,
    deletedAt: null,
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { phone: { contains: search } },
            { address: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  try {
    const rows = await prisma.customer.findMany({
      where,
      orderBy: { id: "desc" },
      take: limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      include: { _count: { select: { assets: true, jobs: true } } },
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? page[page.length - 1].id : null;
    return {
      rows: page.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        address: c.address,
        source: c.source,
        category: c.category,
        customerType: c.customerType,
        topType: c.topType,
        assetCount: c._count.assets,
        jobCount: c._count.jobs,
      })),
      nextCursor,
    };
  } catch (err) {
    throw new ServiceError(
      "UNEXPECTED",
      "Gagal memuat daftar pelanggan",
      err instanceof Error ? err.message : String(err),
    );
  }
}

/**
 * List pelanggan aktif (belum dihapus) milik tenant, dengan cursor pagination.
 * Urutan stabil berdasarkan id agar cursor konsisten.
 */
export async function listCustomers(
  tenantId: string,
  params: ListCustomersParams = {},
): Promise<ListCustomersResult> {
  const limit = clampLimit(params.limit);
  const search = params.search?.trim();

  // SECURITY: tenant-scoped — tenantId wajib ada di setiap where.
  const where: Prisma.CustomerWhereInput = {
    tenantId,
    deletedAt: null,
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { phone: { contains: search } },
          ],
        }
      : {}),
  };

  try {
    const rows = await prisma.customer.findMany({
      where,
      orderBy: { id: "asc" },
      take: limit + 1, // ambil 1 ekstra untuk deteksi halaman berikutnya
      ...(params.cursor
        ? { cursor: { id: params.cursor }, skip: 1 }
        : {}),
    });

    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? data[data.length - 1].id : null;
    return { data, nextCursor };
  } catch (err) {
    throw new ServiceError(
      "UNEXPECTED",
      "Gagal memuat daftar pelanggan",
      err instanceof Error ? err.message : String(err),
    );
  }
}

/** Ambil satu pelanggan aktif milik tenant. Throw NOT_FOUND bila tidak ada. */
export async function getCustomer(
  tenantId: string,
  id: string,
): Promise<Customer> {
  // SECURITY: tenant-scoped
  const customer = await prisma.customer.findFirst({
    where: { id, tenantId, deletedAt: null },
  });
  if (!customer) {
    throw new ServiceError("NOT_FOUND", "Pelanggan tidak ditemukan");
  }
  return customer;
}

/** Buat pelanggan baru untuk tenant. */
export async function createCustomer(
  tenantId: string,
  input: CreateCustomerInput,
): Promise<Customer> {
  // Kuota paket: tolak bila batas pelanggan tercapai (dari PlanConfig, no hardcode).
  await assertQuota(tenantId, "customers");
  try {
    // SECURITY: tenant-scoped — tenantId diinject dari konteks, bukan dari input.
    return await prisma.customer.create({
      data: {
        tenantId,
        name: input.name,
        phone: normalizePhone(input.phone),
        address: input.address ?? null,
        geoLat: input.geoLat ?? null,
        geoLng: input.geoLng ?? null,
        source: input.source ?? "OTHER",
        referredById: input.referredById ?? null,
        notes: input.notes ?? null,
        // Fase 1 invoicing/AR — field opsional (whitelist eksplisit, anti mass-assignment).
        category: input.category ?? null,
        customerType: input.customerType ?? "PERORANGAN",
        topType: input.topType ?? "CASH",
        npwp: input.npwp ?? null,
        isPphWithholder: input.isPphWithholder ?? false,
        billingCustomerId: input.billingCustomerId ?? null,
        picWorkName: input.picWorkName ?? null,
        picWorkPhone: input.picWorkPhone ?? null,
        picWorkRole: input.picWorkRole ?? null,
        picFinanceName: input.picFinanceName ?? null,
        picFinancePhone: input.picFinancePhone ?? null,
      },
    });
  } catch (err) {
    throw new ServiceError(
      "UNEXPECTED",
      "Gagal membuat pelanggan",
      err instanceof Error ? err.message : String(err),
    );
  }
}

/**
 * Update pelanggan milik tenant. Throw NOT_FOUND bila entitas milik tenant lain
 * atau sudah dihapus (updateMany dengan filter tenant memastikan isolasi).
 */
export async function updateCustomer(
  tenantId: string,
  id: string,
  input: UpdateCustomerInput,
): Promise<Customer> {
  // SECURITY: tenant-scoped — pastikan entitas ada & milik tenant sebelum update.
  const existing = await prisma.customer.findFirst({
    where: { id, tenantId, deletedAt: null },
    select: { id: true },
  });
  if (!existing) {
    throw new ServiceError("NOT_FOUND", "Pelanggan tidak ditemukan");
  }

  const data: Prisma.CustomerUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.phone !== undefined) data.phone = normalizePhone(input.phone);
  if (input.address !== undefined) data.address = input.address;
  if (input.geoLat !== undefined) data.geoLat = input.geoLat;
  if (input.geoLng !== undefined) data.geoLng = input.geoLng;
  if (input.source !== undefined) data.source = input.source;
  if (input.referredById !== undefined) data.referredById = input.referredById;
  if (input.notes !== undefined) data.notes = input.notes;
  // Fase 1 invoicing/AR — field opsional (whitelist eksplisit).
  if (input.category !== undefined) data.category = input.category;
  if (input.customerType !== undefined) data.customerType = input.customerType;
  if (input.topType !== undefined) data.topType = input.topType;
  if (input.npwp !== undefined) data.npwp = input.npwp;
  if (input.isPphWithholder !== undefined) data.isPphWithholder = input.isPphWithholder;
  if (input.billingCustomerId !== undefined) {
    data.billingCustomer = input.billingCustomerId
      ? { connect: { id: input.billingCustomerId } }
      : { disconnect: true };
  }
  if (input.picWorkName !== undefined) data.picWorkName = input.picWorkName;
  if (input.picWorkPhone !== undefined) data.picWorkPhone = input.picWorkPhone;
  if (input.picWorkRole !== undefined) data.picWorkRole = input.picWorkRole;
  if (input.picFinanceName !== undefined) data.picFinanceName = input.picFinanceName;
  if (input.picFinancePhone !== undefined) data.picFinancePhone = input.picFinancePhone;

  try {
    return await prisma.customer.update({ where: { id }, data });
  } catch (err) {
    throw new ServiceError(
      "UNEXPECTED",
      "Gagal memperbarui pelanggan",
      err instanceof Error ? err.message : String(err),
    );
  }
}

/**
 * Soft delete pelanggan milik tenant (set deletedAt). Throw NOT_FOUND bila
 * entitas tidak ada, milik tenant lain, atau sudah dihapus.
 */
export async function softDeleteCustomer(
  tenantId: string,
  id: string,
): Promise<Customer> {
  // SECURITY: tenant-scoped
  const existing = await prisma.customer.findFirst({
    where: { id, tenantId, deletedAt: null },
    select: { id: true },
  });
  if (!existing) {
    throw new ServiceError("NOT_FOUND", "Pelanggan tidak ditemukan");
  }

  try {
    return await prisma.customer.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  } catch (err) {
    throw new ServiceError(
      "UNEXPECTED",
      "Gagal menghapus pelanggan",
      err instanceof Error ? err.message : String(err),
    );
  }
}

/**
 * Resolusi entitas penagihan (bill-to). Bila customer punya billingCustomerId (mis. kantor pusat),
 * kembalikan customer penagihan itu; bila kosong, tagih ke customer itu sendiri.
 * SECURITY: tenant-scoped — billing customer wajib milik tenant yang sama; bila tidak, fallback ke diri sendiri.
 */
export async function resolveBillingCustomer(
  tenantId: string,
  customerId: string,
): Promise<Customer> {
  const self = await prisma.customer.findFirst({
    where: { id: customerId, tenantId, deletedAt: null },
  });
  if (!self) throw new ServiceError("NOT_FOUND", "Pelanggan tidak ditemukan");
  if (!self.billingCustomerId) return self;
  const billTo = await prisma.customer.findFirst({
    where: { id: self.billingCustomerId, tenantId, deletedAt: null },
  });
  return billTo ?? self;
}
