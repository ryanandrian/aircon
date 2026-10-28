import { describe, it, expect, vi, beforeEach } from "vitest";

// REGRESSION (F3 / G30): kill switch WA TENANT -> PELANGGAN.
//
//  - WA dari sesi tenant ditahan saat switch off, dan dikembalikan `deferred`
//    (bukan `ok:false` biasa) supaya antrean MessageLog tetap QUEUED — pesan
//    tak hilang.
//  - Sesi PLATFORM (Aircon -> owner) TIDAK kena switch ini; ia punya switch
//    sendiri (`notifySendEnabled`).
//  - Fail-open: config tak terbaca ⇒ tetap boleh kirim (ditulis di log).

vi.mock("server-only", () => ({}));

const { isWaSendEnabled } = vi.hoisted(() => ({ isWaSendEnabled: vi.fn(async () => true) }));
vi.mock("@/lib/services/infra-config-service", () => ({
  isWaSendEnabled,
  getInfraConfig: vi.fn(async () => ({ waGatewayUrl: "https://gw.test", waGatewayKeyEnc: null })),
  getInfraSecrets: vi.fn(async () => ({ gatewayKey: "k" })),
}));

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));
vi.stubGlobal("fetch", fetchMock);

import { gatewaySendAs, PLATFORM_WA_SESSION } from "../src/lib/wa/gateway-relay";

describe("kill switch WA tenant -> pelanggan (G30)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isWaSendEnabled.mockResolvedValue(true);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ messageId: "gw-1" }),
    });
  });

  it("switch ON → WA tenant terkirim", async () => {
    const r = await gatewaySendAs("tenant-1", "6281234567890", "halo");
    expect(r.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("switch OFF → WA tenant DITAHAN, deferred (antrean tak hilang), tak ada request ke gateway", async () => {
    isWaSendEnabled.mockResolvedValue(false);
    const r = await gatewaySendAs("tenant-1", "6281234567890", "halo");
    expect(r.ok).toBe(false);
    expect(r.deferred).toBe(true);
    expect(r.error).toContain("KILL SWITCH");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sesi PLATFORM tidak kena switch WA tenant (punyanya notifySendEnabled)", async () => {
    isWaSendEnabled.mockResolvedValue(false);
    const r = await gatewaySendAs(PLATFORM_WA_SESSION, "6281234567890", "halo platform");
    expect(r.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
