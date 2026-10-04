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
      findMany: vi.fn(async ({ where }: any) =>
        store.pricing
          // selaras 3 caller asli: {tenantId}, {tenantId,customerId}, {tenantId,serviceId}
          .filter(
            (p) =>
              p.tenantId === where.tenantId &&
              (!where.customerId || p.customerId === where.customerId) &&
              (!where.serviceId || p.serviceId === where.serviceId),
          )
          .map((p) => ({
            serviceId: p.serviceId,
            price: p.price,
            service: { code: p.code ?? "S1", name: p.name ?? "Cuci AC", standardPrice: p.std ?? 75000 },
            customer: { name: p.custName ?? "PT Sejuk" },
          })),
      ),
    },
  },
}));

import { resolvePrice, exportCustomerPricingCsv, effectivePriceMap } from "../src/lib/services/service-catalog-service";

beforeEach(() => {
  store.svc = [{ id: "s1", tenantId: "t1", standardPrice: 75000 }, { id: "s2", tenantId: "t1", standardPrice: 100000 }];
  store.pricing = [{ tenantId: "t1", customerId: "c1", serviceId: "s1", price: 60000 }];
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

describe("effectivePriceMap — preview harga efektif teknisi (Poin 5)", () => {
  it("override khusus menang; layanan tanpa override memakai standardPrice", async () => {
    const prices = await effectivePriceMap("t1", "c1", [
      { id: "s1", standardPrice: 75000 },
      { id: "s2", standardPrice: 100000 },
    ]);
    expect(prices).toEqual({ s1: 60000, s2: 100000 });
  });

  it("hanya memilih override tenant+customer yang diminta", async () => {
    store.pricing.push(
      { tenantId: "t1", customerId: "c2", serviceId: "s1", price: 1000 },
      { tenantId: "t2", customerId: "c1", serviceId: "s2", price: 2000 },
    );
    const prices = await effectivePriceMap("t1", "c1", [
      { id: "s1", standardPrice: 75000 },
      { id: "s2", standardPrice: 100000 },
    ]);
    expect(prices).toEqual({ s1: 60000, s2: 100000 });
  });

  it("katalog kosong → map kosong dan tanpa query override", async () => {
    const { prisma } = await import("@/lib/prisma");
    const spy = vi.mocked(prisma.customerPricing.findMany);
    spy.mockClear();
    expect(await effectivePriceMap("t1", "c1", [])).toEqual({});
    expect(spy).not.toHaveBeenCalled();
  });

  it("SINKRON dgn resolvePrice (preview = nilai yang nanti di-snapshot)", async () => {
    for (const [tenantId, customerId] of [
      ["t1", "c1"], // punya override (s1)
      ["t1", "c2"], // tanpa override sama sekali
    ] as const) {
      const catalog = [
        { id: "s1", standardPrice: 75000 },
        { id: "s2", standardPrice: 100000 },
      ];
      const [map, resolved] = await Promise.all([
        effectivePriceMap(tenantId, customerId, catalog),
        Promise.all(catalog.map((c) => resolvePrice(tenantId, customerId, c.id))),
      ]);
      expect(map).toEqual({ s1: resolved[0], s2: resolved[1] });
    }
  });
});

describe("exportCustomerPricingCsv (K22)", () => {
  it("header + baris override + selisih; escape koma", async () => {
    store.pricing = [{ tenantId: "t1", customerId: "c1", serviceId: "s1", price: 60000, code: "CUCI-1", name: "Cuci, AC Split", std: 75000, custName: "PT Sejuk" }];
    const csv = await exportCustomerPricingCsv("t1");
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("Kode,Nama Layanan,Harga Standar,Pelanggan,Harga Khusus,Selisih");
    expect(lines[1]).toContain('"Cuci, AC Split"'); // dibungkus kutip krn ada koma
    expect(lines[1]).toContain("60000");
    expect(lines[1]).toContain("-15000"); // selisih 60000-75000
  });
  it("kosong → hanya header", async () => {
    store.pricing = [];
    const csv = await exportCustomerPricingCsv("t1");
    expect(csv.split("\r\n")).toHaveLength(1);
  });
});
