import { describe, it, expect, vi, beforeEach } from "vitest";

// REGRESSION (audit 2026-10-28, F2): cron dunning harus TERISOLASI per tahap.
// Sebelumnya semua tahap dalam SATU try — exception di dunning melewatkan purge,
// dispatch WA, dan platform notify hari itu diam-diam (G21: kegagalan tanpa jejak).

vi.mock("server-only", () => ({}));

const { runDunningCycle, purgeMarkedTenants, runInactivitySweep, flushQueuedMessages, runPlatformNotifyCycle, dispatchPlatformNotifications } = vi.hoisted(() => ({
  runDunningCycle: vi.fn(),
  purgeMarkedTenants: vi.fn(),
  runInactivitySweep: vi.fn(),
  flushQueuedMessages: vi.fn(),
  runPlatformNotifyCycle: vi.fn(),
  dispatchPlatformNotifications: vi.fn(),
}));
vi.mock("@/lib/services/dunning-service", () => ({ runDunningCycle, purgeMarkedTenants }));
vi.mock("@/lib/services/inactivity-sweeper-service", () => ({ runInactivitySweep }));
vi.mock("@/lib/services/message-dispatch-service", () => ({ flushQueuedMessages }));
vi.mock("@/lib/services/platform-notify-cycle", () => ({ runPlatformNotifyCycle }));
vi.mock("@/lib/services/platform-notification-dispatch", () => ({ dispatchPlatformNotifications }));

import { POST, GET } from "../src/app/api/cron/dunning/route";
import { NextRequest } from "next/server";

const AUTH = { "content-type": "application/json", authorization: "Bearer cron-secret" };
const req = (headers: Record<string, string>) =>
  new NextRequest("http://127.0.0.1:3000/api/cron/dunning", { method: "POST", headers, body: "{}" });

describe("cron dunning — tahap terisolasi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", "cron-secret");
    runDunningCycle.mockResolvedValue({ checked: 1, remindersSent: 1 });
    purgeMarkedTenants.mockResolvedValue({ purged: 0 });
    runInactivitySweep.mockResolvedValue({ skipped: 5 });
    flushQueuedMessages.mockResolvedValue({ sent: 1, failed: 0 });
    runPlatformNotifyCycle.mockResolvedValue({ due: 0, overdue: 0, skippedFreePlan: 5, queued: 0 });
    dispatchPlatformNotifications.mockResolvedValue({ sent: 0, failed: 0, skipped: 0 });
  });

  it("semua tahap sukses → 200, ok=true, hasil tiap tahap ikut dirender", async () => {
    const res = await POST(req(AUTH));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.failed).toEqual([]);
    expect(body.dunning).toEqual({ checked: 1, remindersSent: 1 });
    expect(body.platformDispatch).toEqual({ sent: 0, failed: 0, skipped: 0 });
    expect(runPlatformNotifyCycle).toHaveBeenCalled();
  });

  // Kegagalan dunning TIDAK boleh melewatkan purge/dispatch/platform notify.
  it("dunning gagal → tahap lain tetap jalan; 500 + failed tercatat", async () => {
    runDunningCycle.mockRejectedValue(new Error("db timeout"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(req(AUTH));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.failed).toEqual(["dunning"]);
    expect(body.dunning).toEqual({ error: "db timeout" });
    // TAHAP LAIN TETAP BERJALAN (inti perbaikan).
    expect(purgeMarkedTenants).toHaveBeenCalled();
    expect(runPlatformNotifyCycle).toHaveBeenCalled();
    expect(flushQueuedMessages).toHaveBeenCalled();
    expect(dispatchPlatformNotifications).toHaveBeenCalled();
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it("kegagalan bertumpuk → daftar semua tahap gagal, yang sukses tetap bernilai", async () => {
    runDunningCycle.mockRejectedValue(new Error("dunning down"));
    flushQueuedMessages.mockRejectedValue(new Error("gateway down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(req(AUTH));
    const body = await res.json();
    expect(body.failed).toEqual(["dunning", "dispatch"]);
    expect(body.purge).toEqual({ purged: 0 });
    expect(body.platformNotify).toBeDefined();
    vi.restoreAllMocks();
  });

  it("tanpa secret → 401 dan tidak ada tahap yang dijalankan", async () => {
    const res = await POST(req({ "content-type": "application/json" }));
    expect(res.status).toBe(401);
    expect(runDunningCycle).not.toHaveBeenCalled();
  });

  it("GET sama dengan POST (dipakai Vercel Cron)", async () => {
    const res = await GET(new NextRequest("http://127.0.0.1:3000/api/cron/dunning", { method: "GET", headers: AUTH }));
    expect(res.status).toBe(200);
    expect(runDunningCycle).toHaveBeenCalled();
  });
});
