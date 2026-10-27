import { describe, it, expect, vi, beforeEach } from "vitest";

// REGRESSION (audit 2026-10-26, G2): setelah pembayaran PAID, tenant berbayar
// harus menerima konfirmasi paket aktif. Webhook iPaymu boleh diulang —
// transisi hanya boleh terjadi sekali (dari status bukan-PAID ke PAID), dan
// notifikasi diantre dengan dedupe per orderId.

vi.mock("server-only", () => ({}));

const { paymentFindUnique, paymentUpdateMany, tenantUpdate, tenantFindUnique, subscriptionUpsert, subscriptionFindUnique, notifyPlatform, accrueCommission, isAutoReminderPlan } = vi.hoisted(() => ({
  paymentFindUnique: vi.fn(),
  paymentUpdateMany: vi.fn(),
  tenantUpdate: vi.fn(),
  tenantFindUnique: vi.fn(),
  subscriptionUpsert: vi.fn(),
  subscriptionFindUnique: vi.fn(),
  notifyPlatform: vi.fn(),
  accrueCommission: vi.fn(),
  isAutoReminderPlan: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    payment: { findUnique: paymentFindUnique, updateMany: paymentUpdateMany },
    tenant: { update: tenantUpdate, findUnique: tenantFindUnique },
    subscription: { upsert: subscriptionUpsert, findUnique: subscriptionFindUnique },
    $transaction: async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[]),
  },
}));
vi.mock("@/lib/services/platform-notification-service", () => ({ notifyPlatform, isAutoReminderPlan }));
vi.mock("@/lib/partner/partner-service", () => ({ accrueCommission, reverseCommission: vi.fn() }));
vi.mock("@/lib/billing/config", () => ({ getBillingPolicy: vi.fn() }));
vi.mock("@/lib/services/company-service", () => ({ getCompanyProfile: vi.fn(), effectiveTaxPercent: vi.fn() }));
vi.mock("@/lib/billing/ipaymu-client", () => ({ createIpaymuRedirect: vi.fn() }));
vi.mock("@/lib/services/coupon-service", () => ({ resolveCheckoutDiscount: vi.fn() }));
vi.mock("@/lib/domain/coupon-calc", () => ({ resolveCheckout: vi.fn() }));

import { processIpaymuNotification } from "../src/lib/services/subscription-service";

const PAID_PAYMENT = {
  id: "pay-1",
  tenantId: "tenant-pro",
  orderId: "AIRCON-PAY-TENANT-123",
  plan: "PROFESSIONAL",
  amount: 149000,
  status: "PENDING",
  periodMonths: 1,
  commissionBaseIdr: 149000,
};

describe("notifikasi paket aktif setelah pembayaran", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    paymentFindUnique.mockResolvedValue({ ...PAID_PAYMENT });
    paymentUpdateMany.mockResolvedValue({ count: 1 });
    tenantUpdate.mockResolvedValue({});
    subscriptionUpsert.mockResolvedValue({});
    tenantFindUnique.mockResolvedValue({ currentPeriodEnd: new Date("2026-11-27T00:00:00.000Z") });
    subscriptionFindUnique.mockResolvedValue({ currentPeriodEnd: new Date("2026-11-27T00:00:00.000Z") });
    notifyPlatform.mockResolvedValue({ created: 2, skipped: [] });
    accrueCommission.mockResolvedValue(undefined);
    isAutoReminderPlan.mockResolvedValue(true);
  });

  it("mengantre konfirmasi paket aktif saat transisi PENDING → PAID", async () => {
    const r = await processIpaymuNotification({
      referenceId: PAID_PAYMENT.orderId,
      status: "berhasil",
      amount: 149000,
      raw: {},
    });
    expect(r.status).toBe("PAID");
    expect(notifyPlatform).toHaveBeenCalledTimes(1);
    expect(notifyPlatform).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: "tenant-pro",
      templateKey: "subscription_activated",
      dedupeKey: `payment:${PAID_PAYMENT.orderId}:PAID`,
      vars: expect.objectContaining({ nominal: expect.stringContaining("149.000") }),
    }));
  });

  // Paket berbayar dengan autoReminder=true → CTA sambung WA hadir.
  it("pakai CTA sambung WA bila paket yang dibeli mengizinkan autoReminder", async () => {
    isAutoReminderPlan.mockResolvedValue(true);
    await processIpaymuNotification({
      referenceId: PAID_PAYMENT.orderId, status: "berhasil", amount: 149000, raw: {},
    });
    expect(notifyPlatform).toHaveBeenCalledWith(expect.objectContaining({
      vars: expect.objectContaining({ cta: expect.stringContaining("sambungkan WhatsApp") }),
    }));
  });

  // TANPA gerbang ini, pembelian paket non-otomatis menerima ajakan fitur yang
  // tidak tersedia — persis keluhan awal pemilik soal pesan menyesatkan.
  it("tanpa autoReminder CTA sambung WA diganti panduan menu Pengingat", async () => {
    isAutoReminderPlan.mockResolvedValue(false);
    await processIpaymuNotification({
      referenceId: PAID_PAYMENT.orderId, status: "berhasil", amount: 149000, raw: {},
    });
    const vars = (notifyPlatform as ReturnType<typeof vi.fn>).mock.calls[0][0].vars as Record<string, string>;
    expect(vars.cta).toContain("menu Pengingat");
    expect(vars.cta).not.toMatch(/sambungkan WhatsApp/i);
  });

  it("webhook ulang pada payment yang SUDAH PAID tidak mengantre notifikasi lagi", async () => {
    paymentFindUnique.mockResolvedValue({ ...PAID_PAYMENT, status: "PAID" });
    const r = await processIpaymuNotification({
      referenceId: PAID_PAYMENT.orderId,
      status: "berhasil",
      amount: 149000,
      raw: {},
    });
    expect(r.status).toBe("PAID");
    expect(notifyPlatform).not.toHaveBeenCalled();
  });

  it("kegagalan antre notifikasi tidak membatalkan aktivasi langganan", async () => {
    notifyPlatform.mockRejectedValue(new Error("queue penuh"));
    const r = await processIpaymuNotification({
      referenceId: PAID_PAYMENT.orderId,
      status: "berhasil",
      amount: 149000,
      raw: {},
    });
    expect(r.status).toBe("PAID");
    expect(tenantUpdate).toHaveBeenCalled();
  });

  it("melewati konfirmasi dan mencatat error bila tidak ada currentPeriodEnd", async () => {
    tenantFindUnique.mockResolvedValue({ currentPeriodEnd: null });
    subscriptionFindUnique.mockResolvedValue({ currentPeriodEnd: null });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await processIpaymuNotification({
      referenceId: PAID_PAYMENT.orderId, status: "berhasil", amount: 149000, raw: {},
    });
    expect(r.status).toBe("PAID");
    expect(notifyPlatform).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(expect.stringContaining("tidak punya currentPeriodEnd"));
    error.mockRestore();
  });
});
