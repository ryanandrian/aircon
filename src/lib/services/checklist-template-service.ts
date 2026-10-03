/**
 * Checklist Template Service (tenant) — source tunggal: ChecklistTemplate.serviceId.
 * Tenant-scoped. Owner/admin edit. Items disimpan sebagai JSON array; default opt-in kosong.
 */
import { prisma } from "@/lib/prisma";
import type { ChecklistItem } from "@/lib/domain/defaults";

const ITEM_TYPES = ["bool", "number", "text", "photo"] as const;

export interface ServiceChecklistView {
  serviceId: string;
  code: string;
  name: string;
  category: string;
  active: boolean;
  items: ChecklistItem[];
  /** true bila tenant benar-benar menyimpan checklist untuk layanan ini. */
  applied: boolean;
}

/** Daftar layanan tenant + checklist aktif (default kosong; tidak ada template bawaan otomatis). */
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

/** Validasi + sanitasi checklist sebelum simpan. */
function sanitize(items: unknown): ChecklistItem[] {
  if (!Array.isArray(items)) throw new Error("Format item tidak valid");
  if (items.length > 50) throw new Error("Maksimal 50 item per checklist");
  const seen = new Set<string>();
  return items.map((raw, i) => {
    const it = raw as Record<string, unknown>;
    const label = String(it.label ?? "").trim();
    if (!label) throw new Error(`Item ke-${i + 1}: label wajib diisi`);
    const type = ITEM_TYPES.includes(it.type as never) ? (it.type as ChecklistItem["type"]) : "bool";
    const key = String(it.key ?? "").trim() || `item_${i + 1}_${Date.now().toString(36)}`;
    if (seen.has(key)) throw new Error(`Item ke-${i + 1}: key duplikat`);
    seen.add(key);
    return { key, label: label.slice(0, 120), type, required: Boolean(it.required) };
  });
}

/** Simpan checklist satu layanan (tenant-scoped, layanan wajib milik tenant). */
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

/** Nonaktifkan checklist layanan (opt-out): tidak ada row aktif setelah operasi. */
export async function removeServiceChecklist(tenantId: string, serviceId: string): Promise<void> {
  // Pastikan layanan tenant-scoped ada, supaya id asing tak dianggap sukses.
  const svc = await prisma.serviceCatalog.findFirst({ where: { id: serviceId, tenantId }, select: { id: true } });
  if (!svc) throw new Error("Layanan tidak ditemukan");
  await prisma.checklistTemplate.deleteMany({ where: { tenantId, serviceId } });
}
