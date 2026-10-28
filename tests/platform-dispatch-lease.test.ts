import { describe, it, expect, vi, beforeEach } from "vitest";

// REGRESSION (F3 / G10): dispatcher harus RECOVERY baris SENDING yang lease-nya
// kedaluwarsa → status UNKNOWN, dan TIDAK mengirim ulang (gateway tak bisa
// memastikan hasil; kirim ulang berisiko duplikat ke pelanggan).

vi.mock("server-only", () => ({}));

const { findMany, updateMany, update, sendEmail } = vi.hoisted(() => ({
  findMany: vi.fn(),
  updateMany: vi.fn(),
  update: vi.fn(),
  sendEmail: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    platformNotification: { findMany, updateMany, update },
    messageLog: { findMany: vi.fn(async () => []), updateMany: vi.fn(), update: vi.fn() },
  },
}));
vi.mock("@/lib/wa/gateway-relay", () => ({ gatewaySendAs: vi.fn(async () => ({ ok: true, messageId: "gw" })), isGatewayConfigured: vi.fn(async () => true) }));
vi.mock("@/lib/email/smtp", () => ({ sendEmail, isEmailConfigured: vi.fn(async () => true) }));
// Kill switch (G30) — dimock agar default = boleh kirim; diuji terpisah di bawah.
const { isNotifySendEnabled } = vi.hoisted(() => ({ isNotifySendEnabled: vi.fn(async () => true) }));
vi.mock("@/lib/services/infra-config-service", () => ({ isNotifySendEnabled }));

import { dispatchPlatformNotifications } from "../src/lib/services/platform-notification-dispatch";

describe("dispatcher platform — recovery stale SENDING", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Urutan panggilan: (1) antrean QUEUED, (2) recovery stale SENDING.
    findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([
      { id: "n-stale", tenantId: "t1" },
    ]);
    update.mockResolvedValue({});
    updateMany.mockResolvedValue({ count: 0 });
    sendEmail.mockResolvedValue({ ok: true, messageId: "m1" });
  });

  it("stale SENDING → UNKNOWN, tanpa kirim", async () => {
    const r = await dispatchPlatformNotifications();
    expect(r.stale).toBe(1);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "n-stale" },
      data: expect.objectContaining({
        status: "UNKNOWN",
        sendingAt: null,
        leaseExpiresAt: null,
      }),
    }));
    // TIDAK ada pengiriman ulang untuk baris stale.
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("KILL SWITCH aktif → dispatcher MENAH: tak ada kirim, tak ada recovery stale", async () => {
    isNotifySendEnabled.mockResolvedValueOnce(false);
    findMany.mockReset();
    const r = await dispatchPlatformNotifications();
    expect(r.held).toBe(true);
    expect(r.sent).toBe(0);
    expect(r.failed).toBe(0);
    expect(r.stale).toBe(0);
    // tak ada query antrean sama sekali → pesan tetap QUEUED, tak ada yang hilang
    expect(findMany).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("tanpa baris stale → stale=0 dan tidak ada update UNKNOWN", async () => {
    findMany.mockReset();
    findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const r = await dispatchPlatformNotifications();
    expect(r.stale).toBe(0);
    expect(update).not.toHaveBeenCalled();
  });
});
