import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * F5 — Route-level proof untuk jejak pengiriman dokumen manual.
 *
 * Menutup residual SSOT: `sendInvoiceViaWa` / `sendReceiptViaWa` memanggil
 * `gatewaySend` langsung ⇒ dulu tak ada `MessageLog`, jadi tak ada tier bukti
 * di Admin → Notifikasi, tak ada `gatewayMessageId` (callback tak bisa
 * menaikkan status), dan nomor tujuan kosong hilang tanpa jejak.
 *
 * YANG DIKUNCI (level service = level route, sama seperti test F1/F3):
 * 1. Gateway sukses ⇒ baris `MessageLog` SENT + `gatewayMessageId` gateway.
 * 2. Gateway gagal ⇒ baris FAILED (bukan hilang diam-diam).
 * 3. Gateway `deferred` (kill switch / kapasitas) ⇒ SUPPRESSED, bukan FAILED.
 * 4. Gateway `duplicate` (409) ⇒ SENT (pesan identik sudah diterima).
 * 5. Baris TIDAK PERNAH QUEUED ⇒ cron flusher tak akan mengirim ulang.
 * 6. Idempotency key per dokumen ⇒ klik ulang tak jadi dua kiriman.
 * 7. Plan-locked (TRIAL) ⇒ gateway tak dipanggil, tak ada jejak gateway
 *    (fallback wa.me bukan bukti pengiriman gateway).
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
      tenant: {
        findUnique: vi.fn(async () => ({
          plan: state.plan,
          name: "Toko AC",
          bankName: null,
          bankAccountNo: null,
          bankAccountName: null,
        })),
      },
      planConfig: {
        findUnique: vi.fn(async ({ where }: any) => state.planConfigs.get(where?.plan) ?? null),
      },
      invoice: {
        findFirst: vi.fn(async () => state.invoice),
        update: vi.fn(),
      },
      messageLog: { create: messageLogCreate },
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
  id: "inv-1",
  docType: "INVOICE",
  status: "ISSUED",
  number: "INV/2026/0001",
  issueDate: new Date(),
  dueDate: null,
  total: 150000,
  billingCustomerId: null,
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
  gatewaySendMock.mockResolvedValue({ ok: true, messageId: "gw-1" } as any);
});

describe("F5 — jejak pengiriman faktur (level service = level route)", () => {
  it("gateway sukses ⇒ jejak SENT + gatewayMessageId", async () => {
    const r = await sendInvoiceViaWa("t-pro", "inv-1");
    expect(r.ok).toBe(true);
    expect(messageLogCreate).toHaveBeenCalledTimes(1);
    const data = messageLogCreate.mock.calls[0][0].data;
    expect(data.status).toBe("SENT");
    expect(data.gatewayMessageId).toBe("gw-1");
    expect(data.templateKey).toBe("invoice_wa");
    expect(data.customerId).toBe("cu-1");
  });

  it("baris jejak TIDAK QUEUED (cron tak akan kirim ulang)", async () => {
    await sendInvoiceViaWa("t-pro", "inv-1");
    expect(messageLogCreate.mock.calls[0][0].data.status).not.toBe("QUEUED");
    expect(messageLogCreate.mock.calls[0][0].data.status).not.toBe("SENDING");
  });

  it("idempotency key per dokumen ⇒ klik ulang bukan kiriman baru", async () => {
    await sendInvoiceViaWa("t-pro", "inv-1");
    const opts = gatewaySendMock.mock.calls[0][3] as { idempotencyKey?: string };
    expect(opts?.idempotencyKey).toBe("aircon:doc-invoice:t-pro:inv-1");
  });

  it("gateway gagal ⇒ jejak FAILED, bukan hilang diam-diam", async () => {
    gatewaySendMock.mockResolvedValue({ ok: false, error: "gateway down" } as any);
    const r = await sendInvoiceViaWa("t-pro", "inv-1");
    expect(r.ok).toBe(false);
    const data = messageLogCreate.mock.calls[0][0].data;
    expect(data.status).toBe("FAILED");
    expect(data.gatewayMessageId).toBeNull();
  });

  it("gateway deferred (kill switch/kapasitas) ⇒ SUPPRESSED, bukan FAILED", async () => {
    gatewaySendMock.mockResolvedValue({ ok: false, deferred: true, error: "KILL SWITCH WA tenant aktif" } as any);
    await sendInvoiceViaWa("t-pro", "inv-1");
    const data = messageLogCreate.mock.calls[0][0].data;
    expect(data.status).toBe("SUPPRESSED");
    expect(data.suppressedReason).toMatch(/KILL SWITCH/);
  });

  it("gateway duplicate (409) ⇒ SENT (pesan identik sudah diterima)", async () => {
    gatewaySendMock.mockResolvedValue({ ok: false, duplicate: true, messageId: "gw-orig" } as any);
    await sendInvoiceViaWa("t-pro", "inv-1");
    const data = messageLogCreate.mock.calls[0][0].data;
    expect(data.status).toBe("SENT");
    expect(data.gatewayMessageId).toBe("gw-orig");
  });

  it("plan-locked (TRIAL) ⇒ gateway tak dipanggil & tak ada jejak gateway", async () => {
    state.plan = "TRIAL";
    const r = await sendInvoiceViaWa("t-trial", "inv-1");
    expect(r.ok).toBe(false);
    expect(gatewaySendMock).not.toHaveBeenCalled();
    expect(messageLogCreate).not.toHaveBeenCalled();
  });
});

describe("F5 — jejak pengiriman kwitansi", () => {
  it("gateway sukses ⇒ jejak SENT dengan templateKey receipt_wa", async () => {
    state.invoice = INV_PAID;
    const r = await sendReceiptViaWa("t-pro", "inv-2");
    expect(r.ok).toBe(true);
    const data = messageLogCreate.mock.calls[0][0].data;
    expect(data.status).toBe("SENT");
    expect(data.templateKey).toBe("receipt_wa");
    expect(data.gatewayMessageId).toBe("gw-1");
  });

  it("idempotency key kwitansi terpisah dari tagihan", async () => {
    state.invoice = INV_PAID;
    await sendReceiptViaWa("t-pro", "inv-2");
    const opts = gatewaySendMock.mock.calls[0][3] as { idempotencyKey?: string };
    expect(opts?.idempotencyKey).toBe("aircon:doc-receipt:t-pro:inv-2");
  });
});
