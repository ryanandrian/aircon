import { describe, it, expect, vi, beforeEach } from "vitest";
import { computeItemIncentive, type IncentiveCatalogItem } from "../src/lib/services/service-catalog-service";

vi.mock("@/lib/services/customer-service", () => ({
  ServiceError: class ServiceError extends Error {
    code: string;
    constructor(code: string, message: string) { super(message); this.code = code; }
  },
}));

/** F2.2 — kalkulasi insentif MURNI (K6 semua kategori, K7 bagi-rata/penuh, insentif=0) + resolvePrice. */

const base: IncentiveCatalogItem = {
  standardPrice: 100000,
  techIncentiveType: "VALUE",
  techIncentiveValue: 20000,
  kernetIncentiveType: "VALUE",
  kernetIncentiveValue: 10000,
};

describe("computeItemIncentive — VALUE", () => {
  it("teknisi tunggal VALUE → penuh", () => {
    expect(computeItemIncentive(base, "TECHNICIAN", 100000, 1, 1)).toBe(20000);
  });
  it("kernet tunggal VALUE (pos terpisah)", () => {
    expect(computeItemIncentive(base, "KERNET", 100000, 1, 1)).toBe(10000);
  });
  it("qty>1 mengalikan nilai VALUE", () => {
    expect(computeItemIncentive(base, "TECHNICIAN", 100000, 3, 1)).toBe(60000);
  });
  it("BAGI_RATA 2 teknisi → separuh masing-masing", () => {
    expect(computeItemIncentive(base, "TECHNICIAN", 100000, 1, 2, "BAGI_RATA")).toBe(10000);
  });
  it("BAGI_RATA 3 teknisi → dibulatkan (20000/3 = 6667)", () => {
    expect(computeItemIncentive(base, "TECHNICIAN", 100000, 1, 3, "BAGI_RATA")).toBe(6667);
  });
  it("PENUH 2 teknisi → tiap orang penuh", () => {
    expect(computeItemIncentive(base, "TECHNICIAN", 100000, 1, 2, "PENUH")).toBe(20000);
  });
});

describe("computeItemIncentive — PERCENT", () => {
  const pct: IncentiveCatalogItem = {
    standardPrice: 100000,
    techIncentiveType: "PERCENT",
    techIncentiveValue: 10, // 10%
    kernetIncentiveType: "PERCENT",
    kernetIncentiveValue: 5,
  };
  it("10% dari harga jual (unitPrice dipakai, bukan standardPrice)", () => {
    expect(computeItemIncentive(pct, "TECHNICIAN", 150000, 1, 1)).toBe(15000); // 10% x 150000
  });
  it("PERCENT × qty", () => {
    expect(computeItemIncentive(pct, "TECHNICIAN", 100000, 2, 1)).toBe(20000); // 10% x 100000 x 2
  });
  it("PERCENT bagi rata 2 orang", () => {
    expect(computeItemIncentive(pct, "KERNET", 100000, 1, 2)).toBe(2500); // (5% x 100000)/2
  });
});

describe("computeItemIncentive — insentif 0 / kategori barang", () => {
  it("insentif 0 → tak ada insentif", () => {
    const z: IncentiveCatalogItem = { ...base, techIncentiveValue: 0 };
    expect(computeItemIncentive(z, "TECHNICIAN", 100000, 5, 1)).toBe(0);
  });
  it("consumable/sparepart tetap bisa berinsentif (K6) — logika sama", () => {
    // item sparepart dgn insentif VALUE 5000 utk teknisi
    const spare: IncentiveCatalogItem = { ...base, techIncentiveValue: 5000 };
    expect(computeItemIncentive(spare, "TECHNICIAN", 250000, 2, 1)).toBe(10000);
  });
  it("qty 0 → 0", () => {
    expect(computeItemIncentive(base, "TECHNICIAN", 100000, 0, 1)).toBe(0);
  });
});

// ---------- resolvePrice (mocked prisma) ----------
const store: { svc: any[]; pricing: any[] } = { svc: [], pricing: [] };
vi.mock("@/lib/prisma", () => ({
  prisma: {
    serviceCatalog: {
      findFirst: vi.fn(async ({ where }: any) =>
        store.svc.find((s) => s.id === where.id && s.tenantId === where.tenantId) ?? null,
      ),
    },
    customerPricing: {
      findUnique: vi.fn(async ({ where }: any) => {
        const k = where.customerId_serviceId;
        return store.pricing.find((p) => p.customerId === k.customerId && p.serviceId === k.serviceId) ?? null;
      }),
    },
  },
}));

import { resolvePrice } from "../src/lib/services/service-catalog-service";

beforeEach(() => {
  store.svc = [{ id: "s1", tenantId: "t1", standardPrice: 75000 }];
  store.pricing = [{ customerId: "c1", serviceId: "s1", price: 60000 }];
});

describe("resolvePrice (K21)", () => {
  it("ada harga khusus → pakai harga khusus", async () => {
    expect(await resolvePrice("t1", "c1", "s1")).toBe(60000);
  });
  it("tak ada harga khusus → pakai harga standar", async () => {
    expect(await resolvePrice("t1", "c2", "s1")).toBe(75000);
  });
  it("layanan tak ada → throw", async () => {
    await expect(resolvePrice("t1", "c1", "zzz")).rejects.toThrow();
  });
});
