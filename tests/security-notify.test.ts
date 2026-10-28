import { describe, it, expect, vi, beforeEach } from "vitest";

// REGRESSION (G16 — katalog event keamanan/gangguan).
//
//  - Login staf → owner dapat notifikasi in-app + WA antre (dedupe per-jam).
//  - PIN diubah/reset (owner reset ATAU staf aktivasi undangan) → owner dapat
//    notifikasi dengan nama staf.
//  - Tanpa sesi WA tersambung → WA dilewati, in-app tetap tercatat.
//  - Bug nyata ikut diperbaiki: `lastLoginAt` TIDAK PERNAH ditulis sebelumnya
//    (kolom dibaca sweeper inaktif) → kini diisi saat login/aktivasi.

vi.mock("server-only", () => ({}));

const { tenantFindUnique, tnCreate, mlCreate, templateFindUnique, userUpdate } = vi.hoisted(() => ({
  tenantFindUnique: vi.fn(), tnCreate: vi.fn(), mlCreate: vi.fn(),
  templateFindUnique: vi.fn(), userUpdate: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    tenant: { findUnique: tenantFindUnique },
    tenantNotification: { create: tnCreate },
    messageLog: { create: mlCreate },
    platformTemplate: { findUnique: templateFindUnique },
    user: { update: userUpdate },
  },
}));

import { notifySecurityNewLogin, notifySecurityPinChanged } from "../src/lib/services/security-notify-service";

const TENANT = { id: "t1", name: "CV Aman", waVerifiedPhone: "628990000111", phone: "08123456789" };

describe("G16 — event keamanan ke owner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    templateFindUnique.mockResolvedValue(null);
    tenantFindUnique.mockResolvedValue(TENANT);
    tnCreate.mockResolvedValue({ id: "tn1" });
    mlCreate.mockResolvedValue({ id: "ml1" });
    userUpdate.mockResolvedValue({});
  });

  it("login baru → in-app tercatat + WA antre ke nomor owner; dedupe per-jam", async () => {
    const r = await notifySecurityNewLogin({ tenantId: "t1", actorName: "Sinta" });
    expect(r.inapp).toBe(true);
    expect(r.waQueued).toBe(true);
    const d = tnCreate.mock.calls[0][0].data;
    expect(d.type).toBe("SECURITY_NEW_LOGIN");
    expect(d.body).toContain("CV Aman");
    expect(d.body).toContain("Sinta");
    const w = mlCreate.mock.calls[0][0].data;
    expect(w.toPhone).toBe("628123456789"); // dinormalisasi ke 62xxx
    expect(w.status).toBe("QUEUED");
    // dedupeKey memuat slice jam (YYYY-MM-DDTHH)
    expect(d.dedupeKey).toMatch(/^sec:new_login:.+T\d{2}$/);
  });

  it("PIN reset → tanpa dedupe per-jam (per-kejadian)", async () => {
    await notifySecurityPinChanged({ tenantId: "t1", actorName: "Rudi" });
    const d = tnCreate.mock.calls[0][0].data;
    expect(d.type).toBe("SECURITY_PIN_RESET");
    expect(d.dedupeKey).not.toMatch(/T\d{2}$/);
    expect(d.body).toContain("Rudi");
  });

  it("sesi WA tenant belum sambung → in-app tetap, WA dilewati tanpa error", async () => {
    tenantFindUnique.mockResolvedValue({ ...TENANT, waVerifiedPhone: null });
    const r = await notifySecurityNewLogin({ tenantId: "t1", actorName: "Sinta" });
    expect(r.inapp).toBe(true);
    expect(r.waQueued).toBe(false);
    expect(mlCreate).not.toHaveBeenCalled();
  });

  it("tanpa nomor owner → WA tak antre (SUPPRESSED jalur WA tak dibuat di sini)", async () => {
    tenantFindUnique.mockResolvedValue({ ...TENANT, phone: "" });
    const r = await notifySecurityNewLogin({ tenantId: "t1", actorName: "Sinta" });
    expect(r.waQueued).toBe(false);
    expect(mlCreate).not.toHaveBeenCalled();
  });

  it("tenant tak ditemukan → no-op aman", async () => {
    tenantFindUnique.mockResolvedValue(null);
    const r = await notifySecurityNewLogin({ tenantId: "ghost", actorName: "X" });
    expect(r.inapp).toBe(false);
    expect(r.waQueued).toBe(false);
  });
});