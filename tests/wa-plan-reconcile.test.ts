import { describe, it, expect, vi, beforeEach } from "vitest";

// A3 — Rekonsiliasi sesi non-berhak (sesi bocor).
//
// ATURAN: tenant paket Basic (PlanConfig.autoReminder=false) TIDAK boleh punya
// sesi gateway. 3 sesi TRIAL terbukti hidup (2026-10-13: AC Depok Jaya,
// ADI TEKNIK, Jassa Teknik) — wajib dicabut. Tapi rekonsiliasi harus:
//   - IDEMPOTEN: run kedua → nol tindakan (sesi sudah dihapus);
//   - AMAN-GAGAL per tenant: 1 gagal ≠ membatalkan sisanya;
//   - TIDAK menyentuh tenant berbayar, lumite-platform, campaign:MKT-1.
//
// Sumber "berhak" = PlanConfig.autoReminder (satu-sumber, pola cron).

vi.mock("@/lib/prisma", () => ({
  prisma: {
    tenant: { findMany: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
    planConfig: { findMany: vi.fn() },
  },
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/wa/gateway", () => ({ normalizePhone: (x: string) => x }));
vi.mock("@/lib/wa/gateway-relay", () => ({
  gatewaySessionStatus: vi.fn(),
  gatewayLogoutSession: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { gatewaySessionStatus, gatewayLogoutSession } from "@/lib/wa/gateway-relay";
import { reconcileWaPlanSessions } from "@/lib/services/wa-identity-service";

// vi.mock men-replace modul, tapi tipenya tetap tipe asli → cast ke vi.fn()
// supaya mockImplementation / toHaveBeenCalledWith valid secara tipe.
const gwStatus = vi.mocked(gatewaySessionStatus);
const gwLogout = vi.mocked(gatewayLogoutSession);

/** Data DB: tenant + planConfig sesuai skenario. */
function setDb(tenants: { id: string; plan: string }[], plans: { plan: string; autoReminder: boolean }[]) {
  prisma.tenant.findMany = vi.fn(async () => tenants) as never;
  prisma.planConfig.findMany = vi.fn(async () => plans) as never;
  prisma.tenant.updateMany = vi.fn(async () => ({ count: 0 })) as never;
}

/** Status gateway per tenant (mock). `sesi` = sid yang punya sesi hidup. */
function setGateway(sesi: Map<string, { exists: boolean; ready: boolean; phone: string | null }>) {
  gwStatus.mockImplementation(async (id: string) => {
    const s = sesi.get(id) ?? { exists: false, ready: false, phone: null };
    return { ok: true, ...s, qr: null, authenticating: false, pairing: false, pairingCode: null, pairingPhone: null };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setDb([], []);
  setGateway(new Map());
});

const TRIAL_BOCOR = [
  { id: "tenant-ac-depok", plan: "TRIAL" },
  { id: "tenant-adi-teknik", plan: "TRIAL" },
  { id: "tenant-jassa-teknik", plan: "TRIAL" },
];
const PLAN_ROWS = [
  { plan: "TRIAL", autoReminder: false },
  { plan: "PROFESSIONAL", autoReminder: true },
];

describe("A3 — rekonsiliasi sesi paket Basic", () => {
  it("BUG FIX: sesi SUDAH hilang tapi nomor verifikasi tertinggal → nomor dibersihkan", async () => {
    // Angka live 2026-10-28: tenant Basic "Buana Multi Teknik" punya
    // waVerifiedPhone = 6287878785460, tapi sesi gateway-nya sudah `exists:false`
    // (dilepas saat rules lama). `continue` lama membuat nomor tertingual
    // selamanya → tenant Basic menyimpan nomor yang tak pernah diverifikasi.
    setDb([{ id: "tenant-buana", plan: "TRIAL" }], PLAN_ROWS);
    setGateway(new Map()); // tak ada sesi
    prisma.tenant.updateMany = vi.fn(async () => ({ count: 1 })) as never;

    const r = await reconcileWaPlanSessions();
    expect(r.numbersCleared).toBe(1);
    expect(r.revoked).toBe(0); // tak ada sesi → tak ada yang dicabut
    expect(gatewayLogoutSession).not.toHaveBeenCalled(); // sesi tak ada → tak perlu logout
    expect(prisma.tenant.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "tenant-buana", waVerifiedPhone: { not: null } },
      data: { waVerifiedPhone: null },
    }));
  });

  it("gateway tak terbaca (ok=false) → nomor TIDAK dihapus (aman: sesi mungkin masih hidup)", async () => {
    setDb([{ id: "tenant-x", plan: "TRIAL" }], PLAN_ROWS);
    gwStatus.mockImplementation(async () => ({ ok: false, error: "gateway down" }) as never);
    prisma.tenant.updateMany = vi.fn(async () => ({ count: 1 })) as never;

    const r = await reconcileWaPlanSessions();
    expect(r.revoked).toBe(0);
    expect(prisma.tenant.updateMany).not.toHaveBeenCalled();
    expect(gatewayLogoutSession).not.toHaveBeenCalled();
  });

  it("3 sesi TRIAL bocor → ketiganya logout + nomor verifikasi dibersihkan", async () => {
    setDb(TRIAL_BOCOR, PLAN_ROWS);
    setGateway(new Map(TRIAL_BOCOR.map((t) => [t.id, { exists: true, ready: true, phone: "628111" }])));
    const r = await reconcileWaPlanSessions();
    expect(r.revoked).toBe(3);
    expect(gatewayLogoutSession).toHaveBeenCalledTimes(3);
    expect(gatewayLogoutSession).toHaveBeenCalledWith("tenant-ac-depok");
    expect(gatewayLogoutSession).toHaveBeenCalledWith("tenant-adi-teknik");
    expect(gatewayLogoutSession).toHaveBeenCalledWith("tenant-jassa-teknik");
    // clearVerifiedWaPhone (via updateMany) dipanggil utk ketiganya
    expect(prisma.tenant.updateMany).toHaveBeenCalledTimes(3);
  });

  it("tenant PROFESSIONAL tidak tersentuh (hak mereka dipertahankan)", async () => {
    setDb(
      [{ id: "tenant-prof", plan: "PROFESSIONAL" }, ...TRIAL_BOCOR],
      PLAN_ROWS,
    );
    setGateway(new Map([
      ["tenant-prof", { exists: true, ready: true, phone: "628222" }],
      ...TRIAL_BOCOR.map((t) => [t.id, { exists: true, ready: true, phone: "628333" }] as const),
    ]));
    const r = await reconcileWaPlanSessions();
    expect(r.revoked).toBe(3);
    expect(gatewayLogoutSession).not.toHaveBeenCalledWith("tenant-prof");
  });

  it("IDEMPOTEN: run kedua → nol tindakan (sesi sudah dihapus)", async () => {
    setDb(TRIAL_BOCOR, PLAN_ROWS);
    const sesi = new Map<string, { exists: boolean; ready: boolean; phone: string | null }>(TRIAL_BOCOR.map((t) => [t.id, { exists: true, ready: true, phone: "628111" }]));
    setGateway(sesi);
    const r1 = await reconcileWaPlanSessions();
    expect(r1.revoked).toBe(3);
    // Sesudah logout → sesi hilang dari gateway
    for (const t of TRIAL_BOCOR) sesi.set(t.id, { exists: false, ready: false, phone: null });
    vi.clearAllMocks();
    setGateway(sesi);
    const r2 = await reconcileWaPlanSessions();
    expect(r2.revoked).toBe(0);
    expect(gatewayLogoutSession).not.toHaveBeenCalled();
  });

  it("AMAN-GAGAL per tenant: 1 logout gagal ≠ membatalkan sisanya", async () => {
    setDb(TRIAL_BOCOR, PLAN_ROWS);
    setGateway(new Map(TRIAL_BOCOR.map((t) => [t.id, { exists: true, ready: true, phone: "628111" }])));
    gwLogout.mockImplementation(async (id: string) => {
      if (id === "tenant-adi-teknik") throw new Error("gateway down");
      return { ok: true };
    }) as never;
    const r = await reconcileWaPlanSessions();
    expect(r.revoked).toBe(2);
    expect(r.failed).toBe(1);
    expect(gatewayLogoutSession).toHaveBeenCalledTimes(3); // tetap dicoba semua
  });

  it("tanpa sesi aktif (exists:false) → nol tindakan (skip, bukan panggil logout)", async () => {
    setDb(TRIAL_BOCOR, PLAN_ROWS);
    setGateway(new Map(TRIAL_BOCOR.map((t) => [t.id, { exists: false, ready: false, phone: null }])));
    const r = await reconcileWaPlanSessions();
    expect(r.revoked).toBe(0);
    expect(gatewayLogoutSession).not.toHaveBeenCalled();
  });

  it("plan tanpa baris PlanConfig → TIDAK direkonsiliasi (pola cron: tanpa baris = berhak)", async () => {
    setDb([{ id: "tenant-tanpa-baris", plan: "BUSINESS" }], PLAN_ROWS);
    setGateway(new Map([["tenant-tanpa-baris", { exists: true, ready: true, phone: "628444" }]]));
    const r = await reconcileWaPlanSessions();
    expect(r.revoked).toBe(0);
    expect(gatewayLogoutSession).not.toHaveBeenCalled();
  });
});
