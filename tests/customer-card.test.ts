import { describe, it, expect, vi, beforeEach } from "vitest";

/** Uji Fase 5: getOrCreateCardToken (lazy, stabil) & getCustomerCardByToken (strip biaya, due count). */
const store: { customers: any[]; assets: any[] } = { customers: [], assets: [] };

vi.mock("@/lib/prisma", () => ({
  prisma: {
    customer: {
      findFirst: vi.fn(async ({ where }: any) =>
        store.customers.find((c) => c.id === where.id && c.tenantId === where.tenantId && c.deletedAt === null) ?? null,
      ),
      findUnique: vi.fn(async ({ where }: any) =>
        store.customers.find((c) => c.cardToken === where.cardToken) ?? null,
      ),
      update: vi.fn(async ({ where, data }: any) => {
        const c = store.customers.find((x) => x.id === where.id);
        Object.assign(c, data);
        return c;
      }),
    },
    asset: {
      findMany: vi.fn(async ({ where }: any) =>
        store.assets
          .filter((a) => a.customerId === where.customerId && a.tenantId === where.tenantId && a.deletedAt === null)
          .map((a) => ({ ...a, unitCode: a.unitCode ?? null, jobs: a.jobs ?? [] })),
      ),
    },
    tenant: {
      findUnique: vi.fn(async ({ where }: any) =>
        where.id === "t1" ? { name: "PT Sejuk", logoUrl: "" } : null,
      ),
    },
  },
}));

import { getOrCreateCardToken, getCustomerCardByToken } from "../src/lib/services/customer-card-service";

const label = (t: string) => ({ CLEANING: "Cuci AC", REPAIR: "Perbaikan" } as Record<string, string>)[t] ?? t;

beforeEach(() => {
  store.customers = [
    { id: "c1", tenantId: "t1", name: "PT Sejuk", cardToken: null, deletedAt: null },
  ];
  store.assets = [
    {
      id: "a1", tenantId: "t1", customerId: "c1", brand: "Daikin", model: null, type: "SPLIT",
      capacityPk: 0.75, roomLocation: "Ruang Tamu", deletedAt: null,
      nextServiceDate: new Date(Date.now() + 3 * 86400000), // due bulan ini (kira-kira)
      unitCode: { code: "7F3K9M2" },
      jobs: [
        { completedAt: new Date("2026-06-01"), createdAt: new Date("2026-06-01"), serviceType: "CLEANING" },
        { completedAt: new Date("2026-03-01"), createdAt: new Date("2026-03-01"), serviceType: "REPAIR" },
      ],
    },
  ];
});

describe("getOrCreateCardToken", () => {
  it("buat token lazy lalu stabil (idempoten)", async () => {
    const t1 = await getOrCreateCardToken("t1", "c1");
    expect(t1).toBeTruthy();
    const t2 = await getOrCreateCardToken("t1", "c1");
    expect(t2).toBe(t1); // token sama, tak berubah
  });
  it("tolak pelanggan tenant lain", async () => {
    const t = await getOrCreateCardToken("tX", "c1");
    expect(t).toBeNull();
  });
});

describe("getCustomerCardByToken", () => {
  it("resolve token → semua unit + riwayat descending, kode unit ikut", async () => {
    const token = await getOrCreateCardToken("t1", "c1");
    const card = await getCustomerCardByToken(token!, label);
    expect(card).toBeTruthy();
    expect(card!.customerName).toBe("PT Sejuk");
    expect(card!.units).toHaveLength(1);
    const u = card!.units[0];
    expect(u.code).toBe("7F3K9M2");
    expect(u.history[0].activity).toBe("Cuci AC"); // terbaru dulu (Juni sebelum Maret)
    expect(u.lastService?.activity).toBe("Cuci AC");
  });
  it("tak ada field biaya di output (strip)", async () => {
    const token = await getOrCreateCardToken("t1", "c1");
    const card = await getCustomerCardByToken(token!, label);
    const json = JSON.stringify(card);
    expect(json.toLowerCase()).not.toContain("price");
    expect(json.toLowerCase()).not.toContain("biaya");
  });
  it("token tak dikenal → null", async () => {
    const card = await getCustomerCardByToken("zzz", label);
    expect(card).toBeNull();
  });
});
