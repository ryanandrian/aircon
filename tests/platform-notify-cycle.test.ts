import { describe, it, expect, vi, beforeEach } from "vitest";
import { TenantPlan } from "@prisma/client";

// REGRESSION (audit 2026-10-26): paket Basic (TRIAL) gratis selamanya.
// Cycle tagihan TIDAK boleh mengirim pengingat jatuh tempo ke Basic, dan copy
// tagihan wajib memuat paket + nominal (sebelumnya `{{paket}}`/`{{nominal}}`
// kosong sehingga pesan kehilangan informasitagihan).

vi.mock("server-only", () => ({}));

const { tenantFindMany, tenantFindUnique, planConfigFindUnique, notifyPlatform } = vi.hoisted(() => ({
  tenantFindMany: vi.fn(),
  tenantFindUnique: vi.fn(),
  planConfigFindUnique: vi.fn(),
  notifyPlatform: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    tenant: { findMany: tenantFindMany, findUnique: tenantFindUnique },
    planConfig: { findUnique: planConfigFindUnique },
  },
}));
vi.mock("@/lib/services/platform-notification-service", () => ({ notifyPlatform }));

import { runPlatformNotifyCycle } from "../src/lib/services/platform-notify-cycle";

const now = new Date("2026-10-27T00:00:00.000Z");
const dueDate = new Date("2026-10-28T00:00:00.000Z");

describe("runPlatformNotifyCycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tenantFindMany.mockResolvedValue([]);
    tenantFindUnique.mockResolvedValue({ subscription: { amountMonthly: 149000 } });
    planConfigFindUnique.mockResolvedValue({ displayName: "Professional", priceMonthly: 149000 });
    notifyPlatform.mockResolvedValue({ created: 2, skipped: [] });
  });

  it("melewati Basic (TRIAL) walau nextDueDate terisi: tidak ada copy tagihan untuk paket gratis", async () => {
    tenantFindMany.mockResolvedValue([
      { id: "basic-1", status: "ACTIVE", plan: TenantPlan.TRIAL, nextDueDate: dueDate },
    ]);
    const result = await runPlatformNotifyCycle(now);
    expect(result.skippedFreePlan).toBe(1);
    expect(notifyPlatform).not.toHaveBeenCalled();
  });

  it("mengisi paket dan nominal untuk pengingat jatuh tempo", async () => {
    tenantFindMany.mockResolvedValue([
      { id: "pro-1", status: "ACTIVE", plan: TenantPlan.PROFESSIONAL, nextDueDate: dueDate },
    ]);
    await runPlatformNotifyCycle(now);
    expect(notifyPlatform).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: "pro-1",
      templateKey: "subscription_due",
      vars: expect.objectContaining({
        paket: "Professional",
        nominal: "Rp149.000",
        tanggal: expect.any(String),
      }),
    }));
  });

  it("memakai nilai subscription sebagai nominal tagihan berjalan", async () => {
    const past = new Date("2026-10-20T00:00:00.000Z");
    tenantFindMany.mockResolvedValue([
      { id: "pro-2", status: "PAST_DUE", plan: TenantPlan.PROFESSIONAL, nextDueDate: past },
    ]);
    tenantFindUnique.mockResolvedValue({ subscription: { amountMonthly: 139000 } });
    await runPlatformNotifyCycle(now);
    expect(notifyPlatform).toHaveBeenCalledWith(expect.objectContaining({
      templateKey: "subscription_overdue",
      vars: expect.objectContaining({ paket: "Professional", nominal: "Rp139.000" }),
    }));
  });
});
