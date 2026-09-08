/**
 * Checklist Template Service (tenant) — kelola item checklist teknisi per jenis servis.
 * Tenant-scoped. Owner/admin edit. Items disimpan sebagai JSON array di ChecklistTemplate.
 */
import { prisma } from "@/lib/prisma";
import { DEFAULT_CHECKLISTS, type ChecklistItem } from "@/lib/domain/defaults";
import type { ServiceType } from "@prisma/client";

export const SERVICE_LABELS: Record<string, string> = {
  CLEANING: "Cuci AC", REFILL_FREON: "Isi Freon", REPAIR: "Perbaikan",
  INSTALL: "Pemasangan", INSPECTION: "Inspeksi", DISMANTLE: "Bongkar", OTHER: "Lainnya",
};

const ITEM_TYPES = ["bool", "number", "text", "photo"] as const;

export interface ChecklistView {
  serviceType: string;
  label: string;
  items: ChecklistItem[];
  /** true bila tenant SUDAH menerapkan (menyimpan) checklist utk jenis servis ini. */
  applied: boolean;
  /** Contoh item bawaan (saran) — dipakai tombol "Muat contoh" di UI, TIDAK otomatis aktif. */
  example: ChecklistItem[];
}

/**
 * Daftar checklist tenant. OPT-IN: hanya yang BENAR-BENAR tersimpan yang dianggap "diterapkan".
 * Jika belum, items = [] (kosong) + `example` berisi saran bawaan yang bisa dimuat admin.
 */
export async function listChecklists(tenantId: string): Promise<ChecklistView[]> {
  const rows = await prisma.checklistTemplate.findMany({ where: { tenantId } });
  const byType = new Map(rows.map((r) => [r.serviceType, r.items as unknown as ChecklistItem[]]));
  return Object.keys(SERVICE_LABELS).map((st) => {
    const saved = byType.get(st as ServiceType);
    return {
      serviceType: st,
      label: SERVICE_LABELS[st],
      items: saved ?? [],
      applied: saved !== undefined,
      example: DEFAULT_CHECKLISTS[st] ?? [],
    };
  });
}

/** Validasi + sanitasi item sebelum simpan. */
function sanitize(items: unknown): ChecklistItem[] {
  if (!Array.isArray(items)) throw new Error("Format item tidak valid");
  if (items.length > 50) throw new Error("Maksimal 50 item per checklist");
  return items.map((raw, i) => {
    const it = raw as Record<string, unknown>;
    const label = String(it.label ?? "").trim();
    if (!label) throw new Error(`Item ke-${i + 1}: label wajib diisi`);
    const type = ITEM_TYPES.includes(it.type as never) ? (it.type as ChecklistItem["type"]) : "bool";
    const key = String(it.key ?? "").trim() || `item_${i + 1}_${Date.now().toString(36)}`;
    return { key, label: label.slice(0, 120), type, required: Boolean(it.required) };
  });
}

/** Simpan checklist satu jenis servis (tenant-scoped). */
export async function saveChecklist(tenantId: string, serviceType: string, items: unknown): Promise<void> {
  if (!(serviceType in SERVICE_LABELS)) throw new Error("Jenis servis tidak dikenal");
  const clean = sanitize(items);
  await prisma.checklistTemplate.upsert({
    where: { tenantId_serviceType: { tenantId, serviceType: serviceType as ServiceType } },
    create: { tenantId, serviceType: serviceType as ServiceType, items: clean as never },
    update: { items: clean as never },
  });
}

/** Nonaktifkan (hapus) checklist satu jenis servis — kembali ke kondisi OPT-IN kosong. */
export async function removeChecklist(tenantId: string, serviceType: string): Promise<void> {
  if (!(serviceType in SERVICE_LABELS)) throw new Error("Jenis servis tidak dikenal");
  await prisma.checklistTemplate.deleteMany({
    where: { tenantId, serviceType: serviceType as ServiceType },
  });
}

// ════════════════════════════════════════════════════════════════════════
// FASE 2 — Checklist per LAYANAN (ServiceCatalog.serviceId). OPT-IN, tenant-scoped.
// Berdampingan dgn per-serviceType (legacy) via dual-read. Sumber kebenaran BARU.
// ════════════════════════════════════════════════════════════════════════

export interface ServiceChecklistView {
  serviceId: string;
  code: string;
  name: string;
  category: string;
  active: boolean;
  items: ChecklistItem[];
  /** true bila tenant SUDAH menerapkan checklist utk layanan ini. */
  applied: boolean;
}

/** Daftar layanan katalog + status checklist masing-masing (OPT-IN, default kosong). */
export async function listServiceChecklists(tenantId: string): Promise<ServiceChecklistView[]> {
  const [services, templates] = await Promise.all([
    prisma.serviceCatalog.findMany({
      where: { tenantId },
      orderBy: [{ active: "desc" }, { category: "asc" }, { name: "asc" }],
      select: { id: true, code: true, name: true, category: true, active: true },
    }),
    prisma.checklistTemplate.findMany({ where: { tenantId, serviceId: { not: null } } }),
  ]);
  const byService = new Map(templates.map((t) => [t.serviceId as string, t.items as unknown as ChecklistItem[]]));
  return services.map((s) => {
    const saved = byService.get(s.id);
    return {
      serviceId: s.id,
      code: s.code,
      name: s.name,
      category: s.category,
      active: s.active,
      items: saved ?? [],
      applied: saved !== undefined,
    };
  });
}

/** Simpan checklist satu LAYANAN (tenant-scoped, validasi layanan milik tenant). */
export async function saveServiceChecklist(tenantId: string, serviceId: string, items: unknown): Promise<void> {
  const svc = await prisma.serviceCatalog.findFirst({ where: { id: serviceId, tenantId }, select: { id: true } });
  if (!svc) throw new Error("Layanan tidak ditemukan");
  const clean = sanitize(items);
  if (clean.length === 0) throw new Error("Tambah minimal 1 langkah");
  await prisma.checklistTemplate.upsert({
    where: { tenantId_serviceId: { tenantId, serviceId } },
    create: { tenantId, serviceId, items: clean as never },
    update: { items: clean as never },
  });
}

/** Nonaktifkan checklist satu layanan (opt-out) → kembali kosong/tak berlaku. */
export async function removeServiceChecklist(tenantId: string, serviceId: string): Promise<void> {
  await prisma.checklistTemplate.deleteMany({ where: { tenantId, serviceId } });
}
