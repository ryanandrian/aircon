import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// 409 DUPLICATE → SENT, BUKAN GAGAL (kelanjutan dari gateway-relay-duplicate)
//
// Dispatcher lama: `if (res.ok) SENT else QUEUED/FAILED`. Karena 409 membuat
// `res.ok === false`, pesan yang SUDAH sampai justru dihitung gagal, diputar
// sampai MAX_ATTEMPTS=3 lalu jatuh ke FAILED — kartu admin menampilkan
// "Gagal" untuk pesan yang sebenarnya terkirim, dan "Antre" berputar sia-sia.
//
// Bukti lapangan (nginx + antrean gateway, 2026-10-23):
//   14:54:18 → 200  job 1792742058165-244 SENT ke 6281319150260
//   16:57-17:02 → 409 (×4, isi pesan identik) -> antrean gateway TIDAK bertambah
// ---------------------------------------------------------------------------

vi.mock("server-only", () => ({}));

const update = vi.fn(async () => ({}));
const updateMany = vi.fn(async () => ({ count: 1 }));
const findMany = vi.fn(async (): Promise<Record<string, unknown>[]> => []);
vi.mock("@/lib/prisma", () => ({
  prisma: { platformNotification: { findMany, updateMany, update } },
}));
vi.mock("@/lib/email/smtp", () => ({
  sendEmail: vi.fn(),
  isEmailConfigured: () => false,
}));
vi.mock("@/lib/wa/gateway-relay", () => ({
  isGatewayConfigured: vi.fn(async () => true),
  gatewaySendAs: vi.fn(async () => ({ ok: false })),
  PLATFORM_WA_SESSION: "lumite-platform",
}));
// Kill switch platform (G30) — default aktif.
vi.mock("@/lib/services/infra-config-service", () => ({
  isNotifySendEnabled: vi.fn(async () => true),
  isWaSendEnabled: vi.fn(async () => true),
}));

const NOTIF = {
  id: "notif-1", tenantId: "jaya-mandiri", channel: "WA",
  toAddress: "6281319150260", body: "Halo Jaya Mandiri", attempts: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  findMany.mockResolvedValue([NOTIF]);
  updateMany.mockResolvedValue({ count: 1 });
});

describe("dispatchPlatformNotifications — 409 duplicate dihitung TERKIRIM", () => {
  it("duplicate → status SENT dengan gatewayMessageId job yang benar-benar mengirim", async () => {
    const { gatewaySendAs } = await import("@/lib/wa/gateway-relay");
    vi.mocked(gatewaySendAs).mockResolvedValue({
      ok: false, duplicate: true, messageId: "1792742058165-244",
      error: "pesan identik baru saja diantre (dedup)",
    });

    const { dispatchPlatformNotifications } = await import(
      "../src/lib/services/platform-notification-dispatch"
    );
    const r = await dispatchPlatformNotifications();

    expect(r.sent).toBe(1);       // dihitung terkirim — memang sudah sampai
    expect(r.failed).toBe(0);     // BUKAN kegagalan
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "notif-1" },
      data: expect.objectContaining({
        status: "SENT",
        gatewayMessageId: "1792742058165-244",
        error: null,
      }),
    }));
  });

  // REGRESSION (2026-10-26): 409 duplicate TANPA messageId berarti gateway
  // SUDAH punya pesan itu (menolak sebagai duplikat), bukan "gagal kirim".
  // Bukti live: 11 notifikasi FAILED dengan error "pesan identik baru saja
  // diantre (dedup)" (16 Sep–23 Okt) — padahal gateway job-nya SENT.
  // Menandainya FAILED/QUEUED = data bohong + antrean berputar sia-sia.
  it("duplicate TANPA messageId → tetap SENT (gateway menolak = sudah terkirim)", async () => {
    const { gatewaySendAs } = await import("@/lib/wa/gateway-relay");
    vi.mocked(gatewaySendAs).mockResolvedValue({
      ok: false, duplicate: true, error: "pesan identik baru saja diantre (dedup)",
    });

    const { dispatchPlatformNotifications } = await import(
      "../src/lib/services/platform-notification-dispatch"
    );
    const r = await dispatchPlatformNotifications();

    expect(r.sent).toBe(1);       // dihitung terkirim — gateway menyingkirkan
    expect(r.failed).toBe(0);     // BUKAN kegagalan
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "notif-1" },
      data: expect.objectContaining({
        status: "SENT",
        error: null,
      }),
    }));
  });

  it("kegagalan biasa TETAP retry/FAILED (perilaku lama tidak berubah)", async () => {
    const { gatewaySendAs } = await import("@/lib/wa/gateway-relay");
    vi.mocked(gatewaySendAs).mockResolvedValue({ ok: false, error: "gateway 500" });

    const { dispatchPlatformNotifications } = await import(
      "../src/lib/services/platform-notification-dispatch"
    );
    await dispatchPlatformNotifications();

    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: "QUEUED",
        error: expect.stringContaining("gateway 500"),
      }),
    }));
  });

  it("sukses 200 tetap SENT (tidak terpengaruh perubahan)", async () => {
    const { gatewaySendAs } = await import("@/lib/wa/gateway-relay");
    vi.mocked(gatewaySendAs).mockResolvedValue({ ok: true, messageId: "job-baru" });

    const { dispatchPlatformNotifications } = await import(
      "../src/lib/services/platform-notification-dispatch"
    );
    const r = await dispatchPlatformNotifications();

    expect(r.sent).toBe(1);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "SENT", gatewayMessageId: "job-baru" }),
    }));
  });
});

describe("dispatchPlatformNotifications — meneruskan dedupeKey row sebagai kunci", () => {
  it("dedupeKey row dipakai sebagai idempotencyKey (idempotensi per-event, bukan per-teks)", async () => {
    findMany.mockResolvedValue([{ ...NOTIF, dedupeKey: "subscription_due:jaya-mandiri:20261023" }]);
    const { gatewaySendAs } = await import("@/lib/wa/gateway-relay");
    vi.mocked(gatewaySendAs).mockResolvedValue({ ok: true, messageId: "j3" });

    const { dispatchPlatformNotifications } = await import(
      "../src/lib/services/platform-notification-dispatch"
    );
    await dispatchPlatformNotifications();

    expect(gatewaySendAs).toHaveBeenCalledWith(
      "lumite-platform", "6281319150260", "Halo Jaya Mandiri",
      { idempotencyKey: "subscription_due:jaya-mandiri:20261023" },
    );
  });

  it("dedupeKey null → gateway memakai kunci turunannya (perilaku lama)", async () => {
    findMany.mockResolvedValue([{ ...NOTIF, dedupeKey: null }]);
    const { gatewaySendAs } = await import("@/lib/wa/gateway-relay");
    vi.mocked(gatewaySendAs).mockResolvedValue({ ok: true, messageId: "j4" });

    const { dispatchPlatformNotifications } = await import(
      "../src/lib/services/platform-notification-dispatch"
    );
    await dispatchPlatformNotifications();

    expect(gatewaySendAs).toHaveBeenCalledWith(
      "lumite-platform", "6281319150260", "Halo Jaya Mandiri", { idempotencyKey: null },
    );
  });
});
