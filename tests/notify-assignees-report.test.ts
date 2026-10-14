import { describe, it, expect, vi, beforeEach } from "vitest";

// G-A9a — notifyAssignees MENGEMBALIKAN status kirim per personel (bukan void).
//
// Permintaan pemilik (2026-10-14): "jika ada konfirmasi push notifikasi
// berhasil harus ada pesan ke admin panel beberapa saat lalu otomatis hilang
// (tidak perlu menunggu refresh), tapi kalau gagal harus ada tombol kirim ulang."
// Untuk itu service harus MELAPORKAN hasil kirim per orang — bukan fire-and-forget
// senyap seperti sebelumnya (void).
//
// Kontrak baru:
//   notifyAssignees(...) -> PushDeliveryReport
//   PushDeliveryReport = { perPerson: PersonPushReport[], totalSent, totalFailed }
//   PersonPushReport = { personId, name, sent, failed, revoked, skipped }
//
// Yang DIKUNCI:
// 1. Report berisi SEMUA personel (termasuk yang tanpa subscription — skipped).
// 2. Personel dgn 1 sub sukses → sent=1, failed=0.
// 3. Push gagal ke sub (5xx dua kali) → failed=1 utk orang itu, sent=0.
// 4. Error query job TETAP ditelan (aman-gagal) → report perPerson=[] tanpa throw.
// 5. Personel tanpa subscription → skipped=1, sent=0, failed=0.

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    jobOrder: { findFirst: vi.fn() },
    technician: { findMany: vi.fn() },
    pushSubscription: {
      findMany: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  },
}));
vi.mock("@/lib/auth/context", () => ({ tryGetServerContext: vi.fn() }));
vi.mock("web-push", () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn().mockResolvedValue({ statusCode: 201, body: "", headers: {} }),
  },
}));

import { prisma } from "@/lib/prisma";
import webpush from "web-push";
import { notifyAssignees } from "@/lib/services/push-notification-service";

const ps = prisma.pushSubscription as unknown as {
  findMany: any; update: any; updateMany: any;
};
const mockWebPush = vi.mocked(webpush);

beforeEach(() => {
  vi.clearAllMocks();
  process.env.PUSH_VAPID_PUBLIC_KEY = "pub";
  process.env.PUSH_VAPID_PRIVATE_KEY = "priv";
});

function setupBase(techs: any[], subsByUser: Record<string, any[]>) {
  (prisma.jobOrder.findFirst as any).mockResolvedValue({ id: "j1", customer: { name: "Effi" } });
  (prisma.technician.findMany as any).mockResolvedValue(techs.map((t, i) => ({ id: t.personId ?? `p${i + 1}`, userId: t.userId, user: { name: "Ryan" } })));
  ps.findMany.mockImplementation(async ({ where }: any) => subsByUser[where.userId] ?? []);
}

describe("notifyAssignees — laporan hasil per personel", () => {
  it("mengembalikan report utk SEMUA personel (termasuk tanpa subscription)", async () => {
    setupBase(
      [{ userId: "u1", personId: "p1" }, { userId: "u2", personId: "p2" }],
      { u1: [{ id: "s1", endpoint: "https://fcm.googleapis.com/x", p256dh: "x".repeat(80), auth: "y".repeat(30) }] },
    );
    const r = await notifyAssignees({ tenantId: "t", jobId: "j1", personIds: ["p1", "p2"] });
    expect(r.perPerson).toHaveLength(2);
    expect(r.perPerson.map((p) => p.personId).sort()).toEqual(["p1", "p2"]);
  });

  it("orang dgn subscription sukses: sent=1, totalSent=1", async () => {
    setupBase([{ userId: "u1", personId: "p1" }], { u1: [{ id: "s1", endpoint: "https://fcm.googleapis.com/x", p256dh: "x".repeat(80), auth: "y".repeat(30) }] });
    const r = await notifyAssignees({ tenantId: "t", jobId: "j1", personIds: ["p1"] });
    expect(r.perPerson[0]).toMatchObject({ personId: "p1", sent: 1, failed: 0 });
    expect(r.totalSent).toBe(1);
    expect(r.totalFailed).toBe(0);
  });

  it("push gagal tahan-lama utk 1 orang: failed=1, sent=0, totalFailed=1", async () => {
    setupBase([{ userId: "u1", personId: "p1" }], { u1: [{ id: "s1", endpoint: "https://fcm.googleapis.com/x", p256dh: "x".repeat(80), auth: "y".repeat(30) }] });
    mockWebPush.sendNotification.mockRejectedValue({ statusCode: 503 });
    const r = await notifyAssignees({ tenantId: "t", jobId: "j1", personIds: ["p1"] });
    expect(r.perPerson[0]).toMatchObject({ personId: "p1", sent: 0, failed: 1 });
    expect(r.totalFailed).toBe(1);
  });

  it("orang tanpa subscription: skipped=1, sent=0, failed=0 (bukan kegagalan)", async () => {
    setupBase([{ userId: "u1", personId: "p1" }], { u1: [] });
    const r = await notifyAssignees({ tenantId: "t", jobId: "j1", personIds: ["p1"] });
    expect(r.perPerson[0]).toMatchObject({ personId: "p1", sent: 0, failed: 0, skipped: 1 });
    expect(r.totalFailed).toBe(0);
  });

  it("error query job TETAP ditelan (aman-gagal) — report kosong tanpa throw", async () => {
    (prisma.jobOrder.findFirst as any).mockRejectedValue(new Error("DB down"));
    await expect(notifyAssignees({ tenantId: "t", jobId: "j", personIds: ["p"] })).resolves.toMatchObject({ perPerson: [] });
  });

  it("payload body memuat nama pelanggan & url deep-link tugas", async () => {
    setupBase([{ userId: "u1", personId: "p1" }], { u1: [{ id: "s1", endpoint: "https://fcm.googleapis.com/x", p256dh: "x".repeat(80), auth: "y".repeat(30) }] });
    await notifyAssignees({ tenantId: "t", jobId: "j1", personIds: ["p1"] });
    const body = JSON.parse(mockWebPush.sendNotification.mock.calls[0][1] as string);
    expect(body.body).toContain("Effi");
    expect(body.url).toBe("/t/pekerjaan/j1");
  });
});
