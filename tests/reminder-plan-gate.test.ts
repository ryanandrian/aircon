import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * FASE 4 modul Pengingat — gate PAKET.
 * Perintah user 2026-10-03: tenant paket TRIAL TIDAK mendapat pengingat otomatis.
 * Flag per paket: PlanConfig.autoReminder (configurable admin, bukan hardcode).
 * Runner runDueRemindersAllTenants WAJIB melewati tenant yang paketnya autoReminder=false.
 */

type Tenant = { id: string; plan: string };

const state = {
  tenants: [] as Tenant[],
  planConfigs: [] as { plan: string; autoReminder: boolean }[],
  reminders: [] as any[],
  sentBatches: [] as { tenantId: string; customerId: string; ids: string[] }[],
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    tenant: {
      findMany: vi.fn(async ({ where, select }: any) => {
        const ok = (state.tenants as any[]).filter((t) => where.status.in.includes(t.status ?? "ACTIVE"));
        return ok.map((t) => (select?.plan ? { id: t.id, plan: t.plan } : t));
      }),
    },
    planConfig: {
      findMany: vi.fn(async () => state.planConfigs),
    },
    repeatReminder: {
      findMany: vi.fn(async ({ where }: any) =>
        state.reminders.filter((r) => r.tenantId === where.tenantId && r.status === where.status),
      ),
    },
    asset: { findMany: vi.fn(async () => []) },
    messageTemplate: { findUnique: vi.fn(async () => null) },
    messageLog: { create: vi.fn(async (args: any) => ({ id: "m1", ...args.data })) },
    $transaction: vi.fn(async (ops: any[]) => Promise.all(ops)),
  },
}));

vi.mock("@/lib/wa/gateway", () => ({
  renderTemplate: (t: string) => t,
  normalizePhone: (p: string) => p,
}));
vi.mock("@/lib/services/customer-card-service", () => ({
  getOrCreateCardToken: vi.fn(async () => null),
}));
vi.mock("@/lib/unit-code/urls", () => ({ customerCardUrl: (t: string) => `https://x/${t}` }));

import { runDueRemindersAllTenants } from "../src/lib/services/reminder-service";

beforeEach(() => {
  state.tenants = [];
  state.planConfigs = [];
  state.reminders = [];
  state.sentBatches = [];
  state.tenants = [
    { id: "t-trial", plan: "TRIAL", status: "ACTIVE" } as any,
    { id: "t-pro", plan: "PROFESSIONAL", status: "ACTIVE" } as any,
  ];
  state.planConfigs = [
    { plan: "TRIAL", autoReminder: false },
    { plan: "PROFESSIONAL", autoReminder: true },
  ];
  state.reminders = [
    { id: "r-trial", tenantId: "t-trial", status: "QUEUED" },
    { id: "r-pro", tenantId: "t-pro", status: "QUEUED" },
  ];
});

describe("runDueRemindersAllTenants — gate paket autoReminder", () => {
  it("melewati tenant paket dengan autoReminder=false (Trial tanpa kirim otomatis)", async () => {
    // Karena asset.findMany kosong, grouping tidak menghasilkan pesan; yang diuji adalah
    // TENANT YANG DIPROSES. Pakai spy pada listDueReminders via repeatReminder.findMany.
    const res = await runDueRemindersAllTenants();

    // Kueri daftar tenant dipersempit ke tenant yang paketnya autoReminder=true.
    expect(res.tenants).toBe(1); // hanya PROFESSIONAL
  });

  it("tenant dengan paket tak dikenal / PlanConfig hilang = auto ON (default true)", async () => {
    state.planConfigs = []; // tak ada config sama sekali
    const res = await runDueRemindersAllTenants();
    expect(res.tenants).toBe(2);
  });

  it("semua paket auto ON -> semua tenant diproses", async () => {
    state.planConfigs = [
      { plan: "TRIAL", autoReminder: true },
      { plan: "PROFESSIONAL", autoReminder: true },
    ];
    const res = await runDueRemindersAllTenants();
    expect(res.tenants).toBe(2);
  });
});
