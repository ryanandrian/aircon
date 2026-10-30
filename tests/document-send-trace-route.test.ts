import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * F5 — unit/route proof untuk pengiriman dokumen manual via gateway.
 * Verifikasi evidence MessageLog, duplicate-vs-resend semantics,
 * dan pemisahan jalur Basic wa.me dari gateway Pro/Business.
 */
vi.mock("server-only", () => ({}));

const { messageLogCreate, gatewaySendMock } = vi.hoisted(() => ({
  messageLogCreate: vi.fn<(...args: any[]) => Promise<{ id: string }>>(async () => ({ id: "ml-trace" })),
  gatewaySendMock: vi.fn<(...args: any[]) => Promise<any>>(async () => ({ ok: true, messageId: "gw-1" })),
}));

vi.mock("@/lib/prisma", () => {
  const state = {
    plan: "PROFESSIONAL" as string,
    planConfigs: new Map<string, { autoReminder: boolean }>(),
    invoice: null as any,
  };
  return {
    __state: state,
    prisma: {
      tenant: { findUnique: vi.fn(async () => ({ plan: state.plan, name: "Toko AC", bankName: null, bankAccountNo: null, bankAccountName: null })) },
      planConfig: { findUnique: vi.fn(async ({ where }: any) => state.planConfigs.get(where?.plan) ?? null) },
      invoice: { findFirst: vi.fn(async () => state.invoice), update: vi.fn() },
      messageLog: {
        create: messageLogCreate,
        findFirst: vi.fn(async () => null),
      },
    },
  };
});
vi.mock("@/lib/wa/gateway-relay", () => ({
  gatewaySend: gatewaySendMock,
  isGatewayConfigured: vi.fn(async () => true),
  gatewaySessionStatus: vi.fn(async () => ({ ok: false })),
  gatewayLogoutSession: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/services/customer-service", () => ({
  ServiceError: class extends Error {},
  resolveBillingContact: vi.fn(async () => ({ name: "Budi", waPhone: "6281234", email: null })),
}));

import * as prismaModule from "@/lib/prisma";
import { sendInvoiceViaWa, sendReceiptViaWa } from "@/lib/services/invoice-service";
const state = (prismaModule as any).__state;

const INV = {
  id: "inv-1", docType: "INVOICE", status: "ISSUED", number: "INV/2026/0001",
  issueDate: new Date(), dueDate: null, total: 150000, billingCustomerId: null,
  customer: { id: "cu-1", name: "Budi" },
};
const INV_PAID = { ...INV, id: "inv-2", status: "PAID" };

beforeEach(() => {
  vi.clearAllMocks();
  state.plan = "PROFESSIONAL";
  state.invoice = INV;
  state.planConfigs.set("TRIAL", { autoReminder: false });
  state.planConfigs.set("PROFESSIONAL", { autoReminder: true });
  messageLogCreate.mockResolvedValue({ id: "ml-trace" } as any);
  (prismaModule as any).prisma.messageLog.findFirst.mockResolvedValue(null);
  gatewaySendMock.mockResolvedValue({ ok: true, messageId: "gw-1" } as any);
});

