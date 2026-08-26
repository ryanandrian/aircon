import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Uji batching reminder per-pelanggan: banyak unit due di hari sama -> 1 pesan WA.
 * Mock prisma + gateway render.
 */
const state: {
  reminders: any[];
  assets: any[];
  messageLogs: any[];
  templates: any[];
} = { reminders: [], assets: [], messageLogs: [], templates: [] };

vi.mock("@/lib/prisma", () => ({
  prisma: {
    repeatReminder: {
      findMany: vi.fn(async ({ where }: any) => {
        return state.reminders.filter(
          (r) => where.id.in.includes(r.id) && r.tenantId === where.tenantId && r.status === where.status,
        );
      }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        let count = 0;
        for (const r of state.reminders) {
          if (where.id.in.includes(r.id) && r.tenantId === where.tenantId && r.status === where.status) {
            Object.assign(r, data);
            count++;
          }
        }
        return { count };
      }),
      findFirst: vi.fn(async ({ where }: any) => state.reminders.find((r) => r.id === where.id && r.tenantId === where.tenantId) ?? null),
    },
    asset: {
      findMany: vi.fn(async ({ where }: any) =>
        state.assets.filter((a) => where.id.in.includes(a.id) && a.tenantId === where.tenantId),
      ),
      findUnique: vi.fn(async ({ where }: any) => state.assets.find((a) => a.id === where.id) ?? null),
    },
    tenant: { findUnique: vi.fn(async () => ({ id: "t1", name: "AC Jaya", waDriver: "WEB" })) },
    messageTemplate: { findUnique: vi.fn(async () => null) }, // pakai default
    messageLog: {
      create: vi.fn(async ({ data }: any) => {
        const row = { id: `msg${state.messageLogs.length + 1}`, ...data };
        state.messageLogs.push(row);
        return row;
      }),
    },
    $transaction: vi.fn(async (ops: any[]) => Promise.all(ops)),
  },
}));

vi.mock("@/lib/wa/gateway", () => ({
  renderTemplate: (tpl: string, vars: Record<string, string>) => tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? ""),
  normalizePhone: (p: string) => p,
}));

import { sendCustomerReminderWa } from "../src/lib/services/reminder-service";

beforeEach(() => {
  state.reminders = [
    { id: "r1", tenantId: "t1", assetId: "a1", status: "QUEUED" },
    { id: "r2", tenantId: "t1", assetId: "a2", status: "QUEUED" },
    { id: "r3", tenantId: "t1", assetId: "a3", status: "QUEUED" },
  ];
  state.assets = [
    { id: "a1", tenantId: "t1", customerId: "c1", brand: "Daikin", roomLocation: "Ruang Tamu", customer: { id: "c1", name: "PT Sejuk", phone: "628111" } },
    { id: "a2", tenantId: "t1", customerId: "c1", brand: "LG", roomLocation: "Kantor", customer: { id: "c1", name: "PT Sejuk", phone: "628111" } },
    { id: "a3", tenantId: "t1", customerId: "c1", brand: "Panasonic", roomLocation: "Gudang", customer: { id: "c1", name: "PT Sejuk", phone: "628111" } },
  ];
  state.messageLogs = [];
});

describe("reminder batching per pelanggan", () => {
  it("3 unit due -> 1 pesan WA (bukan 3)", async () => {
    const res = await sendCustomerReminderWa("t1", "c1", ["r1", "r2", "r3"]);
    expect(res?.count).toBe(3);
    expect(state.messageLogs).toHaveLength(1); // hanya 1 pesan
    const body = state.messageLogs[0].body;
    expect(body).toContain("3 unit");
    expect(body).toContain("Daikin Ruang Tamu");
    expect(body).toContain("LG Kantor");
    expect(body).toContain("Panasonic Gudang");
    expect(state.messageLogs[0].templateKey).toBe("reminder_multi");
  });

  it("semua reminder di grup ditandai SENT", async () => {
    await sendCustomerReminderWa("t1", "c1", ["r1", "r2", "r3"]);
    expect(state.reminders.every((r) => r.status === "SENT")).toBe(true);
  });

  it("1 unit due -> pakai template reminder tunggal", async () => {
    const res = await sendCustomerReminderWa("t1", "c1", ["r1"]);
    expect(res?.count).toBe(1);
    expect(state.messageLogs[0].templateKey).toBe("reminder");
    expect(state.messageLogs[0].body).toContain("Daikin Ruang Tamu");
  });
});
