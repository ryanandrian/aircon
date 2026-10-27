import { describe, it, expect, vi, beforeEach } from "vitest";

// REGRESSION (audit 2026-10-27, F2/G6): event sesi WhatsApp hanya untuk paket
// dengan otomasi (PlanConfig.autoReminder=true), satu pesan per transisi state
// (dedupe per epoch), dan kenaikan epoch atomik untuk callback paralel.

vi.mock("server-only", () => ({}));

const { tenantFindUnique, tenantUpdateMany, notifyPlatform, isAutoReminderPlan } = vi.hoisted(() => ({
  tenantFindUnique: vi.fn(),
  tenantUpdateMany: vi.fn(),
  notifyPlatform: vi.fn(),
  isAutoReminderPlan: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { tenant: { findUnique: tenantFindUnique, updateMany: tenantUpdateMany } },
}));
vi.mock("@/lib/services/platform-notification-service", () => ({ notifyPlatform, isAutoReminderPlan }));

import { applyWaTransition, waStateFromEpoch } from "../src/lib/services/wa-transition-service";

const PAID_TENANT = { id: "t-pro", plan: "PROFESSIONAL", waSessionEpoch: 0 };
const BASIC_TENANT = { id: "t-basic", plan: "TRIAL", waSessionEpoch: 0 };

describe("waStateFromEpoch", () => {
  it("0=tak diketahui; ganjil=putus; genap≥2=tersambung", () => {
    expect(waStateFromEpoch(0)).toBe("unknown");
    expect(waStateFromEpoch(1)).toBe("disconnected");
    expect(waStateFromEpoch(2)).toBe("connected");
    expect(waStateFromEpoch(3)).toBe("disconnected");
  });
});

describe("applyWaTransition — satu pesan per transisi, epoch paritas benar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tenantFindUnique.mockResolvedValue({ ...PAID_TENANT });
    tenantUpdateMany.mockResolvedValue({ count: 1 });
    notifyPlatform.mockResolvedValue({ created: 1, skipped: [] });
    isAutoReminderPlan.mockResolvedValue(true);
  });

  it("dari tak diketahui → putus: epoch 1, satu pesan wa_disconnected", async () => {
    const r = await applyWaTransition("t-pro", "disconnected");
    expect(r).toMatchObject({ epoch: 1, changed: true });
    expect(notifyPlatform).toHaveBeenCalledTimes(1);
    expect(notifyPlatform).toHaveBeenCalledWith(expect.objectContaining({
      templateKey: "wa_disconnected",
      dedupeKey: "wa:t-pro:DISCONNECTED:1",
    }));
  });

  // Sesional baru dipindai (bukan "kembali" tersambung): state dicatat, tanpa pesan.
  it("dari tak diketahui → tersambung: epoch 2, state tercatat TANPA pesan", async () => {
    const r = await applyWaTransition("t-pro", "connected");
    expect(r).toMatchObject({ epoch: 2, changed: true });
    expect(notifyPlatform).not.toHaveBeenCalled();
    expect(r.skipped).toContain("transisi awal");
    expect(waStateFromEpoch(2)).toBe("connected");
  });

  it("putus → tersambung: epoch 2, pesan wa_connected", async () => {
    tenantFindUnique.mockResolvedValue({ ...PAID_TENANT, waSessionEpoch: 1 });
    const r = await applyWaTransition("t-pro", "connected");
    expect(r).toMatchObject({ epoch: 2, changed: true });
    expect(notifyPlatform).toHaveBeenCalledWith(expect.objectContaining({ templateKey: "wa_connected" }));
  });

  // Gateway memancarkan disconnected berulang → TIDAK boleh jadi banyak pesan.
  it("pengulangan state yang sama tidak menambah epoch & tidak mengirim pesan", async () => {
    tenantFindUnique.mockResolvedValue({ ...PAID_TENANT, waSessionEpoch: 1 });
    const r = await applyWaTransition("t-pro", "disconnected");
    expect(r.changed).toBe(false);
    expect(tenantUpdateMany).not.toHaveBeenCalled();
    expect(notifyPlatform).not.toHaveBeenCalled();
  });

  // Gateway paralel: hanya satu pemegang epoch yang menang.
  it("kalah balapan updateMany (count 0) tidak mengirim pesan", async () => {
    tenantUpdateMany.mockResolvedValue({ count: 0 });
    const r = await applyWaTransition("t-pro", "disconnected");
    expect(r.changed).toBe(false);
    expect(notifyPlatform).not.toHaveBeenCalled();
  });

  // Kebijakan paket: Basic tidak menerima copy "sambungkan ulang".
  it("paket tanpa otomasi (Basic): state tercatat, TANPA pesan", async () => {
    tenantFindUnique.mockResolvedValue({ ...BASIC_TENANT });
    isAutoReminderPlan.mockResolvedValue(false);
    const r = await applyWaTransition("t-basic", "disconnected");
    expect(r).toMatchObject({ epoch: 1, changed: true });
    expect(notifyPlatform).not.toHaveBeenCalled();
    expect(r.skipped).toBe("paket tanpa otomasi WA");
  });

  // Kegagalan antre tidak membatalkan pencatatan state.
  it("notifyPlatform gagal: epoch tetap naik, error dicatat, tak melempar", async () => {
    notifyPlatform.mockRejectedValue(new Error("gateway down"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await applyWaTransition("t-pro", "disconnected");
    expect(r).toMatchObject({ epoch: 1, changed: true });
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});
