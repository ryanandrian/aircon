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
}

/** Daftar checklist tenant (gabung tersimpan + default bila belum ada). */
export async function listChecklists(tenantId: string): Promise<ChecklistView[]> {
  const rows = await prisma.checklistTemplate.findMany({ where: { tenantId } });
  const byType = new Map(rows.map((r) => [r.serviceType, r.items as unknown as ChecklistItem[]]));
  return Object.keys(SERVICE_LABELS).map((st) => ({
    serviceType: st,
    label: SERVICE_LABELS[st],
    items: byType.get(st as ServiceType) ?? DEFAULT_CHECKLISTS[st] ?? [],
  }));
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

/** Kembalikan checklist satu jenis ke default. */
export async function resetChecklist(tenantId: string, serviceType: string): Promise<ChecklistItem[]> {
  if (!(serviceType in SERVICE_LABELS)) throw new Error("Jenis servis tidak dikenal");
  const def = DEFAULT_CHECKLISTS[serviceType] ?? [];
  await prisma.checklistTemplate.upsert({
    where: { tenantId_serviceType: { tenantId, serviceType: serviceType as ServiceType } },
    create: { tenantId, serviceType: serviceType as ServiceType, items: def as never },
    update: { items: def as never },
  });
  return def;
}
