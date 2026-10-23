import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// 409 DUPLICATE BUKAN KEGAGALAN — ia berarti "pesan identik SUDAH terkirim"
//
// Insiden 2026-10-23 (bukti log nginx, bukan dugaan):
//   14:54:18  POST /v1/wa/send → 200   (job 1792742058165-244, SENT ke 6281319150260)
//   16:57:58  POST /v1/wa/send → 409
//   16:58:15  POST /v1/wa/send → 409
//   17:01:06  POST /v1/wa/send → 409
//   17:02:04  POST /v1/wa/send → 409
//
// Dispatcher aircon memperlakukan 409 sebagai kegagalan (res.ok === false) →
// baris PlatformNotification diputar QUEUED → SENDING → QUEUED … sampai
// MAX_ATTEMPTS=3, lalu FAILED. Padahal pesannya benar-benar sudah sampai.
// Akibatnya kartu admin "Gagal" naik untuk pesan yang SEHARUSNYA dihitung
// terkirim, dan "Antre" berputar sia-sia (gateway akan selalu menjawab 409
// selama job padanannya masih ada).
//
// Kontrak gateway (server.js POST /v1/wa/send):
//   409 { ok:false, error:"pesan identik baru saja diantre (dedup)",
//         duplicate:true, messageId:"<job yang sudah terkirim>" }
//
// Perbaikan: dua lapisan — (a) relay meneruskan `duplicate`, (b) dispatcher
// menandai SENT dengan gatewayMessageId dari job yang nyata-terkirim.
// ---------------------------------------------------------------------------

vi.mock("server-only", () => ({}));

// `resolve()` mengambil konfigurasi dari InfraConfig (DB). Tanpa mock ini test
// gagal menyentuh database — yang bukan topik uji di sini.
vi.mock("@/lib/services/infra-config-service", () => ({
  getInfraConfig: async () => ({ waGatewayUrl: "https://gw.test" }),
  getInfraSecrets: async () => ({ gatewayKey: "kunci-uji" }),
}));

describe("gatewaySendAs — meneruskan penanda duplikat dari kontrak 409", () => {
  beforeEach(() => vi.resetModules());

  it("mengembalikan duplicate=true + messageId ketika gateway menjawab 409", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({
        ok: false,
        error: "pesan identik baru saja diantre (dedup)",
        duplicate: true,
        messageId: "1792742058165-244",
      }),
    }));
    const { gatewaySendAs } = await import("../src/lib/wa/gateway-relay");

    const r = await gatewaySendAs("lumite-platform", "6281319150260", "Halo");

    expect(r.ok).toBe(false);
    expect(r.duplicate).toBe(true);
    // messageId WAJIB ikut terbawa — ia satu-satunya cara menandai baris sebagai
    // benar-terkirim, karena dialah job yang mengirimkannya (14:54).
    expect(r.messageId).toBe("1792742058165-244");
  });

  it("TETAP mengembalikan error untuk kegagalan non-duplikat (400/401/500)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ ok: false, error: "gateway bermasalah" }),
    }));
    const { gatewaySendAs } = await import("../src/lib/wa/gateway-relay");

    const r = await gatewaySendAs("lumite-platform", "6281319150260", "Halo");

    expect(r.ok).toBe(false);
    expect(r.duplicate).toBeFalsy();
    expect(r.error).toContain("gateway bermasalah");
  });

  it("balasan sukses 200 tidak menyalakan penanda duplikat", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, messageId: "job-baru" }),
    }));
    const { gatewaySendAs } = await import("../src/lib/wa/gateway-relay");

    const r = await gatewaySendAs("lumite-platform", "6281319150260", "Halo");

    expect(r.ok).toBe(true);
    expect(r.duplicate).toBeFalsy();
    expect(r.messageId).toBe("job-baru");
  });
});

// ---------------------------------------------------------------------------
// KUNCI IDEMPOTENSI DIMILIKI PEMANGGIL
//
// Tanpa kunci, gateway menurunkannya dari ISI PESAN
// (gateway-engine delivery-contract.js:54 → `legacy:<app>:<nomor>:<teks>`),
// sehingga dua notifikasi BERBEDA yang kebetulan berteks sama dianggap
// duplikat dan yang kedua DITEKAN — penerimanya tidak pernah menerimanya.
// ---------------------------------------------------------------------------

describe("gatewaySendAs — meneruskan idempotencyKey milik pemanggil", () => {
  beforeEach(() => vi.resetModules());

  it("mengirim idempotencyKey bila diberikan", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => ({ ok: true, messageId: "j1" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { gatewaySendAs } = await import("../src/lib/wa/gateway-relay");

    await gatewaySendAs("lumite-platform", "6281319150260", "Halo",
      { idempotencyKey: "subscription_due:jaya-mandiri:20261023" });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.idempotencyKey).toBe("subscription_due:jaya-mandiri:20261023");
    expect(body.message).toBe("Halo");
  });

  it("TANPA kunci payloadnya bersih (gateway boleh menurunkan sendiri)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => ({ ok: true, messageId: "j2" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { gatewaySendAs } = await import("../src/lib/wa/gateway-relay");

    await gatewaySendAs("lumite-platform", "6281319150260", "Halo");

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect("idempotencyKey" in body).toBe(false);
  });
});
