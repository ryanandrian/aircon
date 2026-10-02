import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Jalur input per-unit: form unit harus bisa MENYIMPAN interval servis khusus unit
 * (Asset.maintenanceIntervalDays) — sebelumnya kolom ini tidak pernah diisi dari UI.
 */

const store: { assets: any[] } = { assets: [] };

vi.mock("@/lib/prisma", () => ({
  prisma: {
    asset: {
      findFirst: vi.fn(async ({ where }: any) =>
        store.assets.find((a) => a.id === where.id && a.tenantId === where.tenantId && a.deletedAt === null) ?? null,
      ),
      create: vi.fn(async ({ data }: any) => {
        const row = { id: `a${store.assets.length + 1}`, ...data };
        store.assets.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const row = store.assets.find((a) => a.id === where.id);
        if (!row) throw new Error("tidak ada");
        Object.assign(row, data);
        return row;
      }),
    },
    customer: {
      findFirst: vi.fn(async () => ({ id: "c1" })),
    },
    device: {
      findFirst: vi.fn(async () => null),
    },
    $transaction: vi.fn(async (ops: any[]) => Promise.all(ops)),
  },
}));

vi.mock("@/lib/services/quota-guard", () => ({
  assertQuota: vi.fn(async () => {}),
}));

vi.mock("@/lib/auth/context", () => ({
  getServerContext: vi.fn(async () => ({ tenantId: "t1", userId: "u1", role: "OWNER", name: "Pemilik" })),
  tryGetServerContext: vi.fn(async () => ({ tenantId: "t1", userId: "u1", role: "OWNER", name: "Pemilik" })),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { actionCreateAsset, actionUpdateAsset } from "../src/app/app/unit/asset-actions";
import { parseMaintenanceIntervalInput, updateAssetSchema } from "../src/lib/validation/asset";

beforeEach(() => {
  store.assets = [];
});

describe("actionCreateAsset — interval servis per unit", () => {
  it("menyimpan maintenanceIntervalDays yang dikirim form", async () => {
    const res = await actionCreateAsset({
      customerId: "c1", type: "SPLIT", brand: "Daikin",
      maintenanceIntervalDays: 45,
    });
    expect(res.ok).toBe(true);
    expect(store.assets[0].maintenanceIntervalDays).toBe(45);
  });

  it("tanpa interval -> null (memakai default usaha)", async () => {
    const res = await actionCreateAsset({ customerId: "c1", type: "SPLIT" });
    expect(res.ok).toBe(true);
    expect(store.assets[0].maintenanceIntervalDays).toBeNull();
  });

  it("menolak interval 0", async () => {
    const res = await actionCreateAsset({
      customerId: "c1", type: "SPLIT", maintenanceIntervalDays: 0,
    });
    expect(res.ok).toBe(false);
    expect(store.assets).toHaveLength(0);
  });

  it("menolak interval non-bulat", async () => {
    const res = await actionCreateAsset({
      customerId: "c1", type: "SPLIT", maintenanceIntervalDays: 45.5,
    });
    expect(res.ok).toBe(false);
  });
});

describe("actionUpdateAsset — ubah interval servis per unit", () => {
  beforeEach(() => {
    store.assets.push({
      id: "a1", tenantId: "t1", customerId: "c1", brand: "Daikin",
      maintenanceIntervalDays: null, deletedAt: null,
    });
  });

  it("mengubah interval unit yang ada", async () => {
    const res = await actionUpdateAsset("a1", { maintenanceIntervalDays: 30 });
    expect(res.ok).toBe(true);
    expect(store.assets[0].maintenanceIntervalDays).toBe(30);
  });

  it("tanpa field interval tidak menyentuh kolomnya", async () => {
    store.assets[0].maintenanceIntervalDays = 90;
    const res = await actionUpdateAsset("a1", { roomLocation: "Dapur" });
    expect(res.ok).toBe(true);
    expect(store.assets[0].maintenanceIntervalDays).toBe(90);
    expect(store.assets[0].roomLocation).toBe("Dapur");
  });

  it("menolak interval nol", async () => {
    const res = await actionUpdateAsset("a1", { maintenanceIntervalDays: 0 });
    expect(res.ok).toBe(false);
  });
});

describe("parseMaintenanceIntervalInput — logika form (string input klien)", () => {
  it("menerima angka bulat valid dalam bentuk string", () => {
    expect(parseMaintenanceIntervalInput("45")).toEqual({ ok: true, days: 45 });
  });

  it("kosong berarti biarkan memakai default usaha (null)", () => {
    expect(parseMaintenanceIntervalInput("")).toEqual({ ok: true, days: null });
  });

  it("spasi kosong juga dianggap kosong", () => {
    expect(parseMaintenanceIntervalInput("   ")).toEqual({ ok: true, days: null });
  });

  it("menolak nol dan negatif", () => {
    expect(parseMaintenanceIntervalInput("0").ok).toBe(false);
    expect(parseMaintenanceIntervalInput("-9").ok).toBe(false);
  });

  it("menolak desimal dan teks campur", () => {
    expect(parseMaintenanceIntervalInput("45.5").ok).toBe(false);
    expect(parseMaintenanceIntervalInput("12hari").ok).toBe(false);
  });
});

describe("updateAssetSchema — menghapus aturan khusus unit", () => {
  it("menerima null (unit kembali memakai aturan default usaha)", () => {
    expect(updateAssetSchema.safeParse({ maintenanceIntervalDays: null }).success).toBe(true);
  });
});

describe("actionUpdateAsset — kirim null untuk kembali ke default usaha", () => {
  beforeEach(() => {
    store.assets = [{
      id: "a1", tenantId: "t1", customerId: "c1", brand: "Daikin",
      maintenanceIntervalDays: 45, deletedAt: null,
    }];
  });

  it("null mengosongkan aturan interval unit", async () => {
    const res = await actionUpdateAsset("a1", { maintenanceIntervalDays: null });
    expect(res.ok).toBe(true);
    expect(store.assets[0].maintenanceIntervalDays).toBeNull();
  });
});
