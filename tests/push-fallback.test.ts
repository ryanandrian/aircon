import { describe, it, expect, vi, beforeEach } from "vitest";

// REGRESSION (G14 — fallback push saat pesan utama gagal permanen).
//
// Yang dijaga:
//  - Fallback HANYA saat gagal PERMANEN (tak akan di-retry).
//  - Transient (deferred) / duplicate / UNKNOWN → TIDAK ada fallback (nanti
//    dobel / sudah sampai / hasil tak pasti).
//  - Fallback TIDAK mengubah status baris pesan utama (tetap FAILED).
//  - Tanpa owner aktif → fallback dilewati dengan alasan (tak crash).

vi.mock("server-only", () => ({}));

const { userFindFirst, pnCreate, pnUpdate, pnUpdateMany, pnFindMany, pnGroupBy, mlFindMany, mlUpdate, mlUpdateMany } = vi.hoisted(() => ({
  userFindFirst: vi.fn(), pnCreate: vi.fn(), pnUpdate: vi.fn(), pnUpdateMany: vi.fn(),
  pnFindMany: vi.fn(), pnGroupBy: vi.fn(), mlFindMany: vi.fn(), mlUpdate: vi.fn(), mlUpdateMany: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findFirst: userFindFirst },
    platformNotification: {
      create: pnCreate, update: pnUpdate, updateMany: pnUpdateMany,
      findMany: pnFindMany, groupBy: pnGroupBy,
    },
    messageLog: { findMany: mlFindMany, update: mlUpdate, updateMany: mlUpdateMany },
  },
}));

const { gatewaySendAs, isGatewayConfigured } = vi.hoisted(() => ({
  gatewaySendAs: vi.fn(), isGatewayConfigured: vi.fn(async () => true),
}));
vi.mock("@/lib/wa/gateway-relay", () => ({
  gatewaySendAs, isGatewayConfigured, PLATFORM_WA_SESSION: "lumite-platform",
}));
vi.mock("@/lib/email/smtp", () => ({ sendEmail: vi.fn(async () => ({ ok: true })), isEmailConfigured: vi.fn(async () => true) }));
vi.mock("@/lib/services/infra-config-service", () => ({
  isNotifySendEnabled: vi.fn(async () => true), isWaSendEnabled: vi.fn(async () => true),
}));

const { sendPushToUser } = vi.hoisted(() => ({
  sendPushToUser: vi.fn(async (_input: {
    tenantId: string; userId: string;
    payload: { title: string; body: string; url?: string; tag?: string | null };
  }) => ({ sent: 1, revoked: 0, failed: 0, skipped: 0 })),
}));
vi.mock("@/lib/services/push-notification-service", () => ({ sendPushToUser }));

import { dispatchPlatformNotifications } from "../src/lib/services/platform-notification-dispatch";

const ROW = {
  id: "n1", tenantId: "t1", channel: "WA", templateKey: "subscription_due",
  toAddress: "628123456789", body: "halo", subject: null, dedupeKey: "k1", attempts: 2,
};

describe("G14 — fallback push saat gagal permanen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Query 1 = antrean (1 baris), Query 2 = recovery stale (kosong).
    pnFindMany.mockResolvedValueOnce([ROW]).mockResolvedValueOnce([]);
    pnUpdateMany.mockResolvedValue({ count: 1 });
    pnUpdate.mockResolvedValue({});
    userFindFirst.mockResolvedValue({ id: "owner-1" });
    sendPushToUser.mockResolvedValue({ sent: 1, revoked: 0, failed: 0, skipped: 0 });
    gatewaySendAs.mockResolvedValue({ ok: false, error: "nomor tidak terdaftar" });
  });

  it("gagal PERMANEN pada attempt terakhir → fallback push ke owner", async () => {
    const r = await dispatchPlatformNotifications();
    expect(r.failed).toBe(1);
    expect(sendPushToUser).toHaveBeenCalledTimes(1);
    const arg = sendPushToUser.mock.calls[0][0];
    expect(arg.tenantId).toBe("t1");
    expect(arg.userId).toBe("owner-1");
    expect(arg.payload.tag).toContain("subscription_due");
  });

  it("gagal TRANSIENT (deferred) → tak ada fallback (pesan akan dikirim ulang)", async () => {
    gatewaySendAs.mockResolvedValue({ ok: false, deferred: true, error: "batas sesi aktif tercapai" });
    const r = await dispatchPlatformNotifications();
    expect(r.failed).toBe(1);
    expect(sendPushToUser).not.toHaveBeenCalled();
  });

  it("gagal DUPLIKAT (409) → tak ada fallback (pesan sebenarnya sudah sampai)", async () => {
    gatewaySendAs.mockResolvedValue({ ok: false, duplicate: true, messageId: "gw-1", error: "duplicate" });
    const r = await dispatchPlatformNotifications();
    expect(r.sent).toBe(1);
    expect(sendPushToUser).not.toHaveBeenCalled();
  });

  it("tanpa owner aktif → fallback dilewati, pesan tetap FAILED, tak crash", async () => {
    userFindFirst.mockResolvedValue(null);
    const r = await dispatchPlatformNotifications();
    expect(r.failed).toBe(1);
    expect(sendPushToUser).not.toHaveBeenCalled();
    // status pesan utama tetap FAILED (fallback tak mengubahnya)
    const upd = pnUpdate.mock.calls[0][0];
    expect(upd.data.status).toBe("FAILED");
  });

  it("BUG FIX: transient (deferred) → kembali QUEUED, BUKAN FAILED (pesan tak hilang permanen)", async () => {
    gatewaySendAs.mockResolvedValue({ ok: false, deferred: true, error: "batas sesi aktif tercapai" });
    const r = await dispatchPlatformNotifications();
    expect(r.failed).toBe(1);
    const upd = pnUpdate.mock.calls[0][0];
    expect(upd.data.status).toBe("QUEUED");
    expect(upd.data.error).toContain("batas sesi");
    // tak ada fallback push (bakal dobel saat dikirim ulang)
    expect(sendPushToUser).not.toHaveBeenCalled();
  });

  it("push fallback yang sendiri gagal → pesan utama tetap FAILED, tak error fatal", async () => {
    sendPushToUser.mockRejectedValue(new Error("vapid invalid"));
    const r = await dispatchPlatformNotifications();
    expect(r.failed).toBe(1);
    const upd = pnUpdate.mock.calls[0][0];
    expect(upd.data.status).toBe("FAILED");
  });
});