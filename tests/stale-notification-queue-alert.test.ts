import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
const { platformCount, messageCount, auditFind, auditCreate, adminsFind, sendEmail } = vi.hoisted(() => ({
  platformCount: vi.fn(), messageCount: vi.fn(), auditFind: vi.fn(), auditCreate: vi.fn(),
  adminsFind: vi.fn(), sendEmail: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    platformNotification: { count: platformCount },
    messageLog: { count: messageCount },
    platformAuditLog: { findFirst: auditFind, findMany: vi.fn(), create: auditCreate },
    platformAdmin: { findMany: adminsFind },
  },
}));
vi.mock("@/lib/email/smtp", () => ({ sendEmail, isEmailConfigured: () => true }));

import { alertStaleNotificationQueues } from "../src/lib/services/job-alert-service";

const NOW = new Date("2026-10-29T10:00:00.000Z");

describe("stale notification queue alert (read-only; F3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    platformCount.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    messageCount.mockResolvedValue(0);
    auditFind.mockResolvedValue(null);
    auditCreate.mockResolvedValue({ id: "audit-1" });
    adminsFind.mockResolvedValue([{ email: "ops@example.com" }]);
    sendEmail.mockResolvedValue({ ok: true, messageId: "m1" });
  });

  it("healthy queues → no audit/email and zero alert", async () => {
    const r = await alertStaleNotificationQueues(NOW);
    expect(r).toMatchObject({ audited: false, emailed: 0, queueAlerts: 0, staleQueued: 0, staleSending: 0, staleMessageLogQueued: 0, staleMessageLogSending: 0 });
    expect(auditCreate).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("stale queue found → audit + email + separate delivered marker", async () => {
    platformCount.mockReset().mockResolvedValueOnce(3).mockResolvedValueOnce(1);
    messageCount.mockResolvedValueOnce(2).mockResolvedValueOnce(2);
    const r = await alertStaleNotificationQueues(NOW, 60);
    expect(r).toMatchObject({ audited: true, emailed: 1, queueAlerts: 1, staleQueued: 3, staleSending: 1, staleMessageLogQueued: 2, staleMessageLogSending: 2 });
    expect(auditCreate).toHaveBeenCalledTimes(2);
    expect(auditCreate.mock.calls[0][0].data).toMatchObject({
      action: "STALE_NOTIFICATION_QUEUE_ALERT", target: "stale-notification-queues:2026-10-29",
    });
    expect(auditCreate.mock.calls[1][0].data).toMatchObject({
      action: "STALE_NOTIFICATION_QUEUE_ALERT_EMAIL_DELIVERED",
      target: "stale-notification-queues-email-delivered:2026-10-29",
    });
    expect(sendEmail).toHaveBeenCalledWith("ops@example.com", expect.stringContaining("stale"), expect.stringContaining("3"));
    expect(platformCount).toHaveBeenCalledTimes(2);
    expect(messageCount).toHaveBeenCalledTimes(2);
  });

  it("SMTP failure ⇒ audit remains, but later same-day call retries email", async () => {
    platformCount.mockReset().mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    messageCount.mockResolvedValue(0);
    sendEmail.mockResolvedValueOnce({ ok: false, error: "smtp down" });
    const first = await alertStaleNotificationQueues(NOW);
    expect(first.audited).toBe(true);
    expect(first.emailed).toBe(0);
    expect(first.problems.join(" ")).toContain("smtp down");
    expect(auditCreate.mock.calls.map((c) => c[0].data.target)).toContain("stale-notification-queues:2026-10-29");
    expect(auditCreate.mock.calls.map((c) => c[0].data.target)).not.toContain("stale-notification-queues-email-delivered:2026-10-29");

    // Next call: log row exists, but no delivered marker ⇒ email must retry.
    platformCount.mockReset().mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    auditFind.mockImplementation(async ({ where }: { where: { target: string } }) =>
      where.target.startsWith("stale-notification-queues-email-delivered:") ? null : { id: "audit-existing" },
    );
    const second = await alertStaleNotificationQueues(NOW);
    expect(second.emailed).toBe(1);
    expect(sendEmail).toHaveBeenCalledTimes(2);
  });

  it("delivered marker exists ⇒ email not repeated (daily anti-spam)", async () => {
    platformCount.mockReset().mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    auditFind.mockImplementation(async ({ where }: { where: { target: string } }) =>
      where.target.startsWith("stale-notification-queues-email-delivered:") ? { id: "sent" } : { id: "audit" },
    );
    const r = await alertStaleNotificationQueues(NOW);
    expect(r.audited).toBe(true);
    expect(r.emailed).toBe(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("scan DB failure is contained and does not throw", async () => {
    platformCount.mockReset().mockRejectedValueOnce(new Error("db unavailable"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await alertStaleNotificationQueues(NOW);
    expect(r.audited).toBe(false);
    expect(r.problems.join(" ")).toContain("db unavailable");
    vi.restoreAllMocks();
  });

  it("stale age threshold has a safe minimum; no queue rows mutated", async () => {
    await alertStaleNotificationQueues(NOW, 0);
    const queuedWhere = platformCount.mock.calls[0][0].where;
    expect(queuedWhere.status).toBe("QUEUED");
    expect(queuedWhere.createdAt.lt.toISOString()).toBe("2026-10-29T09:55:00.000Z");
  });
});
