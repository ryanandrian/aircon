import { describe, it, expect } from "vitest";

// REGRESSION (F3 / G10): baris SENDING yang lease-nya kedaluwarsa berarti hasil
// kirim TIDAK dapat dipastikan (proses mati saat memanggil provider). Gateway tak
// punya endpoint lookup job, jadi hasil tak bisa dipastikan → tandai UNKNOWN,
// JANGAN kirim ulang (duplikat ke pelanggan lebih buruk daripada pesan yang perlu
// ditinjau operator).

import {
  leaseExpiry, leaseMinutesFromEnv, isLeaseExpired, staleSendingOutcome,
  DEFAULT_LEASE_MINUTES, MIN_LEASE_MINUTES, MAX_LEASE_MINUTES,
} from "../src/lib/domain/queue-lease";

describe("lease — parameter", () => {
  it("default 10 menit; clamp ke batas", () => {
    expect(leaseMinutesFromEnv(undefined)).toBe(DEFAULT_LEASE_MINUTES);
    expect(leaseMinutesFromEnv("abc")).toBe(DEFAULT_LEASE_MINUTES);
    expect(leaseMinutesFromEnv("1")).toBe(MIN_LEASE_MINUTES);
    expect(leaseMinutesFromEnv("9999")).toBe(MAX_LEASE_MINUTES);
    expect(leaseMinutesFromEnv("25")).toBe(25);
  });

  it("expiry = from + menit; kedaluwarsa berbasis instan", () => {
    const from = new Date("2026-10-28T00:00:00.000Z");
    expect(leaseExpiry(from, 10).toISOString()).toBe("2026-10-28T00:10:00.000Z");
    expect(isLeaseExpired(leaseExpiry(from, 10), new Date("2026-10-28T00:09:59.000Z"))).toBe(false);
    expect(isLeaseExpired(leaseExpiry(from, 10), new Date("2026-10-28T00:10:01.000Z"))).toBe(true);
    expect(isLeaseExpired(null, new Date())).toBe(false);
  });
});

describe("keputusan reclaim", () => {
  const now = new Date("2026-10-28T00:00:00.000Z");
  it("QUEUED → claimable", () => {
    expect(staleSendingOutcome({ status: "QUEUED", leaseExpiresAt: null, now })).toBe("claimable");
  });
  it("SENDING dengan lease hidup → skip (jangan ganggu)", () => {
    const live = leaseExpiry(now, 10);
    expect(staleSendingOutcome({ status: "SENDING", leaseExpiresAt: live, now })).toBe("skip");
  });
  it("SENDING dengan lease kedaluwarsa → stale-unknown (TIDAK kirim ulang)", () => {
    const expired = leaseExpiry(now, -1); // sudah lewat dari `now`
    expect(staleSendingOutcome({ status: "SENDING", leaseExpiresAt: expired, now })).toBe("stale-unknown");
  });
  it("SENDING tanpa lease (legacy) → stale-unknown", () => {
    expect(staleSendingOutcome({ status: "SENDING", leaseExpiresAt: null, now })).toBe("stale-unknown");
  });
  it("status lain → skip", () => {
    expect(staleSendingOutcome({ status: "SENT", leaseExpiresAt: null, now })).toBe("skip");
    expect(staleSendingOutcome({ status: "FAILED", leaseExpiresAt: null, now })).toBe("skip");
    expect(staleSendingOutcome({ status: "UNKNOWN", leaseExpiresAt: null, now })).toBe("skip");
  });
});
