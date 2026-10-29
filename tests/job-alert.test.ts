import { describe, it, expect, vi, beforeEach } from "vitest";

// REGRESSION (F3/G21/G30/F6 — alert kegagalan job tak boleh hilang diam-diam).
//
//  - Jejak PASTI: `PlatformAuditLog` (kanal ke admin platform yang dijamin ada).
//  - Email ke admin platform aktif: opsional, sekali per (job, tahap, hari).
//  - Anti-spam: alert kedua pada hari yang sama TAK menambah jejak/email.
//  - Kegagalan alert sendiri TIDAK melempar (job yang gagal tak boleh jatuh
//    karena alert-nya gagal).
//  - TIDAK memakai `PlatformNotification`: CHECK constraint mewajibkan tepat
//    satu target (tenant/agent/reseller) — alert internal tak punya penerima.

vi.mock("server-only", () => ({}));

const {
  auditFindFirst, auditCreate, adminFindMany, notifCreate,
} = vi.hoisted(() => ({
  auditFindFirst: vi.fn(),
  auditCreate: vi.fn(),
  adminFindMany: vi.fn(),
  notifCreate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    platformAuditLog: { findFirst: auditFindFirst, create: auditCreate },
    platformAdmin: { findMany: adminFindMany },
    platformNotification: { create: notifCreate },
  },
}));

const sendEmail = vi.hoisted(() => vi.fn());
vi.mock("@/lib/email/smtp", () => ({
  sendEmail,
  isEmailConfigured: () => true,
}));

import { alertJobFailure } from "../src/lib/services/job-alert-service";

describe("alert kegagalan job (F3/G21/G30)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auditFindFirst.mockResolvedValue(null);
    auditCreate.mockResolvedValue({ id: "a1" });
    adminFindMany.mockResolvedValue([{ email: "ops@example.com" }, { email: "ops2@example.com" }]);
    sendEmail.mockResolvedValue({ ok: true, messageId: "m1" });
  });

  it("kegagalan → jejak audit TERTULIS (kanal pasti)", async () => {
    const r = await alertJobFailure({ job: "dunning", stage: "purge", error: "db down" });
    expect(r.audited).toBe(true);
    expect(auditCreate).toHaveBeenCalledTimes(1);
    const arg = auditCreate.mock.calls[0][0].data;
    expect(arg.action).toBe("JOB_FAILURE_ALERT");
    expect(arg.target).toContain("job-failure:dunning:purge:");
    expect(arg.metadata.error).toBe("db down");
  });

  it("email terkirim ke SEMUA admin platform aktif", async () => {
    const r = await alertJobFailure({ job: "dunning", stage: "purge", error: "db down" });
    expect(r.emailed).toBe(2);
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(sendEmail.mock.calls[0][0]).toBe("ops@example.com");
    expect(String(sendEmail.mock.calls[0][1])).toContain("dunning");
  });

  it("ANTI-SPAM: alert kedua hari yang sama tak menambah jejak/email", async () => {
    // Sudah ada baris audit untuk (job, tahap, hari) → tak ada alert baru.
    auditFindFirst.mockResolvedValue({ id: "a-older" });
    const r = await alertJobFailure({ job: "dunning", stage: "purge", error: "db down" });
    expect(auditCreate).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(r.emailed).toBe(0);
    // Jejak tetap dianggap ada (operator tetap bisa melihat).
    expect(r.audited).toBe(true);
  });

  it("TIDAK membuat baris PlatformNotification (CHECK constraint target)", async () => {
    await alertJobFailure({ job: "dunning", stage: "purge", error: "db down" });
    expect(notifCreate).not.toHaveBeenCalled();
  });

  it("kegagalan alert sendiri TIDAK melempar (job tetap jalan)", async () => {
    auditCreate.mockRejectedValue(new Error("audit down"));
    adminFindMany.mockRejectedValue(new Error("admin down"));
    const r = await alertJobFailure({ job: "dunning", stage: "purge", error: "db down" });
    expect(r.audited).toBe(false);
    expect(r.problems.length).toBeGreaterThan(0);
  });

  it("error panjang dipotong (aman disimpan)", async () => {
    await alertJobFailure({ job: "dunning", stage: "purge", error: "x".repeat(5000) });
    const stored = auditCreate.mock.calls[0][0].data.metadata.error as string;
    expect(stored.length).toBeLessThanOrEqual(500);
  });

  it("email gagal tak menggagalkan jejak audit", async () => {
    sendEmail.mockResolvedValue({ ok: false, error: "smtp down" });
    const r = await alertJobFailure({ job: "dunning", stage: "purge", error: "db down" });
    expect(r.audited).toBe(true);
    expect(r.emailed).toBe(0);
    expect(r.problems.join(" ")).toContain("smtp down");
  });
});
