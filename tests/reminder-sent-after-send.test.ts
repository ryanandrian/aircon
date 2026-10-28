import { describe, it, expect, vi, beforeEach } from "vitest";

// REGRESSION (F3 — pengingat hilang diam-diam).
//
// BUG 1: `sendCustomerReminderWa` menandai `RepeatReminder` = SENT pada saat
//        ANTRE, padahal WA-nya belum dikirim. Bila gateway gagal, MessageLog
//        jadi FAILED tapi reminder tetap SENT -> pengingat hilang tanpa jejak
//        dan `expireDueReminders` membuangnya. Perbaikan: SENT hanya setelah
//        pesan benar-benar terkirim (di flusher).
//
// BUG 2: `reconcileWaPlanSessions` melakukan `continue` saat sesi sudah tak
//        ada, sehingga `waVerifiedPhone` yang tertinggal tak pernah dibersihkan
//        (tenant Basic menyimpan nomor yang tak pernah diverifikasi).

vi.mock("server-only", () => ({}));

const {
  reminderFindMany, assetFindMany, tenantFindUnique, messageLogCreate, repeatUpdateMany,
  assetFindManyDispatch, messageLogUpdate, repeatUpdateManyDispatch,
  messageTemplateFindUnique,
} = vi.hoisted(() => ({
  reminderFindMany: vi.fn(), assetFindMany: vi.fn(), tenantFindUnique: vi.fn(),
  messageLogCreate: vi.fn(), repeatUpdateMany: vi.fn(),
  assetFindManyDispatch: vi.fn(), messageLogUpdate: vi.fn(), repeatUpdateManyDispatch: vi.fn(),
  messageTemplateFindUnique: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    repeatReminder: { findMany: reminderFindMany, updateMany: repeatUpdateMany },
    asset: { findMany: assetFindMany },
    tenant: { findUnique: tenantFindUnique },
    messageLog: { create: messageLogCreate },
    messageTemplate: { findUnique: messageTemplateFindUnique },
    $transaction: async (ops: unknown[]) => Promise.all(ops),
  },
}));

vi.mock("@/lib/wa/gateway", () => ({
  normalizePhone: (x: string) => x,
  renderTemplate: (tpl: string) => tpl,
}));
vi.mock("@/lib/services/customer-card-service", () => ({ getOrCreateCardToken: vi.fn(async () => null) }));
vi.mock("@/lib/unit-code/urls", () => ({ customerCardUrl: () => "https://x/kartu" }));
vi.mock("@/lib/services/customer-service", () => ({ ServiceError: class extends Error {} }));
vi.mock("@/lib/domain/money-loop", () => ({ REPEAT_DEFAULTS: { reminderExpireDays: 14 } }));

import { sendCustomerReminderWa } from "../src/lib/services/reminder-service";

describe("BUG 1 — reminder tak boleh SENT sebelum WA terkirim", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reminderFindMany.mockResolvedValue([
      { id: "r1", assetId: "a1", customerId: "c1" },
    ]);
    assetFindMany.mockResolvedValue([
      { id: "a1", brand: "AC", roomLocation: "Ruang", customer: { id: "c1", name: "Budi", phone: "6281" } },
    ]);
    tenantFindUnique.mockResolvedValue({ name: "CV Test", waDriver: "WEB" });
    messageLogCreate.mockResolvedValue({ id: "m1" });
    messageTemplateFindUnique.mockResolvedValue(null); // pakai default template
    repeatUpdateMany.mockResolvedValue({ count: 1 });
  });

  it("antre WA → reminder TETAP QUEUED (tak ada klaim terkirim)", async () => {
    const r = await sendCustomerReminderWa("t1", "c1", ["r1"]);
    expect(r).toBeTruthy();
    expect(r?.messageLogId).toBe("m1");
    // TIDAK ada update status SENT di tahap antre.
    expect(repeatUpdateMany).not.toHaveBeenCalled();
    // MessageLog dibuat QUEUED.
    const d = messageLogCreate.mock.calls[0][0].data;
    expect(d.status).toBe("QUEUED");
    expect(d.direction).toBe("OUTBOUND");
  });

  it("return menyertakan reminderIds (dipakai flusher untuk menandai SENT nanti)", async () => {
    const r = await sendCustomerReminderWa("t1", "c1", ["r1", "r2"]);
    expect(r?.reminderIds).toEqual(["r1", "r2"]);
  });

  it("reminder tak ada (sudah diproses) → tak ada MessageLog dibuat", async () => {
    reminderFindMany.mockResolvedValue([]);
    const r = await sendCustomerReminderWa("t1", "c1", ["r1"]);
    expect(r).toBeNull();
    expect(messageLogCreate).not.toHaveBeenCalled();
  });
});
