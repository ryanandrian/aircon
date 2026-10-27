import { describe, it, expect, vi, beforeEach } from "vitest";
import { TenantPlan } from "@prisma/client";

// REGRESSION (audit 2026-10-26):
// 1) Pesan sambutan harus dipilih dari PAKET (PlanConfig.autoReminder), bukan dari
//    satu copy yang sama untuk semua. Basic (autoReminder=false) tidak boleh
//    menerima ajakan "sambungkan WhatsApp" / janji pengiriman otomatis.
// 2) Notifikasi WA terputus hanya boleh dikirim ke paket yang mengizinkan otomasi.

vi.mock("server-only", () => ({}));

const { tenantFindUnique, planConfigFindUnique, userFindFirst, platformNotificationCreate } = vi.hoisted(() => ({
  tenantFindUnique: vi.fn(),
  planConfigFindUnique: vi.fn(),
  userFindFirst: vi.fn(),
  platformNotificationCreate: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    tenant: { findUnique: tenantFindUnique },
    planConfig: { findUnique: planConfigFindUnique },
    user: { findFirst: userFindFirst },
    platformNotification: { create: platformNotificationCreate },
  },
}));

import {
  notifyPlatform,
  resolveWelcomeTemplateKey,
  isAutoReminderPlan,
} from "../src/lib/services/platform-notification-service";

describe("template welcome dipilih dari paket", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tenantFindUnique.mockResolvedValue({ id: "t1", name: "AC Jaya", phone: "6281234567890", plan: TenantPlan.TRIAL });
    planConfigFindUnique.mockResolvedValue({ displayName: "Basic", autoReminder: false });
    userFindFirst.mockResolvedValue({ email: "owner@example.com", phone: "6281234567890" });
    platformNotificationCreate.mockResolvedValue({});
  });

  it("Basic (autoReminder=false) → welcome_basic, tanpa ajakan sambung WA", async () => {
    expect(await resolveWelcomeTemplateKey("t1")).toBe("welcome_basic");
    const r = await notifyPlatform({ tenantId: "t1", templateKey: null, channels: ["EMAIL"] });
    expect(r.created).toBe(1);
    const body = platformNotificationCreate.mock.calls[0][0].data.body as string;
    expect(body).toContain("gratis selamanya");
    expect(body).toContain("manual");
    expect(body).not.toMatch(/sambungkan nomor WhatsApp/i);
  });

  it("Paket berbayar (autoReminder=true) → welcome_paid, memandu sambung WA", async () => {
    planConfigFindUnique.mockResolvedValue({ displayName: "Professional", autoReminder: true });
    tenantFindUnique.mockResolvedValue({ id: "t2", name: "AC Jaya", phone: "6281234567890", plan: TenantPlan.PROFESSIONAL });
    expect(await resolveWelcomeTemplateKey("t2")).toBe("welcome_paid");
    await notifyPlatform({ tenantId: "t2", templateKey: null, channels: ["EMAIL"] });
    const body = platformNotificationCreate.mock.calls[0][0].data.body as string;
    expect(body).toContain("Professional");
    expect(body).toMatch(/sambungkan nomor WhatsApp/i);
  });

  it("Paket tanpa PlanConfig → dianggap tanpa otomasi (fail-safe ke welcome_basic)", async () => {
    planConfigFindUnique.mockResolvedValue(null);
    expect(await resolveWelcomeTemplateKey("t1")).toBe("welcome_basic");
    expect(await isAutoReminderPlan(TenantPlan.TRIAL)).toBe(false);
  });
});

describe("notifyPlatform tidak mengirim copy rusak", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tenantFindUnique.mockResolvedValue({ id: "t1", name: "AC Jaya", phone: "6281234567890", plan: TenantPlan.PROFESSIONAL });
    planConfigFindUnique.mockResolvedValue({ displayName: "Professional", autoReminder: true });
    userFindFirst.mockResolvedValue({ email: "owner@example.com", phone: "6281234567890" });
    platformNotificationCreate.mockResolvedValue({});
  });

  it("menolak antre bila placeholder wajib tidak terisi (tidak ada pesan setengah jadi)", async () => {
    const r = await notifyPlatform({
      tenantId: "t1",
      templateKey: "subscription_due",
      channels: ["EMAIL"],
      vars: { tanggal: "1 Oktober 2026" }, // paket & nominal sengaja kosong
    });
    expect(r.created).toBe(0);
    expect(r.skipped.join(" ")).toMatch(/paket|nominal/);
    expect(platformNotificationCreate).not.toHaveBeenCalled();
  });

  it("mengganti link default per template (paid → pengaturan, billing → langganan)", async () => {
    await notifyPlatform({ tenantId: "t1", templateKey: "welcome_paid", channels: ["EMAIL"] });
    const paidBody = platformNotificationCreate.mock.calls[0][0].data.body as string;
    expect(paidBody).toContain("/app/pengaturan");

    platformNotificationCreate.mockClear();
    await notifyPlatform({
      tenantId: "t1",
      templateKey: "subscription_due",
      channels: ["EMAIL"],
      vars: { paket: "Professional", nominal: "Rp149.000", tanggal: "1 Oktober 2026" },
    });
    const billingBody = platformNotificationCreate.mock.calls[0][0].data.body as string;
    expect(billingBody).toContain("/app/langganan");
  });
});
