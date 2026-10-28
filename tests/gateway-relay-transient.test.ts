import { describe, it, expect, vi, beforeEach } from "vitest";

// `server-only` hanya ada di build Next (bukan di repo) — mock boundary-nya,
// konvensi yang sama dipakai test lain di repo ini (lihat assignment-action.test.ts).
vi.mock("server-only", () => ({}));

/**
 * REGRESSION (2026-10-25) — klasifikasi error TRANSIENT di gateway-relay.
 *
 * Gateway menolak SESAAT (kapasitas sesi penuh / tekanan memori / karantina
 * sementara). Kalau consumer menandainya FAILED, pesan hilang permanen.
 * `deferred: true` memberi sinyal "tahan, jangan tandai gagal".
 *
 * Error PERMANEN (nomor tidak terdaftar, kredensial salah) TETAP tanpa
 * `deferred` — supaya consumer menandainya FAILED dan tidak jadi antrean
 * penuh pesan yang tak akan pernah terkirim.
 */

// Mock fetch global supaya relay tidak menyentuh jaringan.
const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

vi.mock("@/lib/services/infra-config-service", () => ({
  getInfraConfig: vi.fn(async () => ({ waGatewayUrl: "https://gw.example.test" })),
  getInfraSecrets: vi.fn(async () => ({ gatewayKey: "test-key" })),
  // Kill switch WA tenant (G30) — default aktif agar tes fokus pada klasifikasi.
  isWaSendEnabled: vi.fn(async () => true),
}));

vi.mock("@/lib/wa/gateway", () => ({
  blockedSendReason: vi.fn(() => null),
}));

import { gatewaySendAs } from "../src/lib/wa/gateway-relay";

beforeEach(() => {
  fetchMock.mockReset();
});

function reply(status: number, body: unknown) {
  fetchMock.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

describe("gatewaySendAs — klasifikasi transient vs permanen", () => {
  it("kapasitas sesi penuh → deferred (pesan ditahan, bukan hilang)", async () => {
    reply(500, { ok: false, error: "batas sesi aktif tercapai (60)" });
    const r = await gatewaySendAs("t1", "628123456789", "hai");
    expect(r.ok).toBe(false);
    expect(r.deferred).toBe(true);
  });

  it("tekanan memori → deferred", async () => {
    reply(500, { ok: false, error: "tekanan memori (psi-some-12.4) — init baru ditahan 15000ms" });
    const r = await gatewaySendAs("t1", "628123456789", "hai");
    expect(r.deferred).toBe(true);
  });

  it("sesi dikarantina sementara → deferred", async () => {
    reply(500, { ok: false, error: "sesi dikarantina sampai 2026-10-25T22:00:00.000Z (sementara)" });
    const r = await gatewaySendAs("t1", "628123456789", "hai");
    expect(r.deferred).toBe(true);
  });

  it("nomor tidak terdaftar → PERMANEN (tanpa deferred)", async () => {
    reply(500, { ok: false, error: "nomor tidak terdaftar di WhatsApp" });
    const r = await gatewaySendAs("t1", "628123456789", "hai");
    expect(r.ok).toBe(false);
    expect(r.deferred).toBeUndefined();
  });

  it("kredensial tidak sah → PERMANEN (tanpa deferred)", async () => {
    reply(401, { ok: false, error: "kredensial tidak sah" });
    const r = await gatewaySendAs("t1", "628123456789", "hai");
    expect(r.deferred).toBeUndefined();
  });

  it("sukses → ok tanpa deferred", async () => {
    reply(200, { ok: true, messageId: "job-1" });
    const r = await gatewaySendAs("t1", "628123456789", "hai");
    expect(r.ok).toBe(true);
    expect(r.messageId).toBe("job-1");
    expect(r.deferred).toBeUndefined();
  });

  it("409 dedup → duplicate, bukan deferred", async () => {
    reply(409, { ok: false, duplicate: true, error: "pesan identik baru saja diantre (dedup)", messageId: "job-old" });
    const r = await gatewaySendAs("t1", "628123456789", "hai");
    expect(r.duplicate).toBe(true);
    expect(r.messageId).toBe("job-old");
    expect(r.deferred).toBeUndefined();
  });
});
