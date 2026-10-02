import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Fitur: jarak kirim pengingat (reminderLeadDays) — default 3 hari sebelum H,
 * dikonfigurasi PER TENANT (bukan global), dengan UI di Pengaturan.
 * Sebelumnya: kolom ada di Tenant, default 7, TIDAK PUNYA UI sama sekali (bug FE).
 */

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

import { tenantReminderLeadSchema } from "../src/lib/validation/tenant-profile";
import { getReminderLeadDays, updateReminderLeadDays } from "../src/lib/services/tenant-profile-service";

beforeEach(() => {
  store.tenants = { t1: { id: "t1", reminderLeadDays: 3 } };
});

describe("tenantReminderLeadSchema", () => {
  it("menerima 0 (kirim pas hari H)", () => {
    expect(tenantReminderLeadSchema.safeParse({ reminderLeadDays: 0 }).success).toBe(true);
  });

  it("menerima hari positif dalam batas wajar", () => {
    expect(tenantReminderLeadSchema.safeParse({ reminderLeadDays: 3 }).success).toBe(true);
    expect(tenantReminderLeadSchema.safeParse({ reminderLeadDays: 30 }).success).toBe(true);
  });

  it("menolak negatif", () => {
    expect(tenantReminderLeadSchema.safeParse({ reminderLeadDays: -1 }).success).toBe(false);
  });

  it("menolak non-bulat", () => {
    expect(tenantReminderLeadSchema.safeParse({ reminderLeadDays: 2.5 }).success).toBe(false);
  });

  it("menolak di luar batas wajar (>90 hari)", () => {
    expect(tenantReminderLeadSchema.safeParse({ reminderLeadDays: 91 }).success).toBe(false);
  });
});

describe("getReminderLeadDays / updateReminderLeadDays", () => {
  it("membaca nilai milik tenant", async () => {
    store.tenants.t1.reminderLeadDays = 7;
    await expect(getReminderLeadDays("t1")).resolves.toBe(7);
  });

  it("menulis nilai baru (whitelist 1 kolom)", async () => {
    store.tenants.t1.name = "Toko Sejuk";
    await updateReminderLeadDays("t1", 3);
    expect(store.tenants.t1.reminderLeadDays).toBe(3);
    expect(store.tenants.t1.name).toBe("Toko Sejuk");
  });

  it("tolak nilai di luar validasi", async () => {
    await expect(updateReminderLeadDays("t1", 999)).rejects.toThrow();
    expect(store.tenants.t1.reminderLeadDays).toBe(3); // tidak berubah
  });

  it("tolak tenant yang tidak ada", async () => {
    await expect(getReminderLeadDays("tak-ada")).rejects.toThrow();
  });
});

describe("default schema = 3 (tenant baru)", () => {
  it("REPEAT_DEFAULTS.reminderLeadDays harus 3", async () => {
    const { REPEAT_DEFAULTS } = await import("../src/lib/domain/money-loop");
    expect(REPEAT_DEFAULTS.reminderLeadDays).toBe(3);
  });
});
