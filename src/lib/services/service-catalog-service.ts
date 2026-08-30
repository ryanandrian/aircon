/**
 * Service Catalog — daftar layanan per tenant + harga khusus pelanggan + kalkulasi insentif.
 * SECURITY: semua query tenant-scoped (tenantId dari session, bukan input). Whitelist field.
 * Uang pakai Decimal di DB; kalkulasi insentif pakai number rupiah (bilangan bulat) + pembulatan eksplisit.
 */
import type { ServiceCatalog } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ServiceError } from "@/lib/services/customer-service";

export type IncentiveType = "PERCENT" | "VALUE";
export type ServiceCategory =
  | "MAINTENANCE" | "SERVICE" | "CONSUMABLE" | "SPAREPART" | "PAKET" | "SURVEI" | "GARANSI" | "LAINNYA";
export type TeamMode = "BAGI_RATA" | "PENUH";
export type RoleOnJob = "TECHNICIAN" | "KERNET";

export interface CatalogInput {
  code: string;
  name: string;
  category: ServiceCategory;
  standardPrice: number;
  unit: string;
  description?: string;
  active?: boolean;
  techIncentiveType?: IncentiveType;
  techIncentiveValue?: number;
  kernetIncentiveType?: IncentiveType;
  kernetIncentiveValue?: number;
}

// ---------- KALKULASI MURNI (unit-tested) ----------

/** Bentuk minimal item katalog utk kalkulasi insentif (agar mudah diuji tanpa DB). */
export interface IncentiveCatalogItem {
  standardPrice: number;
  techIncentiveType: IncentiveType;
  techIncentiveValue: number;
  kernetIncentiveType: IncentiveType;
  kernetIncentiveValue: number;
}

/**
 * Hitung insentif PER PERSONEL untuk satu baris layanan (MURNI, tanpa DB).
 * - Basis insentif = type PERCENT → persen dari (unitPrice × qty); VALUE → nilai tetap × qty.
 * - K6: berlaku semua kategori (jasa/consumable/sparepart). Insentif=0 → hasil 0.
 * - K7 teamMode: BAGI_RATA → dibagi rata antar personel peran sama; PENUH → tiap personel penuh.
 * @param unitPrice harga jual per unit yang DIPAKAI di invoice (hasil resolvePrice), utk basis PERCENT.
 * @param roleOnJob TECHNICIAN memakai pos tech; KERNET memakai pos kernet.
 * @param qty jumlah unit layanan.
 * @param personCountSameRole jumlah personel dengan peran sama di baris ini (>=1).
 * @param teamMode BAGI_RATA (default) | PENUH.
 * @returns rupiah insentif per SATU personel (dibulatkan ke bilangan bulat terdekat).
 */
export function computeItemIncentive(
  item: IncentiveCatalogItem,
  roleOnJob: RoleOnJob,
  unitPrice: number,
  qty: number,
  personCountSameRole: number,
  teamMode: TeamMode = "BAGI_RATA",
): number {
  const q = qty > 0 ? qty : 0;
  const persons = personCountSameRole > 0 ? personCountSameRole : 1;
  const type = roleOnJob === "TECHNICIAN" ? item.techIncentiveType : item.kernetIncentiveType;
  const value = roleOnJob === "TECHNICIAN" ? item.techIncentiveValue : item.kernetIncentiveValue;
  if (!value || value <= 0) return 0; // insentif 0 → tak ada insentif

  // Total insentif untuk baris ini (sebelum dibagi personel).
  const lineIncentive = type === "PERCENT" ? (unitPrice * q * value) / 100 : value * q;
  const perPerson = teamMode === "PENUH" ? lineIncentive : lineIncentive / persons;
  return Math.round(perPerson);
}

// ---------- CRUD KATALOG (tenant-scoped) ----------

