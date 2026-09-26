import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma + infra secrets sebelum import route (polanya sama dengan test lain).
type LogRow = {
  id?: string;
  tenantId?: string;
  direction?: string;
  status: string;
  gatewayMessageId?: string;
  toPhone?: string;
  body?: string;
  channel?: string;
  [k: string]: unknown;
};
const store: { rows: LogRow[] } = { rows: [] };
vi.mock("@/lib/prisma", () => ({
  prisma: {
    messageLog: {
      create: vi.fn(async ({ data }: any) => { store.rows.push(data); return data; }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        let n = 0;
        for (const r of store.rows) {
          const match =
            (where.id === undefined || r.id === where.id) &&
            (where.gatewayMessageId === undefined || r.gatewayMessageId === where.gatewayMessageId) &&
            (where.tenantId === undefined || r.tenantId === where.tenantId);
          if (match) { Object.assign(r, data); n++; }
        }
        return { count: n };
      }),
      findFirst: vi.fn(async ({ where }: any) =>
        store.rows.find((r) => r.gatewayMessageId === where.gatewayMessageId && r.tenantId === where.tenantId) ?? null),
    },
  },
}));
vi.mock("@/lib/services/infra-config-service", () => ({
  getInfraSecrets: vi.fn(async () => ({ gatewayKey: null, callbackSecret: "rahasia-123" })),
}));
vi.mock("@/lib/services/platform-notification-service", () => ({
  notifyPlatform: vi.fn(async () => ({})),
}));

import { POST } from "../src/app/api/wa/callback/route";

beforeEach(() => {
  store.rows = [
    { id: "m1", tenantId: "t1", direction: "OUTBOUND", status: "SENT", gatewayMessageId: "gw-1", toPhone: "628", body: "hi" },
    { id: "m2", tenantId: "t1", direction: "OUTBOUND", status: "DELIVERED", gatewayMessageId: "gw-2", toPhone: "628", body: "yo" },
    { id: "m3", tenantId: "t1", direction: "OUTBOUND", status: "READ", gatewayMessageId: "gw-3", toPhone: "628", body: "ok" },
  ];
  vi.clearAllMocks();
});

function req(payload: unknown, secret = "rahasia-123") {
  return new Request("https://app.airconet.id/api/wa/callback", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-callback-secret": secret },
    body: JSON.stringify(payload),
  }) as any;
}

describe("Aircon callback — delivery_status dari gateway", () => {
  it("DELIVERED menaikkan SENT → DELIVERED", async () => {
    const res = await POST(req({ type: "delivery_status", externalId: "t1", messageId: "gw-1", status: "DELIVERED", ack: 2 }));
    expect(res.status).toBe(200);
    expect(store.rows[0].status).toBe("DELIVERED");
  });

  it("READ menaikkan DELIVERED → READ", async () => {
    const res = await POST(req({ type: "delivery_status", externalId: "t1", messageId: "gw-2", status: "READ", ack: 3 }));
    expect(res.status).toBe(200);
    expect(store.rows[1].status).toBe("READ");
  });

  it("out-of-order TIDAK menurunkan status (DELIVERED datang setelah READ)", async () => {
    const res = await POST(req({ type: "delivery_status", externalId: "t1", messageId: "gw-3", status: "DELIVERED", ack: 2 }));
    expect(res.status).toBe(200);
    expect(store.rows[2].status, "status tidak boleh turun").toBe("READ");
  });

  it("duplikat idempotent", async () => {
    // gw-2 seed = DELIVERED. Kirim DELIVERED dua kali → hasil tetap DELIVERED, tak ada efek samping.
    const r1 = await POST(req({ type: "delivery_status", externalId: "t1", messageId: "gw-2", status: "DELIVERED", ack: 2 }));
    expect(r1.status).toBe(200);
    expect(store.rows[1].status).toBe("DELIVERED");
    const r2 = await POST(req({ type: "delivery_status", externalId: "t1", messageId: "gw-2", status: "DELIVERED", ack: 2 }));
    expect(r2.status).toBe(200);
    expect(store.rows[1].status).toBe("DELIVERED");
    // duplikat READ dua kali juga harus naik tepat sekali lalu diam
    const r3 = await POST(req({ type: "delivery_status", externalId: "t1", messageId: "gw-2", status: "READ", ack: 3 }));
    expect(r3.status).toBe(200);
    expect(store.rows[1].status).toBe("READ");
    const r4 = await POST(req({ type: "delivery_status", externalId: "t1", messageId: "gw-2", status: "READ", ack: 3 }));
    expect(r4.status).toBe(200);
    expect(store.rows[1].status).toBe("READ"); // tetap READ, tidak rusak
  });

  it("lifecycle event tidak ditolak (200)", async () => {
    for (const type of ["ready", "authenticating", "qr", "disconnected"]) {
      const res = await POST(req({ type, externalId: "t1" }));
      expect(res.status, `type=${type}`).toBe(200);
    }
  });

  it("secret salah → 401 (auth tetap ditegakkan)", async () => {
    const res = await POST(req({ type: "delivery_status", externalId: "t1", messageId: "gw-1", status: "DELIVERED" }, "salah"));
    expect(res.status).toBe(401);
  });
});
