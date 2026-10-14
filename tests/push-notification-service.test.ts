import { describe, it, expect, vi, beforeEach } from "vitest";

// G-A2 — push-notification-service (unit, mock prisma/context/web-push).
// Pola: vi.mock modul ber-server-only + context auth, konsisten dgn test repo
// (contoh: tests/wa-callback-inbound-noop.test.ts).

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    pushSubscription: {
      upsert: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  },
}));
vi.mock("@/lib/auth/context", () => ({
  tryGetServerContext: vi.fn().mockResolvedValue({ userId: "user-1", tenantId: "tenant-1", role: "TECHNICIAN" }),
}));
vi.mock("web-push", () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn().mockResolvedValue({ statusCode: 201 }),
  },
}));

import { prisma } from "@/lib/prisma";
import { tryGetServerContext } from "@/lib/auth/context";
import webpush from "web-push";
import {
  upsertPushSubscription,
  revokePushSubscription,
  sendPushToUser,
} from "@/lib/services/push-notification-service";

const mockCtx = vi.mocked(tryGetServerContext);
// Pola repo (service-catalog.test.ts): vi.mocked per method leaf / cast tipe mock
// prisma — vi.mocked(prisma) tidak memberi tipe Mock utk method deep.
type MockFn = ReturnType<typeof vi.fn>;
const ps = prisma.pushSubscription as unknown as {
  upsert: MockFn; findMany: MockFn; update: MockFn; updateMany: MockFn; deleteMany: MockFn;
};
const mockWebPush = vi.mocked(webpush);

const VALID_SUB = {
  endpoint: "https://fcm.googleapis.com/wp/fake-endpoint",
  keys: { p256dh: "x".repeat(80), auth: "y".repeat(30) },
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.PUSH_VAPID_PUBLIC_KEY = "pub-test";
  process.env.PUSH_VAPID_PRIVATE_KEY = "priv-test";
});

describe("upsertPushSubscription", () => {
  it("menolak bila belum masuk (context null)", async () => {
    mockCtx.mockResolvedValueOnce(null);
    const r = await upsertPushSubscription({ deviceId: "d1", subscription: VALID_SUB });
    expect(r.ok).toBe(false);
    expect(ps.upsert).not.toHaveBeenCalled();
  });

  it("menolak subscription tidak valid (tanpa https / key pendek)", async () => {
    const r1 = await upsertPushSubscription({ deviceId: "d1", subscription: { endpoint: "http://x", keys: VALID_SUB.keys } });
    const r2 = await upsertPushSubscription({ deviceId: "d1", subscription: { endpoint: VALID_SUB.endpoint, keys: { p256dh: "a", auth: "b" } } });
    expect(r1.ok).toBe(false);
    expect(r2.ok).toBe(false);
    expect(ps.upsert).not.toHaveBeenCalled();
  });

  it("menggunakan unique (tenantId,userId,deviceId) + idempoten upsert", async () => {
    const r = await upsertPushSubscription({ deviceId: "d1", subscription: VALID_SUB, userAgent: "Android" });
    expect(r.ok).toBe(true);
    expect(ps.upsert).toHaveBeenCalledTimes(1);
    const arg = ps.upsert.mock.calls[0][0];
    expect(arg.where.tenantId_userId_deviceId).toEqual({ tenantId: "tenant-1", userId: "user-1", deviceId: "d1" });
    expect(arg.create.endpoint).toBe(VALID_SUB.endpoint);
    expect(arg.create.p256dh).toBe(VALID_SUB.keys.p256dh);
    expect(arg.create.auth).toBe(VALID_SUB.keys.auth);
  });
});

describe("revokePushSubscription", () => {
  it("menandai revokedAt (bukan delete baris) untuk perangkat user tsb", async () => {
    const r = await revokePushSubscription({ deviceId: "d1" });
    expect(r.ok).toBe(true);
    expect(ps.updateMany).toHaveBeenCalledTimes(1);
    const arg = ps.updateMany.mock.calls[0][0];
    expect(arg.where.deviceId).toBe("d1");
    expect(arg.where.revokedAt).toBeNull();
    expect(arg.data.revokedAt).toBeInstanceOf(Date);
    expect(ps.deleteMany).toBeUndefined(); // nol delete — jejak audit dipertahankan
  });
});

