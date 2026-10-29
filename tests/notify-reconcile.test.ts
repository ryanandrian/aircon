import { describe, it, expect, vi, beforeEach } from "vitest";

// REGRESSION (G29 — reconcile tool: cari pesan yang hilang/tak sengaja).
//
//  - READ-ONLY: tak ada create/update/delete saat rekonsiliasi.
//  - Menemukan: antrean menua, tenant menunggak TANPA pengingat terkirim,
//    sesi WA aktif tanpa nomor owner.
//  - Statistik antrean (queued/sending/unknown/suppressed/failed7d) akurat.

vi.mock("server-only", () => ({}));

const {
  mlGroupBy, pnGroupBy, mlCount, pnCount, mlFindMany, tenantFindMany,
} = vi.hoisted(() => ({
  mlGroupBy: vi.fn(), pnGroupBy: vi.fn(), mlCount: vi.fn(), pnCount: vi.fn(),
  mlFindMany: vi.fn(), tenantFindMany: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    messageLog: { groupBy: mlGroupBy, count: mlCount, findMany: mlFindMany },
    platformNotification: { groupBy: pnGroupBy, count: pnCount },
    tenant: { findMany: tenantFindMany },
  },
}));

import { runNotificationReconcile } from "../src/lib/services/notify-reconcile-service";

describe("G29 — reconcile tool (read-only)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mlGroupBy.mockResolvedValue([
      { status: "QUEUED", _count: { _all: 3 } },
      { status: "SENDING", _count: { _all: 1 } },
      { status: "UNKNOWN", _count: { _all: 2 } },
      { status: "SUPPRESSED", _count: { _all: 4 } },
      { status: "FAILED", _count: { _all: 9 } },
    ]);
    pnGroupBy.mockResolvedValue([
      { status: "SENT", _count: { _all: 42 } },
      { status: "UNKNOWN", _count: { _all: 1 } },
      { status: "SUPPRESSED", _count: { _all: 2 } },
    ]);
    mlCount.mockResolvedValue(3); // failed 7 hari
    pnCount.mockResolvedValue(0);
    mlFindMany.mockResolvedValue([]);
    tenantFindMany.mockResolvedValue([]);
  });

  it("statistik antrean akurat (termasuk unknown & suppressed)", async () => {
    const r = await runNotificationReconcile();
    expect(r.stats.messageLog.queued).toBe(3);
    expect(r.stats.messageLog.sending).toBe(1);
    expect(r.stats.messageLog.unknown).toBe(2);
    expect(r.stats.messageLog.suppressed).toBe(4);
    expect(r.stats.messageLog.failed7d).toBe(3);
    expect(r.stats.messageLog.sent).toBe(0);
    expect(r.stats.messageLog.delivered).toBe(0);
    expect(r.stats.messageLog.read).toBe(0);
    expect(r.stats.platformNotification.sent).toBe(42);
    expect(r.stats.platformNotification.delivered).toBe(0);
    expect(r.stats.platformNotification.read).toBe(0);
    expect(r.stats.platformNotification.unknown).toBe(1);
    expect(r.stats.platformNotification.suppressed).toBe(2);
  });

  it("bersih → ok=true, tanpa temuan", async () => {
    const r = await runNotificationReconcile();
    expect(r.ok).toBe(true);
    expect(r.findings).toHaveLength(0);
  });

  it("antrean menua → temuan stale_queued", async () => {
    mlFindMany.mockResolvedValue([{ tenantId: "t1", at: new Date() }]);
    const r = await runNotificationReconcile();
    expect(r.ok).toBe(false);
    expect(r.findings.some((f) => f.kind === "stale_queued")).toBe(true);
  });

  it("tenant menunggak tanpa pengingat → temuan past_due_no_reminder", async () => {
    tenantFindMany.mockResolvedValueOnce([
      { id: "t9", name: "CV Telat", nextDueDate: new Date("2026-10-01") },
    ]);
    // mlCount dipanggil 2x: (1) failed 7 hari, (2) jumlah pengingat terkirim.
    mlCount.mockResolvedValueOnce(3).mockResolvedValueOnce(0); // tak ada pengingat terkirim
    const r = await runNotificationReconcile();
    const f = r.findings.find((x) => x.kind === "past_due_no_reminder");
    expect(f).toBeTruthy();
    expect(f?.tenantName).toBe("CV Telat");
  });

  it("tenant menunggak YANG SUDAH dikirimi pengingat → tak ada temuan", async () => {
    tenantFindMany.mockResolvedValueOnce([
      { id: "t9", name: "CV Sudah Dikirim", nextDueDate: new Date("2026-10-01") },
    ]);
    mlCount.mockResolvedValueOnce(3).mockResolvedValueOnce(5); // ada pengingat terkirim
    const r = await runNotificationReconcile();
    expect(r.findings.some((x) => x.kind === "past_due_no_reminder")).toBe(false);
  });

  it("sesi WA aktif tanpa nomor owner → temuan wa_connected_no_phone", async () => {
    tenantFindMany.mockResolvedValueOnce([]);
    tenantFindMany.mockResolvedValueOnce([
      { id: "t8", name: "WA Tanpa Nomor" },
    ]);
    const r = await runNotificationReconcile();
    expect(r.findings.some((f) => f.kind === "wa_connected_no_phone")).toBe(true);
  });

  it("READ-ONLY: tak ada create/update/delete", async () => {
    const mod = await import("@/lib/prisma");
    const prisma = mod.prisma as unknown as Record<string, unknown>;
    for (const tbl of ["messageLog", "platformNotification", "tenant"]) {
      const obj = prisma[tbl] as Record<string, unknown>;
      expect(obj.create).toBeUndefined();
      expect(obj.update).toBeUndefined();
      expect(obj.delete).toBeUndefined();
      expect(obj.updateMany).toBeUndefined();
    }
  });
});