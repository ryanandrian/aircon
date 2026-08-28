import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/services/service-catalog-service", () => ({
  // Implementasi computeItemIncentive nyata (disalin) agar aggregateIncentives dapat diuji tanpa rantai alias.
  computeItemIncentive: (item: any, roleOnJob: string, unitPrice: number, qty: number, personCountSameRole: number, teamMode = "BAGI_RATA") => {
    const q = qty > 0 ? qty : 0;
    const persons = personCountSameRole > 0 ? personCountSameRole : 1;
    const type = roleOnJob === "TECHNICIAN" ? item.techIncentiveType : item.kernetIncentiveType;
    const value = roleOnJob === "TECHNICIAN" ? item.techIncentiveValue : item.kernetIncentiveValue;
    if (!value || value <= 0) return 0;
    const lineIncentive = type === "PERCENT" ? (unitPrice * q * value) / 100 : value * q;
    const perPerson = teamMode === "PENUH" ? lineIncentive : lineIncentive / persons;
    return Math.round(perPerson);
  },
}));

import { aggregateIncentives, type IncentiveLineInput } from "../src/lib/services/incentive-service";

type IncentiveCatalogItem = {
  standardPrice: number;
  techIncentiveType: string; techIncentiveValue: number;
  kernetIncentiveType: string; kernetIncentiveValue: number;
};

/** F6.1 — agregasi insentif per personel (K6 semua kategori, K7 bagi rata/penuh). */

const cat = (over: Partial<IncentiveCatalogItem> = {}): any => ({
  standardPrice: 100000,
  techIncentiveType: "VALUE", techIncentiveValue: 20000,
  kernetIncentiveType: "VALUE", kernetIncentiveValue: 10000,
  ...over,
});

describe("aggregateIncentives", () => {
  it("1 teknisi 1 kernet → masing-masing dapat pos-nya", () => {
    const map = new Map([["s1", cat()]]);
    const items: IncentiveLineInput[] = [{ serviceId: "s1", unitPrice: 100000, qty: 1, techIds: ["t1"], kernetIds: ["k1"] }];
    const r = aggregateIncentives(items, map, "BAGI_RATA");
    expect(r.get("t1")).toBe(20000);
    expect(r.get("k1")).toBe(10000);
  });

  it("BAGI_RATA: 2 teknisi peran sama → insentif dibagi 2", () => {
    const map = new Map([["s1", cat()]]);
    const items: IncentiveLineInput[] = [{ serviceId: "s1", unitPrice: 100000, qty: 1, techIds: ["t1", "t2"], kernetIds: [] }];
    const r = aggregateIncentives(items, map, "BAGI_RATA");
    expect(r.get("t1")).toBe(10000);
    expect(r.get("t2")).toBe(10000);
  });

  it("PENUH: 2 teknisi → masing-masing dapat penuh", () => {
    const map = new Map([["s1", cat()]]);
    const items: IncentiveLineInput[] = [{ serviceId: "s1", unitPrice: 100000, qty: 1, techIds: ["t1", "t2"], kernetIds: [] }];
    const r = aggregateIncentives(items, map, "PENUH");
    expect(r.get("t1")).toBe(20000);
    expect(r.get("t2")).toBe(20000);
  });

  it("PERCENT: 10% dari harga × qty", () => {
    const map = new Map([["s1", cat({ techIncentiveType: "PERCENT", techIncentiveValue: 10 })]]);
    const items: IncentiveLineInput[] = [{ serviceId: "s1", unitPrice: 100000, qty: 3, techIds: ["t1"], kernetIds: [] }];
    const r = aggregateIncentives(items, map, "BAGI_RATA");
    expect(r.get("t1")).toBe(30000); // 10% x 100.000 x 3
  });

  it("insentif 0 → personel tak masuk (K6)", () => {
    const map = new Map([["s1", cat({ kernetIncentiveValue: 0 })]]);
    const items: IncentiveLineInput[] = [{ serviceId: "s1", unitPrice: 100000, qty: 1, techIds: [], kernetIds: ["k1"] }];
    const r = aggregateIncentives(items, map, "BAGI_RATA");
    expect(r.get("k1") ?? 0).toBe(0);
  });

  it("akumulasi lintas beberapa item", () => {
    const map = new Map([["s1", cat()], ["s2", cat({ techIncentiveValue: 5000 })]]);
    const items: IncentiveLineInput[] = [
      { serviceId: "s1", unitPrice: 100000, qty: 1, techIds: ["t1"], kernetIds: [] },
      { serviceId: "s2", unitPrice: 50000, qty: 1, techIds: ["t1"], kernetIds: [] },
    ];
    const r = aggregateIncentives(items, map, "BAGI_RATA");
    expect(r.get("t1")).toBe(25000); // 20.000 + 5.000
  });

  it("service tak ada di katalog → dilewati", () => {
    const map = new Map<string, any>();
    const items: IncentiveLineInput[] = [{ serviceId: "sX", unitPrice: 100000, qty: 1, techIds: ["t1"], kernetIds: [] }];
    const r = aggregateIncentives(items, map, "BAGI_RATA");
    expect(r.size).toBe(0);
  });
});
