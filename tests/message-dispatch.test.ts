import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma + gateway-relay sebelum import service.
const store: { rows: any[] } = { rows: [] };
vi.mock("@/lib/prisma", () => ({
  prisma: {
    messageLog: {
      // Hormati where.status: antrean (QUEUED) vs recovery stale (SENDING).
      findMany: vi.fn(async ({ where }: any = {}) => store.rows.filter((r) => {
        if (r.direction !== "OUTBOUND") return false;
        if (where?.status) return r.status === where.status;
        return true;
      })),
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
const sendCalls: any[] = [];
vi.mock("@/lib/wa/gateway-relay", () => ({
  isGatewayConfigured: vi.fn(async () => gatewayConfigured),
  gatewaySend: vi.fn(async (...args: any[]) => { sendCalls.push(args); return sendResult; }),
}));

import { flushQueuedMessages } from "../src/lib/services/message-dispatch-service";

beforeEach(() => {
  store.rows = [];
  gatewayConfigured = true;
  sendResult = { ok: true, messageId: "gw-1" };
  sendCalls.length = 0;
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

  // REGRESSION (2026-10-25): gateway menolak SESAAT karena kapasitas sesi penuh
  // (SEMPENA, bukan nomor rusak). Menandainya FAILED = pesan hilang permanen,
  // bukan tertunda — pengingat tenant hilang tanpa jejak. Pesan harus KEMBALI
  // ke antrean (QUEUED) agar terkirim begitu slot tersedia.
  // Flag `deferred` dibentuk oleh gateway-relay (klasifikasi error transient).
  it("gateway menolak sementara (deferred) → pesan DIJAGA di antrean, bukan FAILED", async () => {
    sendResult = { ok: false, deferred: true, error: "batas sesi aktif tercapai (60)" };
    store.rows = [{ id: "m1", tenantId: "t1", channel: "WA", direction: "OUTBOUND", status: "QUEUED", toPhone: "628", body: "hi" }];
    const r = await flushQueuedMessages();
    expect(r.failed).toBe(0);
    expect(r.deferred).toBe(1);
    expect(store.rows[0].status).toBe("QUEUED");
  });

  it("kirim gagal permanen (nomor tidak terdaftar) → tetap FAILED", async () => {
    sendResult = { ok: false, error: "nomor tidak terdaftar" };
    store.rows = [{ id: "m1", tenantId: "t1", channel: "WA", direction: "OUTBOUND", status: "QUEUED", toPhone: "628", body: "hi" }];
    const r = await flushQueuedMessages();
    expect(r.failed).toBe(1);
    expect(store.rows[0].status).toBe("FAILED");
  });

  // REGRESSION (2026-10-25): identitas antrean HARUS per-pesan (id baris),
  // BUKAN isi pesan. Tanpa idempotencyKey, gateway memakai isi pesan sebagai
  // kunci dan menyimpannya PERMANEN di durable queue — pengingat dengan teks
  // yang sama ditolak 409 selamanya (bukti live: job SENT 2 Okt memblokir
  // pesan identik pada 25 Okt). Kontrak: kunci = id pesan,Unique per event.
  it("mengirim idempotencyKey per-pesan (id baris), bukan isi pesan", async () => {
    store.rows = [{ id: "m-unik-1", tenantId: "t1", channel: "WA", direction: "OUTBOUND", status: "QUEUED", toPhone: "628", body: "Halo Pak, waktunya servis AC" }];
    await flushQueuedMessages();
    expect(sendCalls.length).toBe(1);
    const opts = sendCalls[0][3];
    expect(opts?.idempotencyKey).toBe("aircon:m-unik-1");
  });

  it("dua pesan berbeda dengan teks sama → kunci BERBEDA (tidak saling blokir)", async () => {
    store.rows = [
      { id: "m-a", tenantId: "t1", channel: "WA", direction: "OUTBOUND", status: "QUEUED", toPhone: "628", body: "teks sama" },
      { id: "m-b", tenantId: "t1", channel: "WA", direction: "OUTBOUND", status: "QUEUED", toPhone: "628", body: "teks sama" },
    ];
    await flushQueuedMessages();
    const keys = sendCalls.map((c) => c[3]?.idempotencyKey);
    expect(keys).toEqual(["aircon:m-a", "aircon:m-b"]);
    expect(new Set(keys).size).toBe(2);
  });
});
