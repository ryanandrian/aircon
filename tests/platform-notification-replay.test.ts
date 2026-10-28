import { describe, it, expect, vi, beforeEach } from "vitest";

// REGRESSION (F3 / G30): replay manual harus TENANT-SCOPED, permission-checked
// (server action), dan AUDIT-LOGGED. Hanya status UNKNOWN/FAILED boleh di-replay;
// dedupeKey dipertahankan ⇒ tak ada duplikat ke penerima.

vi.mock("server-only", () => ({}));

const { findUnique, update, auditCreate } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  auditCreate: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    platformNotification: { findUnique, update },
    platformAuditLog: { create: auditCreate },
  },
}));

import { replayPlatformNotification } from "../src/lib/services/platform-notification-admin";

describe("replay manual notifikasi platform (G30)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    update.mockResolvedValue({});
    auditCreate.mockResolvedValue({});
  });

  it("UNKNOWN → di-antre ulang (attempts direset, lease dibersihkan) + audit log", async () => {
    findUnique.mockResolvedValue({
      id: "n1", tenantId: "t1", status: "UNKNOWN", templateKey: "wa_disconnected",
      attempts: 3, dedupeKey: "wa:t1:DISCONNECTED:1",
    });
    const r = await replayPlatformNotification("n1", "admin@x.id");
    expect(r.ok).toBe(true);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "n1" },
      data: expect.objectContaining({
        status: "QUEUED",
        attempts: 0,
        sendingAt: null,
        leaseExpiresAt: null,
      }),
    }));
    // dedupeKey TIDAK diubah → gateway idempotency sama → tak ada duplikat.
    expect(update.mock.calls[0][0].data.dedupeKey).toBeUndefined();
    expect(auditCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        actor: "admin@x.id",
        action: "PLATFORM_NOTIFICATION_REPLAY",
        target: "platform-notification:n1",
        metadata: expect.objectContaining({ tenantId: "t1", fromStatus: "UNKNOWN" }),
      }),
    }));
  });

  it("FAILED → boleh di-replay", async () => {
    findUnique.mockResolvedValue({
      id: "n2", tenantId: "t1", status: "FAILED", templateKey: "subscription_due",
      attempts: 3, dedupeKey: "k2",
    });
    expect((await replayPlatformNotification("n2", "admin@x.id")).ok).toBe(true);
    expect(auditCreate).toHaveBeenCalled();
  });

  it("SENT/DELIVERED → DITOLAK (sudah sampai; replay = duplikat)", async () => {
    for (const status of ["SENT", "DELIVERED", "READ_CONFIRMED"]) {
      findUnique.mockResolvedValue({ id: "n3", tenantId: "t1", status, templateKey: "x", attempts: 1, dedupeKey: "k" });
      const r = await replayPlatformNotification("n3", "admin@x.id");
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toContain("tidak boleh di-replay");
    }
    expect(update).not.toHaveBeenCalled();
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it("baris tak ditemukan → error jelas", async () => {
    findUnique.mockResolvedValue(null);
    const r = await replayPlatformNotification("nope", "admin@x.id");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("tidak ditemukan");
  });
});
