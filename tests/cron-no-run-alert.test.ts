import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
const { findFirst, create, adminFindMany, sendEmail } = vi.hoisted(() => ({
  findFirst: vi.fn(), create: vi.fn(), adminFindMany: vi.fn(), sendEmail: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    platformAuditLog: { findFirst, create },
    platformAdmin: { findMany: adminFindMany },
    platformNotification: { count: vi.fn() },
    messageLog: { count: vi.fn() },
  },
}));
vi.mock("@/lib/email/smtp", () => ({ sendEmail, isEmailConfigured: () => true }));
import { alertIfDunningHeartbeatMissing, recordDunningHeartbeat } from "../src/lib/services/job-alert-service";

describe("existing-systemd-cron dead-man heartbeat (F3, no new timer)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    create.mockResolvedValue({ id: "audit" });
    findFirst.mockResolvedValue(null);
    adminFindMany.mockResolvedValue([{ email: "ops@example.test" }]);
    sendEmail.mockResolvedValue({ ok: true, messageId: "mail" });
  });

  it("dunning success records one WIB-day heartbeat", async () => {
    await recordDunningHeartbeat(new Date("2026-10-29T18:05:00.000Z")); // 01:05 WIB next day
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      action: "CRON_DUNNING_HEARTBEAT",
      target: "cron-heartbeat:dunning:2026-10-30",
      metadata: expect.objectContaining({ timezone: "Asia/Jakarta" }),
    }) }));
  });

  it("before 03:00 WIB does not alert (manual early reconcile is not a no-run finding)", async () => {
    const r = await alertIfDunningHeartbeatMissing(new Date("2026-10-29T19:59:00.000Z")); // 02:59 WIB
    expect(r).toEqual({ missing: false, audited: false, emailed: 0 });
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("missing heartbeat after reconcile window alerts existing admin channel", async () => {
    const r = await alertIfDunningHeartbeatMissing(new Date("2026-10-29T20:05:00.000Z")); // 03:05 WIB
    expect(r).toMatchObject({ missing: true, audited: true, emailed: 1 });
    expect(findFirst).toHaveBeenCalledWith({ where: { target: "cron-heartbeat:dunning:2026-10-30" } });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "JOB_FAILURE_ALERT", target: expect.stringContaining("job-failure:dunning-no-run") }) }));
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("existing heartbeat means no alert", async () => {
    findFirst.mockResolvedValue({ id: "heartbeat" });
    const r = await alertIfDunningHeartbeatMissing(new Date("2026-10-29T20:05:00.000Z"));
    expect(r).toEqual({ missing: false, audited: false, emailed: 0 });
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
