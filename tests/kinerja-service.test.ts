import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Service Kinerja Tim — query sesi CLOSED dalam rentang periode + preload
 * nama/katalog/config tenant. Sumber = WorkSession/WorkItem (PEKERJAAN
 * DIKERJAKAN), BUKAN JobAssignment (penugasan).
 */
const store: {
  sessions: any[];
  technicians: any[];
  catalog: any[];
  tenant: any;
} = { sessions: [], technicians: [], catalog: [], tenant: null };

vi.mock("@/lib/prisma", () => ({
  prisma: {
    // Kontrak NYATA (schema): WorkSession TIDAK punya relasi job — tipe pekerjaan
    // diambil query terpisah per jobId (pola technician-service).
    workSession: {
      findMany: vi.fn(async ({ where }: any) =>
        store.sessions
          .filter(
            (s) =>
              s.tenantId === where.tenantId &&
              s.status === where.status &&
              s.closedAt >= where.closedAt.gte &&
              s.closedAt <= where.closedAt.lte,
          )
          .map((s) => ({
            id: s.id,
            jobId: s.jobId,
            closedAt: s.closedAt,
            customer: { name: s.customerName },
            items: s.items.map((it: any) => ({
              serviceId: it.serviceId,
              descSnapshot: it.desc,
              qty: it.qty,
              unit: it.unit,
              unitPriceSnapshot: it.unitPrice,
              lineTotal: it.lineTotal,
              techIds: it.techIds,
              kernetIds: it.kernetIds,
              asset: it.asset ? { brand: it.asset.brand, capacityPk: it.asset.capacityPk, roomLocation: it.asset.roomLocation } : null,
            })),
          })),
      ),
    },
    jobOrder: {
      findMany: vi.fn(async ({ where }: any) =>
        store.sessions
          .filter((s) => s.tenantId === where.tenantId && s.jobId && where.id.in.includes(s.jobId))
          .map((s) => ({ id: s.jobId, serviceType: s.jobType })),
      ),
    },
    technician: {
      findMany: vi.fn(async ({ where }: any) =>
        store.technicians
          .filter((t) => t.tenantId === where.tenantId)
          .map((t) => ({ id: t.id, user: { name: t.name } })),
      ),
    },
    serviceCatalog: {
      findMany: vi.fn(async ({ where }: any) =>
        store.catalog.filter((c) => where.id.in.includes(c.id) && c.tenantId === where.tenantId),
      ),
    },
    tenant: {
      findUnique: vi.fn(async () => store.tenant),
    },
  },
}));

vi.mock("@/lib/services/customer-service", () => ({
  ServiceError: class ServiceError extends Error {
    code: string;
    constructor(code: string, message: string) { super(message); this.code = code; }
  },
}));

import { listKinerja } from "../src/lib/services/kinerja-service";

const T0 = new Date(2026, 9, 5, 0, 0, 0, 0);
const T1 = new Date(2026, 9, 5, 23, 59, 59, 999);

beforeEach(() => {
  store.tenant = { teamIncentiveMode: "BAGI_RATA", incentiveEnabled: true };
  store.technicians = [
    { id: "p1", tenantId: "t1", name: "Andi Saputra" },
    { id: "p2", tenantId: "t1", name: "Budi Hartono" },
  ];
  store.catalog = [
    { id: "s1", tenantId: "t1", standardPrice: 75000, techIncentiveType: "VALUE", techIncentiveValue: 20000, kernetIncentiveType: "VALUE", kernetIncentiveValue: 10000 },
  ];
  store.sessions = [
    {
      id: "ws1", tenantId: "t1", status: "CLOSED", jobId: "j1",
      closedAt: new Date(2026, 9, 5, 10, 0), customerName: "PT Sejuk", jobType: "CLEANING",
      items: [{
        serviceId: "s1", desc: "Cuci AC Split", qty: 1, unit: "unit",
        unitPrice: 75000, lineTotal: 75000,
        techIds: ["p1"], kernetIds: ["p2"],
        asset: { brand: "LG", capacityPk: 1, roomLocation: "Kamar 1" },
      }],
    },
    {
      id: "ws2", tenantId: "t1", status: "CLOSED", jobId: "j2",
      closedAt: new Date(2026, 9, 5, 14, 0), customerName: "Ibu Hesti", jobType: "REPAIR",
      items: [{ serviceId: "s1", desc: "Perbaikan", qty: 1, unit: "unit", unitPrice: 75000, lineTotal: 75000, techIds: ["p1"], kernetIds: [], asset: null }],
    },
    {
      // di LUAR rentang → tidak boleh ikut
      id: "ws3", tenantId: "t1", status: "CLOSED", jobId: "j3",
      closedAt: new Date(2026, 9, 6, 9, 0), customerName: "Asing", jobType: "CLEANING",
      items: [{ serviceId: "s1", desc: "Cuci", qty: 1, unit: "unit", unitPrice: 75000, lineTotal: 75000, techIds: ["p2"], kernetIds: [], asset: null }],
    },
    {
      // sesi OPEN → tidak ikut (belum dikerjakan sampai tutup sesi)
      id: "ws4", tenantId: "t1", status: "OPEN", jobId: "j4",
      closedAt: null, customerName: "Belum", jobType: "CLEANING",
      items: [{ serviceId: "s1", desc: "X", qty: 1, unit: "unit", unitPrice: 75000, lineTotal: 75000, techIds: ["p1"], kernetIds: [], asset: null }],
    },
  ];
  vi.clearAllMocks();
});

