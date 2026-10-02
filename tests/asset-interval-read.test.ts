import { describe, it, expect, vi } from "vitest";

const store: { asset: Record<string, any> } = {
  asset: {
    id: "a1", tenantId: "t1", customerId: "c1", brand: "Daikin", model: "FTKC",
    type: "SPLIT", capacityPk: 1, roomLocation: "Ruang Tamu",
    nextServiceDate: new Date("2026-10-02T00:00:00Z"),
    maintenanceIntervalDays: 45,
    deletedAt: null,
    _count: { jobs: 2 },
    jobs: [{ completedAt: new Date("2026-08-18T00:00:00Z") }],
  },
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    asset: {
      findMany: vi.fn(async () => [store.asset]),
    },
  },
}));

import { listAssetsByCustomerWithHistory } from "../src/lib/services/asset-service";

describe("listAssetsByCustomerWithHistory", () => {
  it("mengembalikan interval servis khusus unit agar UI bisa menampilkannya", async () => {
    const rows = await listAssetsByCustomerWithHistory("t1", "c1");
    expect(rows[0].maintenanceIntervalDays).toBe(45);
  });

  it("membedakan unit yang memakai default tenant (interval null)", async () => {
    store.asset.maintenanceIntervalDays = null;
    const rows = await listAssetsByCustomerWithHistory("t1", "c1");
    expect(rows[0].maintenanceIntervalDays).toBeNull();
  });
});
