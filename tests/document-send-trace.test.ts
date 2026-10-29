import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
const { messageLogCreate } = vi.hoisted(() => ({ messageLogCreate: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { messageLog: { create: messageLogCreate } },
}));
import { traceDocumentSend } from "@/lib/services/document-send-trace-service";

beforeEach(() => {
  vi.clearAllMocks();
  messageLogCreate.mockResolvedValue({ id: "ml-1" });
});

describe("F5 — jejak pengiriman dokumen manual", () => {
  it("gateway success ⇒ SENT + gatewayMessageId + correlation fields", async () => {
    const r = await traceDocumentSend(
      { tenantId: "t1", kind: "invoice", toPhone: "628123", body: "INV/1", customerId: "cu-1" },
      { result: "sent", gatewayMessageId: "gw-9" },
    );
    expect(r).toMatchObject({ traced: true, messageLogId: "ml-1" });
    const data = messageLogCreate.mock.calls[0][0].data;
    expect(data.status).toBe("SENT");
    expect(data.gatewayMessageId).toBe("gw-9");
    expect(data.templateKey).toBe("invoice_wa");
    expect(data.channel).toBe("WA");
    expect(data.direction).toBe("OUTBOUND");
    expect(data.customerId).toBe("cu-1");
  });

  it("gateway failure ⇒ FAILED (not silently omitted)", async () => {
    await traceDocumentSend(
      { tenantId: "t1", kind: "receipt", toPhone: "628123", body: "KWITANSI/1" },
      { result: "failed", error: "gateway down" },
    );
    const data = messageLogCreate.mock.calls[0][0].data;
    expect(data.status).toBe("FAILED");
    expect(data.gatewayMessageId).toBeNull();
    expect(data.templateKey).toBe("receipt_wa");
  });

  it("blank recipient ⇒ SUPPRESSED + reason, not FAILED", async () => {
    await traceDocumentSend(
      { tenantId: "t1", kind: "invoice", toPhone: "   ", body: "INV/1" },
      { result: "sent", gatewayMessageId: "gw-9" },
    );
    const data = messageLogCreate.mock.calls[0][0].data;
    expect(data.status).toBe("SUPPRESSED");
    expect(data.toPhone).toBeNull();
    expect(data.suppressedReason).toMatch(/kosong/i);
    expect(data.gatewayMessageId).toBeNull();
  });

  it("gateway deferred/kill switch ⇒ SUPPRESSED, not FAILED and never queued", async () => {
    await traceDocumentSend(
      { tenantId: "t1", kind: "techInvite", toPhone: "628123", body: "undangan" },
      { result: "held", error: "KILL SWITCH WA tenant aktif" },
    );
    const data = messageLogCreate.mock.calls[0][0].data;
    expect(data.status).toBe("SUPPRESSED");
    expect(data.suppressedReason).toMatch(/KILL SWITCH/);
    expect(data.status).not.toBe("QUEUED");
    expect(data.templateKey).toBe("tech_invite_wa");
  });

  it("duplicate idempotency response can be represented as SENT evidence", async () => {
    await traceDocumentSend(
      { tenantId: "t1", kind: "invoice", toPhone: "628123", body: "INV/1" },
      { result: "sent", gatewayMessageId: "original-gw-id" },
    );
    const data = messageLogCreate.mock.calls[0][0].data;
    expect(data.status).toBe("SENT");
    expect(data.gatewayMessageId).toBe("original-gw-id");
  });

  it("never records QUEUED (avoids cron resending manual message)", async () => {
    await traceDocumentSend(
      { tenantId: "t1", kind: "techInvite", toPhone: "628123", body: "undangan" },
      { result: "sent", gatewayMessageId: "gw-1" },
    );
    expect(messageLogCreate.mock.calls[0][0].data.status).not.toBe("QUEUED");
    expect(messageLogCreate.mock.calls[0][0].data.status).not.toBe("SENDING");
  });

  it("database trace failure doesn't throw after provider send", async () => {
    messageLogCreate.mockRejectedValueOnce(new Error("db down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await traceDocumentSend(
      { tenantId: "t1", kind: "invoice", toPhone: "628123", body: "INV/1" },
      { result: "sent", gatewayMessageId: "gw-9" },
    );
    expect(r.traced).toBe(false);
    expect(r.reason).toMatch(/db down/);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
