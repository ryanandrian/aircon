import { describe, it, expect } from "vitest";
import {
  makeOrderId,
  parseMidtransStatus,
  subscriptionPeriodEnd,
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
});
