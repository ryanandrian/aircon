import { describe, it, expect, vi, beforeEach } from "vitest";

// REGRESSION (F3 / G9 + G21): ringkasan admin harus memisahkan TIER BUKTI
// (diterima gateway ≠ sampai ≠ dibaca) dan menampilkan tanda operasional
// (antrean terlalu lama, SENDING tanpa lease) — bukan disembunyikan.

vi.mock("server-only", () => ({}));

const { groupBy, count } = vi.hoisted(() => ({ groupBy: vi.fn(), count: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { platformNotification: { groupBy, count } },
}));

import { getPlatformNotifHealth, QUEUED_STALE_MINUTES } from "../src/lib/services/platform-notification-admin";

const STATUS = (...pairs: [string, number][]) =>
  pairs.map(([status, n]) => ({ status, _count: { _all: n } }));

describe("ringkasan tier bukti (G9) & penanda operasional (G21)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    count.mockResolvedValue(0);
  });

  it("tier dipisahkan: SENT ≠ DELIVERED ≠ dibaca; UNKNOWN & FAILED sendiri", async () => {
    groupBy.mockResolvedValue(STATUS(
      ["SENT", 42], ["DELIVERED", 5], ["READ_CONFIRMED", 4],
      ["FAILED", 17], ["UNKNOWN", 2], ["QUEUED", 1], ["SENDING", 3],
    ));
    const h = await getPlatformNotifHealth();
    expect(h.accepted).toBe(42);
    expect(h.delivered).toBe(5);
    expect(h.read).toBe(4);
    expect(h.unknown).toBe(2);
    expect(h.failed).toBe(17);
    expect(h.queued).toBe(1);
    expect(h.sending).toBe(3);
  });

  it("READ_UNOBSERVED ikut hitungan 'dibaca' (bukan failure)", async () => {
    groupBy.mockResolvedValue(STATUS(["SENT", 1], ["READ_UNOBSERVED", 3]));
    const h = await getPlatformNotifHealth();
    expect(h.read).toBe(3);
    expect(h.failed).toBe(0);
    expect(h.needsAttention).toBe(false);
  });

  it("antrean menua >1 jam terdeteksi → needsAttention", async () => {
    groupBy.mockResolvedValue(STATUS(["SENT", 1]));
    count.mockResolvedValueOnce(4); // queuedTooOld
    const h = await getPlatformNotifHealth();
    expect(h.queuedTooOld).toBe(4);
    expect(h.needsAttention).toBe(true);
    // query memakai ambang menit, bukan hari/jam absolut
    expect(QUEUED_STALE_MINUTES).toBeGreaterThan(0);
  });

  it("SENDING tanpa lease (proses mati) terdeteksi", async () => {
    groupBy.mockResolvedValue(STATUS(["SENT", 1]));
    count.mockResolvedValueOnce(0).mockResolvedValueOnce(2);
    const h = await getPlatformNotifHealth();
    expect(h.sendingWithoutLease).toBe(2);
    expect(h.needsAttention).toBe(true);
  });

  it("bersih → needsAttention false (tanpa alarm palsu)", async () => {
    groupBy.mockResolvedValue(STATUS(["SENT", 42]));
    const h = await getPlatformNotifHealth();
    expect(h.needsAttention).toBe(false);
  });
});
