import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
const { admin, activeTemplate, emailSend, auditCreate } = vi.hoisted(() => ({
  admin: vi.fn(async () => ({ email: "admin@example.test" })),
  activeTemplate: vi.fn(async () => ({ key: "welcome_basic", subject: "Selamat datang di {{app}}", body: "Halo {{tenant}}! Paket gratis: {{link}}", version: 3, isDefault: false })),
  emailSend: vi.fn(async () => ({ ok: true, messageId: "test-id" })),
  auditCreate: vi.fn(async () => ({ id: "a1" })),
}));
vi.mock("@/lib/auth/platform-admin", () => ({ requirePlatformAdmin: admin }));
vi.mock("@/lib/prisma", () => ({ prisma: { platformAuditLog: { create: auditCreate } } }));
vi.mock("@/lib/services/platform-template-service", () => ({ getActiveTemplate: activeTemplate }));
vi.mock("@/lib/email/smtp", () => ({ sendEmail: emailSend, isEmailConfigured: () => true }));

import { actionTestPlatformTemplateEmail } from "../src/app/admin/notifikasi/actions";

describe("template email test-send allowlist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NOTIFICATION_TEST_EMAIL_ALLOWLIST = "qa@example.test, owner@example.test";
  });

  it("rejects recipient outside allowlist without sending or audit", async () => {
    const r = await actionTestPlatformTemplateEmail("welcome_basic", "real-customer@example.com");
    expect(r.ok).toBe(false);
    expect(emailSend).not.toHaveBeenCalled();
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it("sends only to exact allowlisted email with TEST prefix and audit record", async () => {
    const r = await actionTestPlatformTemplateEmail("welcome_basic", " QA@example.test ");
    expect(r.ok, JSON.stringify(r)).toBe(true);
    expect(emailSend).toHaveBeenCalledWith("qa@example.test", expect.stringContaining("[TEST:welcome_basic]"), expect.stringContaining("TEST TEMPLATE"));
    expect(auditCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "PLATFORM_TEMPLATE_TEST_EMAIL", metadata: expect.objectContaining({ recipient: "qa@example.test", version: 3, sent: true }) }) }));
  });

  it("invalid template variables reject before email", async () => {
    activeTemplate.mockResolvedValueOnce({ key: "welcome_basic", subject: "x", body: "bad {{unknown}} copy long enough", version: 4, isDefault: false } as never);
    const r = await actionTestPlatformTemplateEmail("welcome_basic", "qa@example.test");
    expect(r.ok).toBe(false);
    expect(emailSend).not.toHaveBeenCalled();
  });
});
