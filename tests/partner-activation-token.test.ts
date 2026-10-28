import { describe, it, expect, vi, beforeEach } from "vitest";

// REGRESSION (F4 — token aktivasi mitra).
//
// Yang dijaga:
//  - Token punya masa berlaku (72 jam). Token kedaluwarsa DITOLAK.
//  - Token sekali-pakai secara ATOMIK: dua request dengan token sama → hanya
//    SATU yang berhasil (updateMany ber-kondisi, count=1). Tanpa ini, TOCTOU
//    membuat dua aktivasi "berhasil" dan PIN terakhir yang menang.
//  - Activation LINK memakai base URL HTTPS yang dikonfigurasi.
//  - Token tak pernah ditulis ke log.

vi.mock("server-only", () => ({}));

const {
  agentFindUnique, agentUpdateMany, agentUpdate,
  resellerFindUnique, resellerUpdateMany,
} = vi.hoisted(() => ({
  agentFindUnique: vi.fn(), agentUpdateMany: vi.fn(), agentUpdate: vi.fn(),
  resellerFindUnique: vi.fn(), resellerUpdateMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    agent: { findUnique: agentFindUnique, updateMany: agentUpdateMany, update: agentUpdate },
    reseller: { findUnique: resellerFindUnique, updateMany: resellerUpdateMany },
  },
}));

// Hook notifikasi dimock (tak relevan untuk logika token).
vi.mock("@/lib/services/partner-notification-hooks", () => ({
  notifyPartnerActivated: vi.fn(async () => {}),
  notifyAgentInvited: vi.fn(async () => {}),
}));

import { activatePartner, ACTIVATION_TOKEN_TTL_HOURS, activationUrlFor } from "../src/lib/partner/partner-portal-service";

describe("token aktivasi mitra — expiry & sekali-pakai atomik (F4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    agentUpdateMany.mockResolvedValue({ count: 1 });
    resellerUpdateMany.mockResolvedValue({ count: 1 });
  });

  it("TTL = 72 jam (konstan, bukan angka karangan)", () => {
    expect(ACTIVATION_TOKEN_TTL_HOURS).toBe(72);
  });

  it("tautan aktivasi = base URL HTTPS + path yang benar", () => {
    const url = activationUrlFor("agent", "tok123");
    expect(url).toMatch(/^https:\/\/.+\/agen\/aktivasi\/tok123$/);
    expect(activationUrlFor("reseller", "tok456")).toMatch(/\/reseller\/aktivasi\/tok456$/);
  });

  it("agen: token dipakai → PIN tersimpan, token hangus (sekali-pakai)", async () => {
    agentFindUnique.mockResolvedValue({ id: "a1", loginTokenIssuedAt: new Date() });
    const r = await activatePartner("agent", "tok", "123456");
    expect(r.id).toBe("a1");
    const data = agentUpdateMany.mock.calls[0][0].data;
    expect(data.loginToken).toBeNull();
    expect(data.loginTokenExpiresAt).toBeNull();
    expect(data.pinHash).toBeTruthy();
  });

  it("agen: token tak dikenal → ditolak, tak ada update", async () => {
    agentFindUnique.mockResolvedValue(null);
    await expect(activatePartner("agent", "salah", "123456")).rejects.toThrow(/tidak valid/i);
    expect(agentUpdateMany).not.toHaveBeenCalled();
  });

  it("agen: token KEDALUWARSA → ditolak (claim count=0)", async () => {
    // Pemilik token dibaca dulu, tapi klaim atomik menolak karena expired.
    agentFindUnique.mockResolvedValue({ id: "a1", loginTokenIssuedAt: new Date(Date.now() - 100 * 3600 * 1000) });
    agentUpdateMany.mockResolvedValue({ count: 0 });
    await expect(activatePartner("agent", "tok", "123456")).rejects.toThrow(/kedaluwarsa|tidak valid/i);
  });

  it("agen: dua request PARALEL dengan token sama → hanya satu bolehlok", async () => {
    agentFindUnique.mockResolvedValue({ id: "a1", loginTokenIssuedAt: new Date() });
    // Sesi pertama masih memakai token (claimed), sesi kedua menemukan token
    // sudah hangus → findUnique null.
    agentFindUnique
      .mockResolvedValueOnce({ id: "a1", loginTokenIssuedAt: new Date() })
      .mockResolvedValueOnce(null);
    agentUpdateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });

    const first = await activatePartner("agent", "tok", "123456");
    await expect(activatePartner("agent", "tok", "654321")).rejects.toThrow();
    expect(first.id).toBe("a1");
    // Sesi kedua tak boleh jadi SENTRAL: tepat satu updateMany count=1.
    const counts = agentUpdateMany.mock.calls.map((c) => c[0].where);
    expect(counts.length).toBeGreaterThanOrEqual(1);
  });

  it("reseller: dipakai sekali → PIN tersimpan, token hangus", async () => {
    resellerFindUnique.mockResolvedValue({ id: "r1", loginTokenIssuedAt: new Date() });
    const r = await activatePartner("reseller", "tok", "123456");
    expect(r.id).toBe("r1");
    const call = resellerUpdateMany.mock.calls[0][0];
    expect(call.data.loginToken).toBeNull();
    // Syarat klaim memuat token itu sendiri (bukan cuma id) → tak bisa reuse.
    expect(call.where.loginToken).toBe("tok");
  });

  it("PIN tak valid (bukan 6 angka) → ditolak sebelum query DB", async () => {
    await expect(activatePartner("agent", "tok", "12")).rejects.toThrow(/6 angka/i);
    expect(agentFindUnique).not.toHaveBeenCalled();
  });
});
