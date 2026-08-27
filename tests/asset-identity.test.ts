import { describe, it, expect, vi, beforeEach } from "vitest";

/** Uji Fase 1: suggestLocations (dedupe + prioritas pelanggan) & findPossibleDuplicates (warning lunak). */
const store: { assets: any[] } = { assets: [] };

vi.mock("@/lib/prisma", () => ({
  prisma: {
    asset: {
      findMany: vi.fn(async ({ where, select }: any) => {
        let rows = store.assets.filter((a) => a.tenantId === where.tenantId && a.deletedAt === null);
        if (where.customerId) rows = rows.filter((a) => a.customerId === where.customerId);
        if (where.roomLocation?.not === null) rows = rows.filter((a) => a.roomLocation !== null);
        return rows;
      }),
    },
  },
}));

vi.mock("@/lib/services/quota-guard", () => ({ assertQuota: vi.fn(async () => {}) }));

vi.mock("@/lib/services/customer-service", () => ({
  ServiceError: class ServiceError extends Error {
    code: string;
    constructor(code: string, message: string) { super(message); this.code = code; }
  },
}));

import { suggestLocations, findPossibleDuplicates } from "../src/lib/services/asset-service";

beforeEach(() => {
  store.assets = [
    { id: "a1", tenantId: "t1", customerId: "c1", brand: "Daikin", capacityPk: 0.75, roomLocation: "Ruang Tamu", deletedAt: null, updatedAt: new Date(3) },
    { id: "a2", tenantId: "t1", customerId: "c1", brand: "Daikin", capacityPk: 0.75, roomLocation: "ruang tamu", deletedAt: null, updatedAt: new Date(2) }, // dup case-insensitive
    { id: "a3", tenantId: "t1", customerId: "c2", brand: "LG", capacityPk: 1, roomLocation: "Kantor", deletedAt: null, updatedAt: new Date(1) },
    { id: "a4", tenantId: "t1", customerId: "c1", brand: "Panasonic", capacityPk: 0.5, roomLocation: null, deletedAt: null, updatedAt: new Date(0) },
  ];
});

describe("suggestLocations", () => {
  it("dedupe case-insensitive + prioritas pelanggan dulu", async () => {
    const res = await suggestLocations("t1", "c1");
    // 'Ruang Tamu' (c1) sebelum 'Kantor' (c2), dan 'ruang tamu' tak dobel
    expect(res[0].toLowerCase()).toBe("ruang tamu");
    expect(res).toContain("Kantor");
    expect(res.filter((l) => l.toLowerCase() === "ruang tamu")).toHaveLength(1);
  });

  it("abaikan lokasi kosong/null", async () => {
    const res = await suggestLocations("t1");
    expect(res).not.toContain(null);
    expect(res.every((l) => l.trim().length > 0)).toBe(true);
  });
});

describe("findPossibleDuplicates (warning lunak)", () => {
  it("deteksi unit mirip: lokasi sama + brand sama", async () => {
    const dups = await findPossibleDuplicates("t1", "c1", { brand: "Daikin", capacityPk: 0.75, roomLocation: "Ruang Tamu" });
    expect(dups.length).toBeGreaterThanOrEqual(1);
    expect(dups.map((d) => d.id)).toContain("a1");
  });

  it("lokasi beda -> tak dianggap duplikat", async () => {
    const dups = await findPossibleDuplicates("t1", "c1", { brand: "Daikin", capacityPk: 0.75, roomLocation: "Dapur" });
    expect(dups).toHaveLength(0);
  });

  it("pelanggan lain tak tercampur", async () => {
    const dups = await findPossibleDuplicates("t1", "c1", { brand: "LG", capacityPk: 1, roomLocation: "Kantor" });
    expect(dups).toHaveLength(0); // Kantor milik c2, bukan c1
  });
});
