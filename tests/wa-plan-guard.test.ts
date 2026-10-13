import { describe, it, expect, vi, beforeEach } from "vitest";

// A1 — Guard plan otomasi WA (server-side).
//
// ATURAN PRODUK: paket Basic (enum DB: TRIAL) TIDAK memakai otomasi WA
// (koneksi sesi gateway). Pengingat tetap lewat menu Pengingat (wa.me,
// WA milik admin sendiri) — jalur itu TIDAK disentuh guard ini.
//
// JANGAN hardcode daftar plan. Sumber keputusan = PlanConfig.autoReminder,
// sama persis dengan guard cron reminder-service.ts:161:
//     eligible = !planConfigs.some(p => p.plan === t.plan) || automaticPlans.has(t.plan)
//   - plan TIDAK punya baris PlanConfig  -> lolos (fallback additive — pola cron)
//   - baris ada & autoReminder=false     -> DITOLAK
//   - baris ada & autoReminder=true      -> lolos
// Ini menjamin plan baru (mis. "BASIC" ditambahkan ke enum) otomatis tercakup
// selama admin mengisi PlanConfig — guard tak pernah diubah lagi.

vi.mock("@/lib/prisma", () => ({ prisma: { tenant: { findUnique: vi.fn() }, planConfig: { findUnique: vi.fn() } } }));
// `server-only` (alias Next) tak ter-resolve Vitest — mock boundary-nya (pola repo:
// tests/worksession.test.ts, tests/customer-import-live.test.ts).
// GUARD BARU ada di wa-identity-service → sengaja TIDAK di-mock supaya
// logic-nya benar-benar teruji, bukan mock-nya.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/storage/s3", () => ({ putTenantAsset: vi.fn() }));
vi.mock("@/lib/services/tenant-profile-service", () => ({ updateTenantProfile: vi.fn() }));
vi.mock("@/lib/validation/tenant-profile", () => ({ tenantProfileSchema: { safeParse: () => ({ success: false }) } }));
vi.mock("@/lib/services/customer-service", () => ({ ServiceError: class extends Error {} }));
vi.mock("@/lib/wa/gateway-relay", () => ({
  gatewayInitSession: vi.fn(async () => ({ ok: true, qr: "QR_PALSU" })),
  gatewayPairSession: vi.fn(async () => ({ ok: true, pairingCode: "123-456" })),
  gatewayCancelPairSession: vi.fn(async () => ({ ok: true })),
  gatewaySessionStatus: vi.fn(async () => ({ ok: true, exists: false, ready: false, qr: null, phone: null, pairing: false, pairingCode: null, pairingPhone: null })),
  gatewayLogoutSession: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/auth/context", () => ({
  tryGetServerContext: vi.fn(async () => ({ tenantId: "tenant-uji", role: "OWNER" })),
}));

import { prisma } from "@/lib/prisma";
import { gatewayInitSession, gatewayPairSession, gatewaySessionStatus } from "@/lib/wa/gateway-relay";
import { actionWaInit, actionWaPair, actionWaStatus } from "@/app/app/pengaturan/actions";

/** Setel isi mock Prisma untuk skenario tertentu. */
function setDb({ tenantPlan, planRow }: { tenantPlan: string | null; planRow: { plan: string; autoReminder: boolean } | null }) {
  prisma.tenant.findUnique = vi.fn(async () => (tenantPlan === null ? null : { id: "tenant-uji", plan: tenantPlan })) as never;
  prisma.planConfig.findUnique = vi.fn(async (q: { where: { plan: string } }) =>
    planRow && planRow.plan === q.where.plan ? planRow : null) as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  setDb({ tenantPlan: null, planRow: null });
});

describe("A1 — guard server action: paket Basic (TRIAL) tidak boleh koneksi otomasi WA", () => {
  it("TRIAL + autoReminder=false → actionWaInit DITOLAK, gateway TIDAK dipanggil", async () => {
    setDb({ tenantPlan: "TRIAL", planRow: { plan: "TRIAL", autoReminder: false } });
    const r = await actionWaInit();
    expect(r.ok).toBe(false);
    expect(r.planLocked).toBe(true);
    expect(typeof r.error).toBe("string");
    expect(gatewayInitSession).not.toHaveBeenCalled();
  });

  it("TRIAL → actionWaPair (kode tautan) juga DITOLAK, gateway TIDAK dipanggil", async () => {
    setDb({ tenantPlan: "TRIAL", planRow: { plan: "TRIAL", autoReminder: false } });
    const r = await actionWaPair("6281234567890");
    expect(r.ok).toBe(false);
    expect(r.planLocked).toBe(true);
    expect(gatewayPairSession).not.toHaveBeenCalled();
  });

  it("TRIAL → actionWaStatus balas planLocked (UI berhenti polling, bukan error aneh)", async () => {
    setDb({ tenantPlan: "TRIAL", planRow: { plan: "TRIAL", autoReminder: false } });
    const r = await actionWaStatus();
    expect(r.ok).toBe(false);
    expect(r.planLocked).toBe(true);
    expect(gatewaySessionStatus).not.toHaveBeenCalled();
    // Bentuk balasan harus tetap kompatibel pemakaian UI lama:
    expect(r.exists).toBe(false);
    expect(r.ready).toBe(false);
    expect(r.qr).toBeNull();
  });

  it("PROFESSIONAL + autoReminder=true → lolos ke relay (perilaku lama dipertahankan)", async () => {
    setDb({ tenantPlan: "PROFESSIONAL", planRow: { plan: "PROFESSIONAL", autoReminder: true } });
    const r = await actionWaInit();
    expect(r.ok).toBe(true);
    expect(gatewayInitSession).toHaveBeenCalledTimes(1);
    expect(r.planLocked).toBeUndefined();
  });

  it("BUSINESS + autoReminder=true → lolos (kedua paket berbayar aman)", async () => {
    setDb({ tenantPlan: "BUSINESS", planRow: { plan: "BUSINESS", autoReminder: true } });
    const r = await actionWaInit();
    expect(r.ok).toBe(true);
    expect(gatewayInitSession).toHaveBeenCalledTimes(1);
  });

  it("POLA CRON (additive): plan TANPA baris PlanConfig → TETAP lolos, bukan ditolak senyap", async () => {
    // Meniru reminder-service.ts:161 — tanpa baris = dianggap eligible.
    setDb({ tenantPlan: "BUSINESS", planRow: null });
    const r = await actionWaInit();
    expect(r.ok).toBe(true);
    expect(gatewayInitSession).toHaveBeenCalledTimes(1);
  });

  it("plan BARU dengan autoReminder=false → terkunci TANPA mengubah kode guard (satu-sumber PlanConfig)", async () => {
    // Membuktikan: tidak ada hardcode daftar plan di guard.
    setDb({ tenantPlan: "TRIAL", planRow: { plan: "TRIAL", autoReminder: false } });
    const r1 = await actionWaInit();
    expect(r1.ok).toBe(false);

    // Admin mengaktifkan paket itu di DB → langsung berlaku, tanpa deploy.
    setDb({ tenantPlan: "TRIAL", planRow: { plan: "TRIAL", autoReminder: true } });
    const r2 = await actionWaInit();
    expect(r2.ok).toBe(true);
    expect(gatewayInitSession).toHaveBeenCalledTimes(1);
  });

  it("tenant tidak ditemukan → ditolak aman (bukan lolos senyap)", async () => {
    setDb({ tenantPlan: null, planRow: null });
    const r = await actionWaInit();
    expect(r.ok).toBe(false);
    expect(gatewayInitSession).not.toHaveBeenCalled();
  });
});