describe("invoice WhatsApp manual send", () => {
  it("regular send uses stable idempotency key and records SENT evidence", async () => {
    const r = await sendInvoiceViaWa("t-pro", "inv-1");
    expect(r.ok).toBe(true);
    expect(gatewaySendMock.mock.calls[0][3].idempotencyKey).toBe("aircon:doc-invoice:t-pro:inv-1");
    expect(messageLogCreate.mock.calls[0][0].data).toMatchObject({ status: "SENT", gatewayMessageId: "gw-1", templateKey: "invoice_wa" });
  });

  it("explicit resend uses stable action identity; ordinary key stays unchanged", async () => {
    await sendInvoiceViaWa("t-pro", "inv-1");
    await sendInvoiceViaWa("t-pro", "inv-1", { resendId: "resend-action-1" });
    const keys = gatewaySendMock.mock.calls.map((call) => call[3].idempotencyKey);
    expect(keys[0]).toBe("aircon:doc-invoice:t-pro:inv-1");
    expect(keys[1]).toBe("aircon:doc-invoice:t-pro:inv-1:resend:resend-action-1");
  });

  it("duplicate gateway response is already-processed, not a new success", async () => {
    gatewaySendMock.mockResolvedValue({ ok: false, duplicate: true, messageId: "gw-orig" } as any);
    const r = await sendInvoiceViaWa("t-pro", "inv-1");
    expect(r.ok).toBe(false);
    expect(r.alreadyProcessed).toBe(true);
    expect(r.error).toMatch(/tidak dikirim ulang/);
    expect(gatewaySendMock).toHaveBeenCalledTimes(1);
    expect(messageLogCreate).not.toHaveBeenCalled();
  });

  it("deferred gateway is held, not failed", async () => {
    gatewaySendMock.mockResolvedValue({ ok: false, deferred: true, error: "KILL SWITCH WA tenant aktif" } as any);
    const r = await sendInvoiceViaWa("t-pro", "inv-1");
    expect(r.held).toBe(true);
    expect(messageLogCreate.mock.calls[0][0].data).toMatchObject({ status: "SUPPRESSED" });
  });

  it("permanent gateway failure is logged FAILED", async () => {
    gatewaySendMock.mockResolvedValue({ ok: false, error: "gateway down" } as any);
    const r = await sendInvoiceViaWa("t-pro", "inv-1");
    expect(r.ok).toBe(false);
    expect(messageLogCreate.mock.calls[0][0].data).toMatchObject({ status: "FAILED" });
  });

  it("a pre-existing accepted/pending prior attempt blocks ordinary click", async () => {
    (prismaModule as any).prisma.messageLog.findFirst.mockResolvedValue({ id: "ml-prior", status: "SENT" });
    const r = await sendInvoiceViaWa("t-pro", "inv-1");
    expect(r.ok).toBe(false);
    expect(r.alreadyProcessed).toBe(true);
    expect(gatewaySendMock).not.toHaveBeenCalled();
  });

  it("Basic/TRIAL never uses gateway and receives a prefilled wa.me link", async () => {
    state.plan = "TRIAL";
    const r = await sendInvoiceViaWa("t-free", "inv-1");
    expect(r.ok).toBe(false);
    expect(r.waMe?.url).toContain("https://wa.me/6281234?");
    expect(r.waMe?.message).toContain("INV/2026/0001");
    expect(gatewaySendMock).not.toHaveBeenCalled();
    expect(messageLogCreate).not.toHaveBeenCalled();
  });
});

describe("receipt WhatsApp manual send", () => {
  it("regular receipt uses stable separate identity", async () => {
    state.invoice = INV_PAID;
    (prismaModule as any).prisma.messageLog.findFirst.mockResolvedValue(null);
    const r = await sendReceiptViaWa("t-pro", "inv-2");
    expect(r.ok).toBe(true);
    expect(gatewaySendMock.mock.calls[0][3].idempotencyKey).toBe("aircon:doc-receipt:t-pro:inv-2");
  });

  it("a pre-existing prior receipt blocks ordinary send", async () => {
    state.invoice = INV_PAID;
    (prismaModule as any).prisma.messageLog.findFirst.mockResolvedValue({ id: "ml-prior-r", status: "DELIVERED" });
    const r = await sendReceiptViaWa("t-pro", "inv-2");
    expect(r.alreadyProcessed).toBe(true);
    expect(gatewaySendMock).not.toHaveBeenCalled();
  });

  it("explicit receipt resend uses stable action identity", async () => {
    state.invoice = INV_PAID;
    await sendReceiptViaWa("t-pro", "inv-2", { resendId: "receipt-resend-1" });
    expect(gatewaySendMock.mock.calls[0][3].idempotencyKey).toBe("aircon:doc-receipt:t-pro:inv-2:resend:receipt-resend-1");
  });
});
