import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * REGRESSION — F3/G21/G30/F6: operator must be able to see job alert evidence
 * in Admin → Notifikasi (read-only), and email delivery status must be
 * reconciled against the separate delivered marker.
 */
vi.mock("server-only", () => ({}));
const { auditFindFirst, auditFindMany, auditCreate, adminFindMany } = vi.hoisted(() => ({
  auditFindFirst: vi.fn(),
  auditFindMany: vi.fn(),
  auditCreate: vi.fn(),
  adminFindMany: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    platformAuditLog: { findFirst: auditFindFirst, findMany: auditFindMany, create: auditCreate },
    platformAdmin: { findMany: adminFindMany },
    platformNotification: { count: vi.fn(), create: vi.fn() },
    messageLog: { count: vi.fn() },
  },
}));
const sendEmail = vi.hoisted(() => vi.fn());
vi.mock("@/lib/email/smtp", () => ({ sendEmail, isEmailConfigured: () => true }));

import { listJobAlerts } from "../src/lib/services/job-alert-service";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Admin job alert log — read-only visibility", () => {
  it("lists job/stale alerts and joins email-delivered markers", async () => {
    auditFindMany
      .mockResolvedValueOnce([
        {
          id: "a1",
          actor: "system:job-alert",
          action: "JOB_FAILURE_ALERT",
          target: "job-failure:dunning:purge:2026-10-29",
          metadata: { job: "dunning", stage: "purge", error: "db down" },
          createdAt: new Date("2026-10-29T03:16:41Z"),
        },
        {
          id: "a2",
          actor: "system:job-alert",
          action: "STALE_NOTIFICATION_QUEUE_ALERT",
          target: "stale-notification-queues:2026-10-29",
          metadata: { staleQueued: 3 },
          createdAt: new Date("2026-10-29T04:16:41Z"),
        },
      ])
      .mockResolvedValueOnce([
        { target: "job-failure:dunning:purge:2026-10-29" },
      ]);

    const rows = await listJobAlerts(20);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      id: "a1",
      action: "JOB_FAILURE_ALERT",
      job: "dunning",
      stage: "purge",
      error: "db down",
      emailDelivered: true,
    });
    expect(rows[1]).toMatchObject({
      id: "a2",
      action: "STALE_NOTIFICATION_QUEUE_ALERT",
      error: null,
      emailDelivered: false,
    });
    expect(auditFindMany).toHaveBeenCalledTimes(2);
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it("returns empty without an unnecessary marker query", async () => {
    auditFindMany.mockResolvedValueOnce([]);
    await expect(listJobAlerts()).resolves.toEqual([]);
    expect(auditFindMany).toHaveBeenCalledTimes(1);
  });
});