describe("sendPushToUser", () => {
  it("skipped=1 bila VAPID belum diset (env kosong) — jujur tanpa crash", async () => {
    delete process.env.PUSH_VAPID_PUBLIC_KEY;
    const r = await sendPushToUser({ tenantId: "t", userId: "u", payload: { title: "T", body: "B" } });
    expect(r.skipped).toBe(1);
    expect(r.sent).toBe(0);
  });

  it("kirim push & update lastSentAt utk tiap subscription aktif", async () => {
    ps.findMany.mockResolvedValueOnce([
      { id: "s1", endpoint: VALID_SUB.endpoint, p256dh: "x".repeat(80), auth: "y".repeat(30) },
      { id: "s2", endpoint: VALID_SUB.endpoint + "2", p256dh: "x".repeat(80), auth: "y".repeat(30) },
    ]);
    const r = await sendPushToUser({ tenantId: "t", userId: "u", payload: { title: "Tugas baru", body: "AC bocor" } });
    expect(r.sent).toBe(2);
    expect(mockWebPush.sendNotification).toHaveBeenCalledTimes(2);
    expect(ps.update).toHaveBeenCalledTimes(2);
  });

  it("endpoint basi (404/410) → revoked (bukan delete), bukan failed", async () => {
    ps.findMany.mockResolvedValueOnce([
      { id: "s1", endpoint: VALID_SUB.endpoint, p256dh: "x".repeat(80), auth: "y".repeat(30) },
    ]);
    mockWebPush.sendNotification.mockRejectedValueOnce({ statusCode: 410 });
    const r = await sendPushToUser({ tenantId: "t", userId: "u", payload: { title: "T", body: "B" } });
    expect(r.revoked).toBe(1);
    expect(r.failed).toBe(0);
    const arg = ps.updateMany.mock.calls[0][0];
    expect(arg.where.endpoint).toBe(VALID_SUB.endpoint);
    expect(arg.data.revokedAt).toBeInstanceOf(Date);
  });

  it("gangguan tahan-lama (5xx dua kali) → failed, subscription TETAP aktif", async () => {
    ps.findMany.mockResolvedValueOnce([
      { id: "s1", endpoint: VALID_SUB.endpoint, p256dh: "x".repeat(80), auth: "y".repeat(30) },
    ]);
    mockWebPush.sendNotification.mockRejectedValue({ statusCode: 503 });
    const r = await sendPushToUser({ tenantId: "t", userId: "u", payload: { title: "T", body: "B" } });
    expect(r.failed).toBe(1);
    // 2 percobaan (retry inline 1x), TANPA revoke utk 5xx
    expect(mockWebPush.sendNotification).toHaveBeenCalledTimes(2);
    expect(ps.updateMany).not.toHaveBeenCalled();
  });

  it("5xx sesaat lalu sukses (retry inline) → sent=1, TIDAK failed", async () => {
    ps.findMany.mockResolvedValueOnce([
      { id: "s1", endpoint: VALID_SUB.endpoint, p256dh: "x".repeat(80), auth: "y".repeat(30) },
    ]);
    mockWebPush.sendNotification
      .mockRejectedValueOnce({ statusCode: 502 })
      .mockResolvedValueOnce({ statusCode: 201, body: "", headers: {} });
    const r = await sendPushToUser({ tenantId: "t", userId: "u", payload: { title: "T", body: "B" } });
    expect(r.sent).toBe(1);
    expect(r.failed).toBe(0);
    expect(mockWebPush.sendNotification).toHaveBeenCalledTimes(2);
    expect(ps.update).toHaveBeenCalledTimes(1); // lastSentAt sekali
  });

  it("404/410 TIDAK di-retry (endpoint basi — percobaan ulang pasti gagal)", async () => {
    ps.findMany.mockResolvedValueOnce([
      { id: "s1", endpoint: VALID_SUB.endpoint, p256dh: "x".repeat(80), auth: "y".repeat(30) },
    ]);
    mockWebPush.sendNotification.mockRejectedValueOnce({ statusCode: 410 });
    await sendPushToUser({ tenantId: "t", userId: "u", payload: { title: "T", body: "B" } });
    expect(mockWebPush.sendNotification).toHaveBeenCalledTimes(1); // hanya sekali
  });

  it("payload body JSON berisi title/body/url", async () => {
    ps.findMany.mockResolvedValueOnce([
      { id: "s1", endpoint: VALID_SUB.endpoint, p256dh: "x".repeat(80), auth: "y".repeat(30) },
    ]);
    await sendPushToUser({ tenantId: "t", userId: "u", payload: { title: "T1", body: "B1", url: "/t/pekerjaan/j1" } });
    const body = JSON.parse(mockWebPush.sendNotification.mock.calls[0][1] as string);
    expect(body.title).toBe("T1");
    expect(body.body).toBe("B1");
    expect(body.url).toBe("/t/pekerjaan/j1");
  });
});
