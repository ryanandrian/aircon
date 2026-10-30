import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Jalur pembayaran tenant terblokir.
 *
 * MASALAH (ditemukan 2026-10-30): `getServerContext()` melempar untuk status
 * tak usable, dan HANYA `getServerContext()` yang dipakai aksi pembayaran →
 * owner tenant SUSPENDED tak pernah bisa membayar, padahal `activateSubscription`
 * sudah siap menyembuhkan (status ACTIVE + reset dunning).
 *
 * KONTRAK YANG DIJAGA DI SINI:
 *  1. SUSPENDED + OWNER → BOLEH membayar (jalan penyembuhan).
 *  2. CANCELLED → TIDAK boleh membayar (keputusan admin platform, bukan tunggakan).
 *  3. Peran non-OWNER tetap ditolak (guard tak dilonggarkan).
 *  4. Order milik tenant lain tetap ditolak.
 */

const mocks = vi.hoisted(() => ({
  ctx: null as any,
  tenant: null as any,
  payment: null as any,
  startIpaymuPayment: vi.fn(async () => ({ redirectUrl: "https://ipaymu.test/pay", orderId: "ord-1" })),
  isIpaymuConfigured: vi.fn(async () => true),
}));

vi.mock("@/lib/auth/context", () => ({
  getBillingRecoveryContext: vi.fn(async () => {
    if (!mocks.ctx) throw new Error("no context");
    return mocks.ctx;
  }),
}));

vi.mock("@/lib/billing/ipaymu-client", () => ({
  isIpaymuConfigured: mocks.isIpaymuConfigured,
}));

vi.mock("@/lib/services/subscription-service", () => ({
  startIpaymuPayment: mocks.startIpaymuPayment,
  BillingError: class BillingError extends Error {
    code: string;
    constructor(code: string, message: string) { super(message); this.code = code; }
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    tenant: { findUnique: vi.fn(async () => mocks.tenant) },
    payment: { findUnique: vi.fn(async () => mocks.payment) },
  },
}));

import { startPayment, resumePayment } from "../src/app/app/langganan/actions";

const ownerCtx = { tenantId: "t1", userId: "u1", role: "OWNER", name: "Pemilik", email: "o@x.test", tenantStatus: "SUSPENDED" };

beforeEach(() => {
  mocks.ctx = { ...ownerCtx };
  mocks.tenant = { id: "t1", phone: "08123" };
  mocks.payment = null;
  mocks.startIpaymuPayment.mockClear();
  mocks.isIpaymuConfigured.mockClear();
  mocks.isIpaymuConfigured.mockImplementation(async () => true);
});

describe("aksi pembayaran — tenant terblokir", () => {
  it("SUSPENDED + OWNER boleh memulai pembayaran (jalan penyembuhan)", async () => {
    const res = await startPayment("PRO" as any, 1);
    expect(res).toEqual({ ok: true, redirectUrl: "https://ipaymu.test/pay" });
    expect(mocks.startIpaymuPayment).toHaveBeenCalledTimes(1);
  });

  it("CANCELLED ditolak eksplisit — tak ada tombol bayar", async () => {
    mocks.ctx = { ...ownerCtx, tenantStatus: "CANCELLED" };
    const res = await startPayment("PRO" as any, 1);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toContain("Berhenti");
      expect(res.error).toContain("Kontak");
    }
    expect(mocks.startIpaymuPayment).not.toHaveBeenCalled();
  });

  it("peran selain OWNER tetap ditolak", async () => {
    mocks.ctx = { ...ownerCtx, role: "ADMIN" };
    const res = await startPayment("PRO" as any, 1);
    expect(res.ok).toBe(false);
    expect(mocks.startIpaymuPayment).not.toHaveBeenCalled();
  });

  it("resumePayment: SUSPENDED boleh melanjutkan pembayaran", async () => {
    mocks.payment = {
      orderId: "ord-9", tenantId: "t1", plan: "PRO", periodMonths: 1,
      status: "PENDING", checkoutRedirect: "https://ipaymu.test/redirect", couponCode: null,
    };
    const res = await resumePayment("ord-9");
    expect(res).toMatchObject({ ok: true, kind: "resume" });
  });

  it("resumePayment: CANCELLED ditolak", async () => {
    mocks.ctx = { ...ownerCtx, tenantStatus: "CANCELLED" };
    mocks.payment = {
      orderId: "ord-9", tenantId: "t1", plan: "PRO", periodMonths: 1,
      status: "PENDING", checkoutRedirect: "https://ipaymu.test/redirect", couponCode: null,
    };
    const res = await resumePayment("ord-9");
    expect(res.ok).toBe(false);
  });

  it("resumePayment: order milik tenant lain tetap ditolak", async () => {
    mocks.payment = {
      orderId: "ord-9", tenantId: "t-other", plan: "PRO", periodMonths: 1,
      status: "PENDING", checkoutRedirect: "https://ipaymu.test/redirect", couponCode: null,
    };
    const res = await resumePayment("ord-9");
    expect(res).toMatchObject({ ok: false, error: "Transaksi tidak ditemukan." });
  });
});