export async function listCatalog(
  tenantId: string,
  params: { activeOnly?: boolean } = {},
): Promise<ServiceCatalog[]> {
  return prisma.serviceCatalog.findMany({
    where: { tenantId, ...(params.activeOnly ? { active: true } : {}) },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
}

/** Katalog + jumlah harga khusus per item (K22-A indikator "N harga khusus"). */
export async function listCatalogWithOverrideCount(tenantId: string) {
  const rows = await prisma.serviceCatalog.findMany({
    where: { tenantId },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    include: { _count: { select: { customerPricing: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    category: r.category,
    standardPrice: Number(r.standardPrice),
    unit: r.unit,
    description: r.description,
    active: r.active,
    techIncentiveType: r.techIncentiveType,
    techIncentiveValue: Number(r.techIncentiveValue),
    kernetIncentiveType: r.kernetIncentiveType,
    kernetIncentiveValue: Number(r.kernetIncentiveValue),
    overrideCount: r._count.customerPricing,
  }));
}

/** Daftar pelanggan yang punya harga khusus untuk 1 layanan (K22-A drill-down). */
export async function listOverridesForService(tenantId: string, serviceId: string) {
  const rows = await prisma.customerPricing.findMany({
    where: { tenantId, serviceId },
    include: { customer: { select: { name: true } } },
    orderBy: { price: "asc" },
  });
  return rows.map((r) => ({ customerName: r.customer?.name ?? "—", price: Number(r.price) }));
}

export async function createCatalogItem(tenantId: string, input: CatalogInput): Promise<ServiceCatalog> {
  try {
    return await prisma.serviceCatalog.create({
      data: {
        tenantId,
        code: input.code.trim(),
        name: input.name.trim(),
        category: input.category,
        standardPrice: new Prisma.Decimal(input.standardPrice),
        unit: input.unit.trim() || "unit",
        description: input.description?.trim() || null,
        active: input.active ?? true,
        techIncentiveType: input.techIncentiveType ?? "VALUE",
        techIncentiveValue: new Prisma.Decimal(input.techIncentiveValue ?? 0),
        kernetIncentiveType: input.kernetIncentiveType ?? "VALUE",
        kernetIncentiveValue: new Prisma.Decimal(input.kernetIncentiveValue ?? 0),
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new ServiceError("CONFLICT", "Kode layanan sudah dipakai");
    }
    throw new ServiceError("UNEXPECTED", "Gagal membuat layanan", err instanceof Error ? err.message : String(err));
  }
}

export async function updateCatalogItem(
  tenantId: string,
  id: string,
  input: Partial<CatalogInput>,
): Promise<ServiceCatalog> {
  const existing = await prisma.serviceCatalog.findFirst({ where: { id, tenantId }, select: { id: true } });
  if (!existing) throw new ServiceError("NOT_FOUND", "Layanan tidak ditemukan");
  const data: Prisma.ServiceCatalogUpdateInput = {};
  if (input.code !== undefined) data.code = input.code.trim();
  if (input.name !== undefined) data.name = input.name.trim();
  if (input.category !== undefined) data.category = input.category;
  if (input.standardPrice !== undefined) data.standardPrice = new Prisma.Decimal(input.standardPrice);
  if (input.unit !== undefined) data.unit = input.unit.trim() || "unit";
  if (input.description !== undefined) data.description = input.description?.trim() || null;
  if (input.active !== undefined) data.active = input.active;
  if (input.techIncentiveType !== undefined) data.techIncentiveType = input.techIncentiveType;
  if (input.techIncentiveValue !== undefined) data.techIncentiveValue = new Prisma.Decimal(input.techIncentiveValue);
  if (input.kernetIncentiveType !== undefined) data.kernetIncentiveType = input.kernetIncentiveType;
  if (input.kernetIncentiveValue !== undefined) data.kernetIncentiveValue = new Prisma.Decimal(input.kernetIncentiveValue);
  try {
    return await prisma.serviceCatalog.update({ where: { id }, data });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new ServiceError("CONFLICT", "Kode layanan sudah dipakai");
    }
    throw new ServiceError("UNEXPECTED", "Gagal memperbarui layanan", err instanceof Error ? err.message : String(err));
  }
}

export async function deleteCatalogItem(tenantId: string, id: string): Promise<void> {
  const existing = await prisma.serviceCatalog.findFirst({ where: { id, tenantId }, select: { id: true } });
  if (!existing) throw new ServiceError("NOT_FOUND", "Layanan tidak ditemukan");
  await prisma.serviceCatalog.delete({ where: { id } });
}

// ---------- HARGA KHUSUS PELANGGAN (K21 pola TAMBAH per item) ----------

/** Set/ubah harga khusus (upsert 1 override). tenant-scoped: validasi customer & service milik tenant. */
export async function setCustomerPrice(
  tenantId: string,
  customerId: string,
  serviceId: string,
  price: number,
): Promise<void> {
  const [cust, svc] = await Promise.all([
    prisma.customer.findFirst({ where: { id: customerId, tenantId }, select: { id: true } }),
    prisma.serviceCatalog.findFirst({ where: { id: serviceId, tenantId }, select: { id: true } }),
  ]);
  if (!cust) throw new ServiceError("NOT_FOUND", "Pelanggan tidak ditemukan");
  if (!svc) throw new ServiceError("NOT_FOUND", "Layanan tidak ditemukan");
  await prisma.customerPricing.upsert({
    where: { customerId_serviceId: { customerId, serviceId } },
    create: { tenantId, customerId, serviceId, price: new Prisma.Decimal(price) },
    update: { price: new Prisma.Decimal(price) },
  });
}

/** Hapus override → item kembali ke harga standar. */
export async function removeCustomerPrice(tenantId: string, customerId: string, serviceId: string): Promise<void> {
  await prisma.customerPricing.deleteMany({ where: { tenantId, customerId, serviceId } });
}

/** Daftar override milik satu pelanggan (utk layar F2.4). */
export async function listCustomerPricing(tenantId: string, customerId: string) {
  return prisma.customerPricing.findMany({
    where: { tenantId, customerId },
    include: { service: { select: { code: true, name: true, unit: true, standardPrice: true, category: true } } },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * RESOLUSI HARGA (K21): harga khusus pelanggan utk serviceId → bila ada pakai; bila tidak, harga standar.
 * @returns number rupiah harga jual per unit.
 */
export async function resolvePrice(tenantId: string, customerId: string, serviceId: string): Promise<number> {
  const svc = await prisma.serviceCatalog.findFirst({
    where: { id: serviceId, tenantId },
    select: { standardPrice: true },
  });
  if (!svc) throw new ServiceError("NOT_FOUND", "Layanan tidak ditemukan");
  const override = await prisma.customerPricing.findUnique({
    where: { customerId_serviceId: { customerId, serviceId } },
    select: { price: true },
  });
  return Number(override?.price ?? svc.standardPrice);
}

/** Escape 1 sel CSV (RFC4180): bungkus dgn kutip bila ada koma/kutip/newline. */
function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const CSV_CATEGORY_LABEL: Record<string, string> = {
  MAINTENANCE: "Perawatan", SERVICE: "Servis", CONSUMABLE: "Consumable", SPAREPART: "Sparepart",
  PAKET: "Paket", SURVEI: "Survei", GARANSI: "Garansi", LAINNYA: "Lainnya",
};

/**
 * Export CSV DAFTAR LAYANAN (sesuai yang tampil di /app/layanan). tenant-scoped.
 * Kolom: Kode, Nama, Kategori, Harga Standar, Satuan, Insentif Teknisi, Insentif Kernet, Jml Harga Khusus, Status.
 */
export async function exportCatalogCsv(tenantId: string): Promise<string> {
  const items = await listCatalogWithOverrideCount(tenantId);
  const fmtInc = (type: string, val: number) => (type === "PERCENT" ? `${val}%` : String(val));
  const header = ["Kode", "Nama", "Kategori", "Harga Standar", "Satuan", "Insentif Teknisi", "Insentif Kernet", "Jml Harga Khusus", "Status"];
  const lines = [header.map(csvCell).join(",")];
  for (const i of items) {
    lines.push([
      i.code, i.name, CSV_CATEGORY_LABEL[i.category] ?? i.category,
      i.standardPrice, i.unit,
      fmtInc(i.techIncentiveType, i.techIncentiveValue),
      fmtInc(i.kernetIncentiveType, i.kernetIncentiveValue),
      i.overrideCount, i.active ? "Aktif" : "Nonaktif",
    ].map(csvCell).join(","));
  }
  return lines.join("\r\n");
}

/**
 * Export CSV semua harga khusus pelanggan (K22, audit menyeluruh). tenant-scoped.
 * Kolom: Kode, Nama Layanan, Harga Standar, Pelanggan, Harga Khusus, Selisih.
 */
export async function exportCustomerPricingCsv(tenantId: string): Promise<string> {
  const rows = await prisma.customerPricing.findMany({
    where: { tenantId },
    include: {
      service: { select: { code: true, name: true, standardPrice: true } },
      customer: { select: { name: true } },
    },
    orderBy: [{ service: { code: "asc" } }, { customer: { name: "asc" } }],
  });
  const header = ["Kode", "Nama Layanan", "Harga Standar", "Pelanggan", "Harga Khusus", "Selisih"];
  const lines = [header.map(csvCell).join(",")];
  for (const r of rows) {
    const std = Number(r.service.standardPrice);
    const price = Number(r.price);
    lines.push([
      r.service.code, r.service.name, std, r.customer?.name ?? "—", price, price - std,
    ].map(csvCell).join(","));
  }
  return lines.join("\r\n");
}
