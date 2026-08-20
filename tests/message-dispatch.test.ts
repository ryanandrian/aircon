import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma + gateway-relay sebelum import service.
const store: { rows: any[] } = { rows: [] };
vi.mock("@/lib/prisma", () => ({
  prisma: {
    messageLog: {
      findMany: vi.fn(async () => store.rows.filter((r) => r.status === "QUEUED" && r.direction === "OUTBOUND" && r.channel === "WA")),
      updateMany: vi.fn(async ({ where, data }: any) => {
        const r = store.rows.find((x) => x.id === where.id && x.status === where.status);
        if (!r) return { count: 0 };
        r.status = data.status; return { count: 1 };
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const r = store.rows.find((x) => x.id === where.id);
        if (r) Object.assign(r, data);
        return r;
      }),
    },
  },
}));

let gatewayConfigured = true;
let sendResult: any = { ok: true, messageId: "gw-1" };
vi.mock("@/lib/wa/gateway-relay", () => ({
  isGatewayConfigured: vi.fn(async () => gatewayConfigured),
  gatewaySend: vi.fn(async () => sendResult),
}));

import { flushQueuedMessages } from "../src/lib/services/message-dispatch-service";

beforeEach(() => {
  store.rows = [];
  gatewayConfigured = true;
  sendResult = { ok: true, messageId: "gw-1" };
});

describe("flushQueuedMessages", () => {
  it("gateway belum dikonfigurasi → tak menyentuh antrean", async () => {
    gatewayConfigured = false;
    store.rows = [{ id: "m1", tenantId: "t1", channel: "WA", direction: "OUTBOUND", status: "QUEUED", toPhone: "628", body: "hi" }];
    const r = await flushQueuedMessages();
    expect(r.configured).toBe(false);
    expect(store.rows[0].status).toBe("QUEUED"); // tetap antre
  });

  it("kirim sukses → SENT + gatewayMessageId", async () => {
    store.rows = [{ id: "m1", tenantId: "t1", channel: "WA", direction: "OUTBOUND", status: "QUEUED", toPhone: "628", body: "hi" }];
    const r = await flushQueuedMessages();
    expect(r.sent).toBe(1);
    expect(store.rows[0].status).toBe("SENT");
    expect(store.rows[0].gatewayMessageId).toBe("gw-1");
  });

  it("kirim gagal → FAILED", async () => {
    sendResult = { ok: false, error: "nomor tidak terdaftar" };
    store.rows = [{ id: "m1", tenantId: "t1", channel: "WA", direction: "OUTBOUND", status: "QUEUED", toPhone: "628", body: "hi" }];
    const r = await flushQueuedMessages();
    expect(r.failed).toBe(1);
    expect(store.rows[0].status).toBe("FAILED");
  });

  it("body/toPhone kosong → FAILED tanpa panggil gateway", async () => {
    store.rows = [{ id: "m1", tenantId: "t1", channel: "WA", direction: "OUTBOUND", status: "QUEUED", toPhone: "", body: "" }];
    const r = await flushQueuedMessages();
    expect(r.failed).toBe(1);
    expect(store.rows[0].status).toBe("FAILED");
  });
});
