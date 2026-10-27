import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const { tenantFindUnique, tenantUpdateMany, platformNotificationFindFirst, platformNotificationUpdateMany, messageLogFindFirst, messageLogUpdateMany, notifyPlatform, isAutoReminderPlan } = vi.hoisted(() => ({
  tenantFindUnique: vi.fn(),
  tenantUpdateMany: vi.fn(),
  platformNotificationFindFirst: vi.fn(),
  platformNotificationUpdateMany: vi.fn(),
  messageLogFindFirst: vi.fn(),
  messageLogUpdateMany: vi.fn(),
  notifyPlatform: vi.fn(),
  isAutoReminderPlan: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    tenant: { findUnique: tenantFindUnique, updateMany: tenantUpdateMany },
    platformNotification: { findFirst: platformNotificationFindFirst, updateMany: platformNotificationUpdateMany },
    messageLog: { findFirst: messageLogFindFirst, updateMany: messageLogUpdateMany },
  },
}));
vi.mock("@/lib/services/infra-config-service", () => ({ getInfraSecrets: vi.fn(async () => ({ callbackSecret: "secret" })) }));
vi.mock("@/lib/services/platform-notification-service", () => ({
  notifyPlatform,
  isAutoReminderPlan,
}));

import { POST } from "../src/app/api/wa/callback/route";
import { NextRequest } from "next/server";

const req = (payload: unknown) => new NextRequest("https://app.airconet.id/api/wa/callback", {
  method: "POST",
  headers: { "content-type": "application/json", "x-callback-secret": "secret" },
  body: JSON.stringify(payload),
});

describe("WA disconnected notification eligibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tenantFindUnique.mockResolvedValue({ plan: "TRIAL", waSessionEpoch: 0 });
    tenantUpdateMany.mockResolvedValue({ count: 1 });
    isAutoReminderPlan.mockResolvedValue(false);
    notifyPlatform.mockResolvedValue({ created: 1, skipped: [] });
    messageLogFindFirst.mockResolvedValue(null);
    messageLogUpdateMany.mockResolvedValue({ count: 0 });
    platformNotificationFindFirst.mockResolvedValue(null);
    platformNotificationUpdateMany.mockResolvedValue({ count: 0 });
  });

  it("Basic/TRIAL tidak menerima wa_disconnected", async () => {
    const res = await POST(req({ type: "disconnected", externalId: "tenant-basic" }));
    expect(res.status).toBe(200);
    expect(notifyPlatform).not.toHaveBeenCalled();
  });

  it("paket autoReminder=false tidak menerima wa_disconnected", async () => {
    tenantFindUnique.mockResolvedValue({ plan: "PROFESSIONAL", waSessionEpoch: 0 });
    isAutoReminderPlan.mockResolvedValue(false);
    const res = await POST(req({ type: "disconnected", externalId: "tenant-locked" }));
    expect(res.status).toBe(200);
    expect(notifyPlatform).not.toHaveBeenCalled();
  });

  it("paket autoReminder=true menerima satu notifikasi disconnect per transisi", async () => {
    tenantFindUnique.mockResolvedValue({ plan: "PROFESSIONAL", waSessionEpoch: 0 });
    isAutoReminderPlan.mockResolvedValue(true);
    const res = await POST(req({ type: "disconnected", externalId: "tenant-pro" }));
    expect(res.status).toBe(200);
    expect(notifyPlatform).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: "tenant-pro",
      templateKey: "wa_disconnected",
      dedupeKey: "wa:tenant-pro:DISCONNECTED:1",
    }));
    // Kenaikan epoch tercatat (satu sumber state untuk dedupe transisi).
    expect(tenantUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { waSessionEpoch: 1 },
    }));
  });

  it("paket autoReminder=true menerima notif tersambung saat sesi ready", async () => {
    tenantFindUnique.mockResolvedValue({ plan: "PROFESSIONAL", waSessionEpoch: 1 });
    isAutoReminderPlan.mockResolvedValue(true);
    const res = await POST(req({ type: "ready", externalId: "tenant-pro" }));
    expect(res.status).toBe(200);
    expect(notifyPlatform).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: "tenant-pro",
      templateKey: "wa_connected",
      dedupeKey: "wa:tenant-pro:CONNECTED:2",
    }));
  });

  it("sesi Lumite platform tidak memicu notif tenant disconnect", async () => {
    const res = await POST(req({ type: "disconnected", externalId: "lumite-platform" }));
    expect(res.status).toBe(200);
    expect(notifyPlatform).not.toHaveBeenCalled();
  });
});
