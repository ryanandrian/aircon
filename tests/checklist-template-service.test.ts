import { describe, it, expect, vi, beforeEach } from "vitest";

const store = {
  services: [] as any[],
  templates: [] as any[],
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    serviceCatalog: {
      findMany: vi.fn(async ({ where }: any) => store.services.filter((s) => s.tenantId === where.tenantId)),
      findFirst: vi.fn(async ({ where }: any) => store.services.find((s) => s.id === where.id && s.tenantId === where.tenantId) ?? null),
    },
    checklistTemplate: {
      findMany: vi.fn(async ({ where }: any) => store.templates.filter((t) =>
        t.tenantId === where.tenantId && (where.serviceId?.not === null ? t.serviceId !== null : true),
      )),
      upsert: vi.fn(async ({ where, create, update }: any) => {
        const key = where.tenantId_serviceId;
        let row = store.templates.find((t) => t.tenantId === key.tenantId && t.serviceId === key.serviceId);
        if (row) Object.assign(row, update);
        else { row = { id: `tpl-${store.templates.length + 1}`, ...create }; store.templates.push(row); }
        return row;
      }),
      deleteMany: vi.fn(async ({ where }: any) => {
        const before = store.templates.length;
        store.templates = store.templates.filter((t) => !(t.tenantId === where.tenantId && t.serviceId === where.serviceId));
        return { count: before - store.templates.length };
      }),
    },
  },
}));

import { listServiceChecklists, saveServiceChecklist, removeServiceChecklist } from "../src/lib/services/checklist-template-service";

beforeEach(() => {
  store.services = [
    { id: "svc1", tenantId: "t1", code: "CLEAN", name: "Cuci AC", category: "SERVICE", active: true },
    { id: "svc2", tenantId: "t1", code: "REPAIR", name: "Perbaikan", category: "SERVICE", active: true },
    { id: "svc-foreign", tenantId: "t2", code: "X", name: "Layanan Asing", category: "SERVICE", active: true },
  ];
  store.templates = [];
});

describe("checklist per layanan — opt-in & tenant scope", () => {
  it("tanpa template: semua layanan kosong, belum diterapkan (default tidak mengunci)", async () => {
    const rows = await listServiceChecklists("t1");
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => !r.applied && r.items.length === 0)).toBe(true);
  });

  it("layanan tenant lain tidak muncul di daftar layanan", async () => {
    const rows = await listServiceChecklists("t1");
    expect(rows.map((r) => r.serviceId)).toEqual(["svc1", "svc2"]);
  });

  it("simpan template per layanan: hanya layanan yg disimpan jadi applied", async () => {
    await saveServiceChecklist("t1", "svc1", [
      { key: "filter", label: "Cuci filter", type: "bool", required: true },
    ]);
    const rows = await listServiceChecklists("t1");
    expect(rows.find((r) => r.serviceId === "svc1")).toMatchObject({ applied: true, items: [{ key: "filter", required: true }] });
    expect(rows.find((r) => r.serviceId === "svc2")).toMatchObject({ applied: false, items: [] });
  });

  it("layanan foreign tenant ditolak saat simpan", async () => {
    await expect(saveServiceChecklist("t1", "svc-foreign", [
      { key: "x", label: "Langkah", type: "bool", required: true },
    ])).rejects.toThrow("Layanan tidak ditemukan");
    expect(store.templates).toHaveLength(0);
  });

  it("template checklist per layanan wajib memiliki minimal satu langkah", async () => {
    await expect(saveServiceChecklist("t1", "svc1", [])).rejects.toThrow("Tambah minimal 1 langkah");
  });

  it("template checklist tenant lain tidak bocor lintas tenant", async () => {
    await saveServiceChecklist("t1", "svc1", [
      { key: "filter", label: "Cuci filter", type: "bool", required: true },
    ]);
    // t2 hanya punya layanannya sendiri (svc-foreign); template t1 tak boleh terbaca.
    const rows = await listServiceChecklists("t2");
    expect(rows.map((r) => r.serviceId)).toEqual(["svc-foreign"]);
    expect(rows.every((r) => !r.applied && r.items.length === 0)).toBe(true);
  });

  it("hapus template = opt-out, bukan template kosong yg tetap aktif", async () => {
    await saveServiceChecklist("t1", "svc1", [
      { key: "filter", label: "Cuci filter", type: "bool", required: true },
    ]);
    await removeServiceChecklist("t1", "svc1");
    const rows = await listServiceChecklists("t1");
    expect(rows.find((r) => r.serviceId === "svc1")).toMatchObject({ applied: false, items: [] });
  });
});
