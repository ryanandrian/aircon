import { describe, it, expect } from "vitest";
import {
  makeOrderId,
  parseMidtransStatus,
  subscriptionPeriodEnd,
  decideResumeAction,
} from "../src/lib/billing/midtrans-logic";

describe("midtrans logic (pure)", () => {
  it("makeOrderId unik & mengandung tenantId pendek + timestamp", () => {
    const a = makeOrderId("tenant123");
    const b = makeOrderId("tenant123");
    expect(a).not.toBe(b);
    expect(a.startsWith("AIRCON-")).toBe(true);
  });

  it("parseMidtransStatus memetakan transaction_status ke PaymentStatus", () => {
    expect(parseMidtransStatus({ transaction_status: "settlement" })).toBe("PAID");
    expect(parseMidtransStatus({ transaction_status: "capture", fraud_status: "accept" })).toBe("PAID");
    expect(parseMidtransStatus({ transaction_status: "capture", fraud_status: "challenge" })).toBe("PENDING");
    expect(parseMidtransStatus({ transaction_status: "pending" })).toBe("PENDING");
    expect(parseMidtransStatus({ transaction_status: "deny" })).toBe("FAILED");
    expect(parseMidtransStatus({ transaction_status: "cancel" })).toBe("FAILED");
    expect(parseMidtransStatus({ transaction_status: "expire" })).toBe("EXPIRED");
    expect(parseMidtransStatus({ transaction_status: "refund" })).toBe("REFUNDED");
  });

  it("subscriptionPeriodEnd menambah bulan", () => {
    const start = new Date("2026-01-15T00:00:00Z");
    const end = subscriptionPeriodEnd(start, 1);
    expect(end.toISOString().slice(0, 10)).toBe("2026-02-15");
    const end3 = subscriptionPeriodEnd(start, 3);
    expect(end3.toISOString().slice(0, 10)).toBe("2026-04-15");
  });

  it("decideResumeAction: lunas → paid (apa pun token)", () => {
    expect(decideResumeAction({ mappedStatus: "PAID", tokenExpired: false, hasStoredToken: true })).toBe("paid");
    expect(decideResumeAction({ mappedStatus: "PAID", tokenExpired: true, hasStoredToken: false })).toBe("paid");
  });

  it("decideResumeAction: pending + token hidup + ada token → reuse", () => {
    expect(decideResumeAction({ mappedStatus: "PENDING", tokenExpired: false, hasStoredToken: true })).toBe("reuse");
  });

  it("decideResumeAction: pending tapi token kadaluarsa → regenerate", () => {
    expect(decideResumeAction({ mappedStatus: "PENDING", tokenExpired: true, hasStoredToken: true })).toBe("regenerate");
  });

  it("decideResumeAction: pending tanpa token tersimpan → regenerate", () => {
    expect(decideResumeAction({ mappedStatus: "PENDING", tokenExpired: false, hasStoredToken: false })).toBe("regenerate");
  });

  it("decideResumeAction: expire/cancel/deny (FAILED/EXPIRED) → regenerate", () => {
    expect(decideResumeAction({ mappedStatus: "FAILED", tokenExpired: false, hasStoredToken: true })).toBe("regenerate");
    expect(decideResumeAction({ mappedStatus: "EXPIRED", tokenExpired: false, hasStoredToken: true })).toBe("regenerate");
  });
});