describe("listKinerja — sesi CLOSED dalam rentang (bukan penugasan)", () => {
  it("ringkasan per personel + detail rows; sesi di luar rentang & OPEN tersaring", async () => {
    const r = await listKinerja("t1", T0, T1);
    const andi = r.people.find((p) => p.personId === "p1")!;
    expect(andi.personName).toBe("Andi Saputra");
    expect(andi.jobCount).toBe(2);         // j1 + j2 (ws3 di luar rentang, ws4 OPEN)
    expect(andi.itemCount).toBe(2);
    expect(andi.incentive).toBe(40000);    // 2 × 20000
    const budi = r.people.find((p) => p.personId === "p2")!;
    expect(budi.jobCount).toBe(1);
    expect(budi.incentive).toBe(10000);
    expect(r.totalPeople).toBe(2);
    expect(r.totalItems).toBe(3);
  });

  it("detail rows: label unit, tipe pekerjaan, peran, sumber tunggal WorkSession", async () => {
    const r = await listKinerja("t1", T0, T1);
    const andi = r.people.find((p) => p.personId === "p1")!;
    // urut terbaru dulu → j2 (14:00) di depan, j1 (10:00) sesudahnya
    expect(andi.rows[0].jobId).toBe("j2");
    const j1 = andi.rows.find((x) => x.jobId === "j1")!;
    expect(j1.asset).toBe("LG · 1PK · Kamar 1");
    expect(j1.jobType).toBe("CLEANING");
    expect(j1.role).toBe("TECHNICIAN");
    expect(j1.customer).toBe("PT Sejuk");
  });

  it("tenant incentiveEnabled=false → insentif 0, kinerja tetap tampil", async () => {
    store.tenant = { teamIncentiveMode: "BAGI_RATA", incentiveEnabled: false };
    const r = await listKinerja("t1", T0, T1);
    const andi = r.people.find((p) => p.personId === "p1")!;
    expect(andi.incentive).toBe(0);
    expect(andi.itemCount).toBe(2);
    expect(r.incentiveEnabled).toBe(false);
  });

  it("teamMode PENUH tenant dihormati utk insentif", async () => {
    store.tenant = { teamIncentiveMode: "PENUH", incentiveEnabled: true };
    const r = await listKinerja("t1", T0, T1);
    const andi = r.people.find((p) => p.personId === "p1")!;
    expect(andi.incentive).toBe(40000); // penuh per item
  });

  it("tanpa sesi → people kosong, total 0 (tanpa crash)", async () => {
    store.sessions = [];
    const r = await listKinerja("t1", T0, T1);
    expect(r.people).toEqual([]);
    expect(r.totalPeople).toBe(0);
    expect(r.totalItems).toBe(0);
  });

  it("tenant-scoped: sesi tenant lain tidak masuk (filter where.tenantId)", async () => {
    store.sessions = [{ ...store.sessions[0], tenantId: "T-ASING" }];
    const r = await listKinerja("t1", T0, T1);
    expect(r.people).toEqual([]);
  });
});
