import { describe, it, expect, vi, beforeEach } from "vitest";

// G-A3 — server action push di /t (techPushVapidKey / techEnablePush / techDisablePush).
// Pola: tests/tech-upload-photo.test.ts (mock context + service, panggil action).

vi.mock("@/lib/auth/context", () => ({ getServerContext: vi.fn() }));
vi.mock("@/lib/services/push-notification-service", () => ({
  upsertPushSubscription: vi.fn(),
  revokePushSubscription: vi.fn(),
}));
vi.mock("@/lib/services/job-service", () => ({ transitionJob: vi.fn(), TransitionError: class extends Error {} }));
vi.mock("@/lib/services/job-work-service", () => ({ addJobPhoto: vi.fn(), assertCanOperateOnJob: vi.fn() }));
vi.mock("@/lib/services/job-management-service", () => ({ JobError: class extends Error {} }));
vi.mock("@/lib/services/technician-service", () => ({ listTechnicianJobHistory: vi.fn() }));
vi.mock("@/lib/storage/s3", () => ({ putPhoto: vi.fn(), isStorageConfigured: vi.fn(() => false) }));
vi.mock("@/lib/auth/tech-session", () => ({ clearTechSession: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { getServerContext } from "@/lib/auth/context";
import { upsertPushSubscription, revokePushSubscription } from "@/lib/services/push-notification-service";
import { techPushVapidKey, techEnablePush, techDisablePush } from "@/app/t/actions";

const mockCtx = vi.mocked(getServerContext);
const mockUpsert = vi.mocked(upsertPushSubscription);
const mockRevoke = vi.mocked(revokePushSubscription);

const VALID_SUB = {
  endpoint: "https://fcm.googleapis.com/wp/fake",
  keys: { p256dh: "x".repeat(80), auth: "y".repeat(30) },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockCtx.mockResolvedValue({ userId: "u1", tenantId: "t1", role: "TECHNICIAN", name: "T", email: null });
});

describe("techPushVapidKey", () => {
  it("mengembalikan publik key bila diset (privat TIDAK pernah dikirim)", async () => {
    process.env.PUSH_VAPID_PUBLIC_KEY = "pub-abc";
    const r = await techPushVapidKey();
    expect(r).toEqual({ ok: true, vapidPublicKey: "pub-abc" });
  });

  it("null bila VAPID belum diset (fitur nonaktif — jujur, bukan error)", async () => {
    delete process.env.PUSH_VAPID_PUBLIC_KEY;
    const r = await techPushVapidKey();
    expect(r).toEqual({ ok: true, vapidPublicKey: null });
  });

  it("melempar bila belum masuk (kontrak getServerContext = throw, bukan null)", async () => {
    mockCtx.mockRejectedValueOnce(new Error("UNAUTHORIZED"));
    await expect(techPushVapidKey()).rejects.toThrow("UNAUTHORIZED");
  });
});

describe("techEnablePush", () => {
  it("meneruskan payload ke upsertPushSubscription (service = satu-satunya keputusan)", async () => {
    mockUpsert.mockResolvedValueOnce({ ok: true });
    const r = await techEnablePush({ deviceId: "d1", subscription: VALID_SUB, userAgent: "Android" });
    expect(r).toEqual({ ok: true });
    expect(mockUpsert).toHaveBeenCalledWith({ deviceId: "d1", subscription: VALID_SUB, userAgent: "Android" });
  });

  it("mengembalikan error service (mis. subscription tidak valid)", async () => {
    mockUpsert.mockResolvedValueOnce({ ok: false, error: "Subscription tidak valid" });
    const r = await techEnablePush({ deviceId: "d1", subscription: VALID_SUB });
    expect(r).toEqual({ ok: false, error: "Subscription tidak valid" });
  });
});

describe("techDisablePush", () => {
  it("meneruskan revoke perangkat", async () => {
    mockRevoke.mockResolvedValueOnce({ ok: true });
    const r = await techDisablePush({ deviceId: "d1" });
    expect(r).toEqual({ ok: true });
    expect(mockRevoke).toHaveBeenCalledWith({ deviceId: "d1" });
  });
});
