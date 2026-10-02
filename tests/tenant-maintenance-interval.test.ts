import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Fitur: interval servis dikonfigurasi per tenant.
 * Sebelumnya kolom Tenant.maintenanceIntervalDays default 90 TIDAK PERNAH bisa diubah
 * dari aplikasi (tidak ada jalur input) — tes ini menetapkan jalurnya ada & tervalidasi.
 */

// In-memory mirror prisma.tenant (polа yang sama dengan tests/asset-identity.test.ts).
const store: { tenants: Record<string, any> } = { tenants: {} };

vi.mock("@/lib/prisma", () => ({
  prisma: {
    tenant: {
      findUnique: vi.fn(async ({ where, select }: any) => {
        const t = store.tenants[where.id];
        if (!t) return null;
        if (select) {
          const out: Record<string, unknown> = {};
          for (const k of Object.keys(select)) if (select[k]) out[k] = t[k];
          return out;
        }
        return t;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const t = store.tenants[where.id];
        if (!t) throw new Error("tenant tidak ada");
        Object.assign(t, data);
        return t;
      }),
    },
  },
}));

import { tenantMaintenanceSchema } from "../src/lib/validation/tenant-profile";
import { getMaintenanceInterval, updateMaintenanceInterval } from "../src/lib/services/tenant-profile-service";

beforeEach(() => {
  store.tenants = { t1: { id: "t1", maintenanceIntervalDays: 90 } };
});

describe("tenantMaintenanceSchema", () => {
  it("menerima interval bulat positif", () => {
    const r = tenantMaintenanceSchema.safeParse({ maintenanceIntervalDays: 30 });
    expect(r.success).toBe(true);
  });

  it("menolak nol (hindari pembagian nol / jadwal tak masuk akal)", () => {
    expect(tenantMaintenanceSchema.safeParse({ maintenanceIntervalDays: 0 }).success).toBe(false);
  });

  it("menolak negatif", () => {
    expect(tenantMaintenanceSchema.safeParse({ maintenanceIntervalDays: -7 }).success).toBe(false);
  });

  it("menolak non-bulat", () => {
    expect(tenantMaintenanceSchema.safeParse({ maintenanceIntervalDays: 30.5 }).success).toBe(false);
  });

});

describe("updateMaintenanceInterval", () => {
  it("menulis interval baru ke tenant yang bersangkutan", async () => {
    await updateMaintenanceInterval("t1", 45);
    expect(store.tenants.t1.maintenanceIntervalDays).toBe(45);
  });

  it("hanya menyentuh kolom interval (tak mengubah field lain)", async () => {
    store.tenants.t1.name = "Toko Sejuk";
    await updateMaintenanceInterval("t1", 60);
    expect(store.tenants.t1.name).toBe("Toko Sejuk");
    expect(store.tenants.t1.maintenanceIntervalDays).toBe(60);
  });

  it("tolak tenant yang tidak ada", async () => {
    await expect(updateMaintenanceInterval("tak-ada", 45)).rejects.toThrow();
  });
});

describe("getMaintenanceInterval", () => {
  it("mengembalikan interval tenant saat ini", async () => {
    store.tenants.t1.maintenanceIntervalDays = 45;
    await expect(getMaintenanceInterval("t1")).resolves.toBe(45);
  });

  it("tolak tenant yang tidak ada", async () => {
    await expect(getMaintenanceInterval("tak-ada")).rejects.toThrow();
  });
});
