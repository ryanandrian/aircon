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
import { alertIfDunningHeartbeatMissing, jakartaDayKey, recordDunningHeartbeat } from "../src/lib/services/job-alert-service";

describe("existing-systemd-cron dead-man heartbeat (F3, no new timer)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    create.mockResolvedValue({ id: "audit" });
    findFirst.mockResolvedValue(null);
    adminFindMany.mockResolvedValue([{ email: "ops@example.test" }]);
    sendEmail.mockResolvedValue({ ok: true, messageId: "mail" });
  });

  it("hari WIB dihitung eksplisit (bukan UTC server)", () => {
    expect(jakartaDayKey(new Date("2026-10-29T18:05:00.000Z"))).toBe("2026-10-30"); // 01:05 WIB
    expect(jakartaDayKey(new Date("2026-10-29T10:16:41.000Z"))).toBe("2026-10-29"); // 17:16 WIB
  });

  it("dunning success records one WIB-day heartbeat", async () => {
    await recordDunningHeartbeat(new Date("2026-10-29T18:05:00.000Z")); // 01:05 WIB next day
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      action: "CRON_DUNNING_HEARTBEAT",
      target: "cron-heartbeat:dunning:2026-10-30",
      metadata: expect.objectContaining({ timezone: "Asia/Jakarta", outcome: "success" }),
    }) }));
  });

  // Stage failure = cron tetap JALAN. Heartbeat harus tetap ditulis supaya
  // reconcile tak salah menuduh "cron tak jalan" (duplikat alarm).
  it("dunning jalan tapi tahap gagal tetap menulis heartbeat outcome=failed", async () => {
    await recordDunningHeartbeat(new Date("2026-10-29T18:05:00.000Z"), "failed", ["dispatch"]);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      action: "CRON_DUNNING_HEARTBEAT",
      target: "cron-heartbeat:dunning:2026-10-30",
      metadata: expect.objectContaining({ outcome: "failed", failedStages: ["dispatch"] }),
    }) }));
  });

  it("before 03:00 WIB does not alert (manual early reconcile is not a no-run finding)", async () => {
    const r = await alertIfDunningHeartbeatMissing(new Date("2026-10-29T19:59:00.000Z")); // 02:59 WIB
    expect(r).toMatchObject({ missing: false, audited: false, emailed: 0 });
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("missing heartbeat after reconcile window alerts existing admin channel", async () => {
    // Monitor sudah "armed": ada heartbeat historis dari run sebelumnya.
    findFirst.mockImplementation(async ({ where }: { where: { target?: unknown } }) => {
      const target = where.target as { startsWith?: string } | string;
      if (typeof target === "string") return null;
      if (target.startsWith) return { id: "old-heartbeat" };
      return null;
    });
    const r = await alertIfDunningHeartbeatMissing(new Date("2026-10-29T20:05:00.000Z")); // 03:05 WIB
    expect(r).toMatchObject({ missing: true, audited: true, emailed: 1, reason: null });
    expect(findFirst).toHaveBeenCalledWith({ where: { target: "cron-heartbeat:dunning:2026-10-30" } });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "JOB_FAILURE_ALERT", target: expect.stringContaining("job-failure:dunning-no-run") }) }));
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  // Dedupe harian harus memakai key WIB. WIB 03:00 = UTC 20:00 hari
  // sebelumnya; bila key UTC, alert hari ini menelan alert asli besok.
  it("dedupe harian memakai key WIB (bukan key UTC)", async () => {
    findFirst.mockImplementation(async ({ where }: { where: { target?: unknown } }) => {
      const target = where.target as { startsWith?: string } | string;
      if (typeof target === "string") return null;
      if (target.startsWith) return { id: "old-heartbeat" };
      return null;
    });
    await alertIfDunningHeartbeatMissing(new Date("2026-10-29T20:05:00.000Z")); // 03:05 WIB 30 Okt
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      target: "job-failure:dunning-no-run:-:2026-10-30",
    }) }));
  });

  // Hari pertama rilis: dunning 01:00 jalan SEBELUM monitor live → tak ada
  // heartbeat historis. Tanpa armed-check, monitor menuduh cron tak jalan
  // (alert palsu nyata pada 29 Okt 2026).
  it("monitor belum pernah melihat run sukses → tak menuduh, tak kirim email", async () => {
    const r = await alertIfDunningHeartbeatMissing(new Date("2026-10-29T20:05:00.000Z"));
    expect(r).toMatchObject({ missing: true, audited: false, emailed: 0, reason: "monitor-belum-terbukti" });
    expect(create).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("existing heartbeat means no alert", async () => {
    findFirst.mockResolvedValue({ id: "heartbeat" });
    const r = await alertIfDunningHeartbeatMissing(new Date("2026-10-29T20:05:00.000Z"));
    expect(r).toMatchObject({ missing: false, audited: false, emailed: 0 });
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
