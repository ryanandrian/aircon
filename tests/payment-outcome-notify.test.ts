import { describe, it, expect, vi, beforeEach } from "vitest";

// REGRESSION (audit 2026-10-27, G7): pembayaran yang GAGAL atau KEDALUWARSA
// wajib memberi tahu pemilik, tanpa pernah menyatakan paket aktif, dan tanpa
// menggandakan pesan saat webhook diulang.

vi.mock("server-only", () => ({}));

const { paymentFindUnique, paymentUpdateMany, notifyPlatform, planConfigFindUnique, isAutoReminderPlan } = vi.hoisted(() => ({
  paymentFindUnique: vi.fn(),
  paymentUpdateMany: vi.fn(),
  notifyPlatform: vi.fn(),
  planConfigFindUnique: vi.fn(),
  isAutoReminderPlan: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    payment: { findUnique: paymentFindUnique, updateMany: paymentUpdateMany },
    planConfig: { findUnique: planConfigFindUnique },
    tenant: { update: vi.fn(), findUnique: vi.fn() },
    subscription: { upsert: vi.fn() },
    $transaction: async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[]),
  },
}));
vi.mock("@/lib/services/platform-notification-service", () => ({ notifyPlatform, isAutoReminderPlan }));
vi.mock("@/lib/partner/partner-service", () => ({ accrueCommission: vi.fn(), reverseCommission: vi.fn() }));
vi.mock("@/lib/billing/config", () => ({ getBillingPolicy: vi.fn() }));
vi.mock("@/lib/services/company-service", () => ({ getCompanyProfile: vi.fn(), effectiveTaxPercent: vi.fn() }));
vi.mock("@/lib/billing/ipaymu-client", () => ({ createIpaymuRedirect: vi.fn() }));
vi.mock("@/lib/services/coupon-service", () => ({ resolveCheckoutDiscount: vi.fn() }));
vi.mock("@/lib/domain/coupon-calc", () => ({ resolveCheckout: vi.fn() }));

import { processIpaymuNotification } from "../src/lib/services/subscription-service";

const PENDING_PAYMENT = {
  id: "pay-9",
  tenantId: "tenant-trial",
  orderId: "AIRCON-PAY-TENANT-999",
  plan: "PROFESSIONAL",
  amount: 149000,
  status: "PENDING",
  periodMonths: 1,
  commissionBaseIdr: 149000,
};

describe("notifikasi outcome pembayaran gagal / kedaluwarsa (G7)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    paymentFindUnique.mockResolvedValue({ ...PENDING_PAYMENT });
    paymentUpdateMany.mockResolvedValue({ count: 1 });
    notifyPlatform.mockResolvedValue({ created: 2, skipped: [] });
    planConfigFindUnique.mockResolvedValue({ displayName: "Professional" });
  });

  it("PENDING → FAILED mengantre payment_failed dengan paket yang DIBELI", async () => {
    const r = await processIpaymuNotification({
      referenceId: PENDING_PAYMENT.orderId, status: "failed", amount: 149000, raw: {},
    });
    expect(r.status).toBe("FAILED");
    expect(notifyPlatform).toHaveBeenCalledTimes(1);
    expect(notifyPlatform).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: "tenant-trial",
      templateKey: "payment_failed",
      dedupeKey: `payment:${PENDING_PAYMENT.orderId}:FAILED`,
      vars: expect.objectContaining({
        paket: "Professional",
        nominal: expect.stringContaining("149.000"),
        tanggal: expect.stringMatching(/\d/),
      }),
    }));
  });

  it("PENDING → EXPIRED mengantre payment_expired", async () => {
    await processIpaymuNotification({
      referenceId: PENDING_PAYMENT.orderId, status: "expired", amount: 149000, raw: {},
    });
    expect(notifyPlatform).toHaveBeenCalledWith(expect.objectContaining({
      templateKey: "payment_expired",
      dedupeKey: `payment:${PENDING_PAYMENT.orderId}:EXPIRED`,
    }));
  });

  it("webhook ulang pada baris yang SUDAH FAILED tidak mengantre lagi", async () => {
    paymentFindUnique.mockResolvedValue({ ...PENDING_PAYMENT, status: "FAILED" });
    await processIpaymuNotification({
      referenceId: PENDING_PAYMENT.orderId, status: "failed", amount: 149000, raw: {},
    });
    expect(notifyPlatform).not.toHaveBeenCalled();
  });

  // RACE: dua callback paralel yang sama-sama membaca status PENDING.
  // Hanya PEMENANG updateMany (count=1) yang boleh mengantre pesan.
  it("kalah balapan transisi (updateMany count=0) tidak mengantre notifikasi", async () => {
    paymentUpdateMany.mockResolvedValue({ count: 0 });
    const r = await processIpaymuNotification({
      referenceId: PENDING_PAYMENT.orderId, status: "failed", amount: 149000, raw: {},
    });
    expect(r.status).toBe("FAILED");
    expect(notifyPlatform).not.toHaveBeenCalled();
  });

  it("kalah balapan pada transisi PAID tidak mengantre konfirmasi aktif", async () => {
    paymentUpdateMany.mockResolvedValue({ count: 0 });
    await processIpaymuNotification({
      referenceId: PENDING_PAYMENT.orderId, status: "berhasil", amount: 149000, raw: {},
    });
    expect(notifyPlatform).not.toHaveBeenCalled();
  });

  it("gagal antre tidak membatalkan update status pembayaran", async () => {
    notifyPlatform.mockRejectedValue(new Error("queue penuh"));
    const r = await processIpaymuNotification({
      referenceId: PENDING_PAYMENT.orderId, status: "failed", amount: 149000, raw: {},
    });
    expect(r.status).toBe("FAILED");
    expect(paymentUpdateMany).toHaveBeenCalled();
  });

  it("PlanConfig tak terbaca → fallback nama enum, render tetap jalan", async () => {
    planConfigFindUnique.mockRejectedValue(new Error("db down"));
    await processIpaymuNotification({
      referenceId: PENDING_PAYMENT.orderId, status: "failed", amount: 149000, raw: {},
    });
    expect(notifyPlatform).toHaveBeenCalledWith(expect.objectContaining({
      vars: expect.objectContaining({ paket: "PROFESSIONAL" }),
    }));
  });
});
