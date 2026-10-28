import { describe, it, expect, vi, beforeEach } from "vitest";

// REGRESSION (F3 / G20): kirim manual admin harus dispatch HANYA baris yang baru
// dibuatnya. Versi lama memanggil dispatch tanpa filter → satu klik "Kirim ke
// Tenant Ini" ikut menyedot antrean milik tenant lain.

vi.mock("server-only", () => ({}));

const { findMany, updateMany, update, sendEmail, gatewaySendAs } = vi.hoisted(() => ({
  findMany: vi.fn(),
  updateMany: vi.fn(),
  update: vi.fn(),
  sendEmail: vi.fn(),
  gatewaySendAs: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    platformNotification: { findMany, updateMany, update },
    infraConfig: { findUnique: vi.fn(async () => ({ notifySendEnabled: true })) },
  },
}));
vi.mock("@/lib/wa/gateway-relay", () => ({
  gatewaySendAs,
  isGatewayConfigured: vi.fn(async () => true),
}));
vi.mock("@/lib/email/smtp", () => ({
  sendEmail,
  isEmailConfigured: vi.fn(async () => true),
}));

import { dispatchPlatformNotifications } from "../src/lib/services/platform-notification-dispatch";

describe("dispatcher platform — kirim terarah (G20)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Query 1 = antrean (dengan filter onlyIds), Query 2 = recovery stale.
    findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    updateMany.mockResolvedValue({ count: 1 });
    update.mockResolvedValue({});
    sendEmail.mockResolvedValue({ ok: true, messageId: "m1" });
    gatewaySendAs.mockResolvedValue({ ok: true, messageId: "gw1" });
  });

  it("with onlyIds → query antrean difilter id (tidak sedot global)", async () => {
    await dispatchPlatformNotifications(10, ["n-1", "n-2"]);
    const firstCall = findMany.mock.calls[0][0];
    expect(firstCall.where.id).toEqual({ in: ["n-1", "n-2"] });
    expect(firstCall.where.status).toBe("QUEUED");
    // Batas attempts TIDAK berlaku untuk kirim manual (keputusan operator).
    expect(firstCall.where.attempts).toBeUndefined();
    expect(firstCall.take).toBe(2);
  });

  it("tanpa onlyIds → antrean global dengan batas attempts", async () => {
    await dispatchPlatformNotifications();
    const firstCall = findMany.mock.calls[0][0];
    expect(firstCall.where.id).toBeUndefined();
    expect(firstCall.where.attempts).toEqual({ lt: 3 });
  });

  it("kirim terarah TIDAK menjalankan recovery stale baris lain", async () => {
    findMany.mockReset();
    findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const r = await dispatchPlatformNotifications(10, ["n-1"]);
    expect(r.stale).toBe(0);
    // Hanya 1 query (antrean) — recovery tidak dijalankan.
    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it("dispatch global menjalankan recovery stale", async () => {
    findMany.mockReset();
    findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: "n-stale", tenantId: "t1" }]);
    const r = await dispatchPlatformNotifications();
    expect(r.stale).toBe(1);
    expect(findMany).toHaveBeenCalledTimes(2);
  });
});
