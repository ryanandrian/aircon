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
const mockPlatformStore: { rows: any[] } = { rows: [] };
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
    platformNotification: {
      findFirst: vi.fn(async ({ where }: any) =>
        mockPlatformStore.rows.find((r: any) => r.gatewayMessageId === where.gatewayMessageId) ?? null),
      updateMany: vi.fn(async ({ where, data }: any) => {
        let n = 0;
        for (const r of mockPlatformStore.rows) {
          if ((where.gatewayMessageId === undefined || r.gatewayMessageId === where.gatewayMessageId) &&
              (where.channel === undefined || r.channel === where.channel)) {
            Object.assign(r, data); n++;
          }
        }
        return { count: n };
      }),
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
    { id: "m3", tenantId: "t1", direction: "OUTBOUND", status: "READ_CONFIRMED", gatewayMessageId: "gw-3", toPhone: "628", body: "ok" },
  ];
  // Notifikasi platform (sesi "lumite-platform") — butuh callback agar statusnya naik.
  mockPlatformStore.rows = [
    { id: "pn-wa", tenantId: "t-abc", channel: "WA", status: "SENT", gatewayMessageId: "pgw-1", toAddress: "628" },
    { id: "pn-mail", tenantId: "t-abc", channel: "EMAIL", status: "SENT", gatewayMessageId: "pgw-2", toAddress: "a@b.c" },
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

  it("READ_CONFIRMED menaikkan DELIVERED → READ_CONFIRMED", async () => {
    const res = await POST(req({ type: "delivery_status", externalId: "t1", messageId: "gw-2", status: "READ_CONFIRMED", ack: 3 }));
    expect(res.status).toBe(200);
    expect(store.rows[1].status).toBe("READ_CONFIRMED");
  });

  it("out-of-order TIDAK menurunkan status (DELIVERED datang setelah READ)", async () => {
    const res = await POST(req({ type: "delivery_status", externalId: "t1", messageId: "gw-3", status: "DELIVERED", ack: 2 }));
    expect(res.status).toBe(200);
    expect(store.rows[2].status, "status tidak boleh turun").toBe("READ_CONFIRMED");
  });

  it("duplikat idempotent", async () => {
    // gw-2 seed = DELIVERED. Kirim DELIVERED dua kali → hasil tetap DELIVERED, tak ada efek samping.
    const r1 = await POST(req({ type: "delivery_status", externalId: "t1", messageId: "gw-2", status: "DELIVERED", ack: 2 }));
    expect(r1.status).toBe(200);
    expect(store.rows[1].status).toBe("DELIVERED");
    const r2 = await POST(req({ type: "delivery_status", externalId: "t1", messageId: "gw-2", status: "DELIVERED", ack: 2 }));
    expect(r2.status).toBe(200);
    expect(store.rows[1].status).toBe("DELIVERED");
    // duplikat READ_CONFIRMED dua kali juga harus naik tepat sekali lalu diam
    const r3 = await POST(req({ type: "delivery_status", externalId: "t1", messageId: "gw-2", status: "READ_CONFIRMED", ack: 3 }));
    expect(r3.status).toBe(200);
    expect(store.rows[1].status).toBe("READ_CONFIRMED");
    const r4 = await POST(req({ type: "delivery_status", externalId: "t1", messageId: "gw-2", status: "READ_CONFIRMED", ack: 3 }));
    expect(r4.status).toBe(200);
    expect(store.rows[1].status).toBe("READ_CONFIRMED"); // tetap, tidak rusak
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

// REGRESSION (2026-10-26): notifikasi PLATFORM (sesi "lumite-platform") harus
// ikut naik statusnya dari callback yang sama. Sebelumnya callback hanya
// memperbarui `messageLog`, sehingga notifikasi platform terkirim lewat sesi
// platform SELALU "SENT" walau gateway sudah DELIVERED/READ_CONFIRMED.
// Bukti live: job 1793026292127-87 READ_CONFIRMED di gateway, baris
// PlatformNotification-nya tetap SENT.
describe("Aircon callback — notifikasi platform naik status", () => {
  it("DELIVERED menaikkan notifikasi platform SENT → DELIVERED", async () => {
    const res = await POST(req({
      type: "delivery_status", externalId: "lumite-platform",
      messageId: "pgw-1", status: "DELIVERED", ack: 2,
    }));
    expect(res.status).toBe(200);
    expect(mockPlatformStore.rows[0].status).toBe("DELIVERED");
  });

  it("READ_CONFIRMED menaikkan notifikasi platform → READ_CONFIRMED", async () => {
    await POST(req({
      type: "delivery_status", externalId: "lumite-platform",
      messageId: "pgw-1", status: "READ_CONFIRMED", ack: 3,
    }));
    expect(mockPlatformStore.rows[0].status).toBe("READ_CONFIRMED");
  });

  it("status tidak MENURUN (out-of-order: DELIVERED setelah READ)", async () => {
    await POST(req({
      type: "delivery_status", externalId: "lumite-platform",
      messageId: "pgw-1", status: "READ_CONFIRMED", ack: 3,
    }));
    await POST(req({
      type: "delivery_status", externalId: "lumite-platform",
      messageId: "pgw-1", status: "DELIVERED", ack: 2,
    }));
    expect(mockPlatformStore.rows[0].status, "status tidak boleh turun").toBe("READ_CONFIRMED");
  });

  it("notifikasi EMAIL tidak disentuh (email tak punya ACK WhatsApp)", async () => {
    await POST(req({
      type: "delivery_status", externalId: "lumite-platform",
      messageId: "pgw-2", status: "DELIVERED", ack: 2,
    }));
    expect(mockPlatformStore.rows[1].status).toBe("SENT");
  });

  it("sesi tenant biasa TIDAK menyentuh notifikasi platform", async () => {
    await POST(req({ type: "delivery_status", externalId: "t1", messageId: "pgw-1", status: "DELIVERED", ack: 2 }));
    expect(mockPlatformStore.rows[0].status).toBe("SENT");
  });
});
