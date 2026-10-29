import { describe, it, expect, vi, beforeEach } from "vitest";

// F1 — Guard paket di jalur kirim WA faktur/kwitansi (temuan B-1, KRITIS).
//
// BUKTI MASALAH (audit 2026-10-14): sendInvoiceViaWa & sendReceiptViaWa dipakai
// 4 aksi (admin + teknisi) dan NOL di antaranya memanggil waAutomationEligibility.
// Keputusan pemilik TERKUNCI: tenant TRIAL/BASIC TIDAK boleh mengirim lewat
// WA-GATEWAY (tak punya fasilitas menautkan nomor). Guard ditempatkan di SERVICE
// (titik terendah) supaya TERTUTUP SEMUA rute — bukan hanya satu halaman UI.
//
// Yang DIKUNCI:
// 1. TRIAL  -> dikirim via gateway, dan gatewaySend TIDAK PERNAH dipanggil.
// 2. PROFESSIONAL -> lolos, gatewaySend dipanggil (hak paket terpenuhi).
// 3. Guard berlaku di DUA fungsi (invoice + kwitansi).
// 4. Pesan galat konteks-dokumen (bukan pesan cron Pengingat yang generik).
// 5. Guard dites di tingkat SERVICE (bukan UI) — inilah bukti 4 aksi tertutup.

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => {
  const state = {
    plan: "PROFESSIONAL" as string,
    planConfigs: new Map<string, { autoReminder: boolean }>(),
    invoice: null as any,
  };
  return {
    __state: state,
    prisma: {
      // dipakai waAutomationEligibility
      tenant: {
        findUnique: vi.fn(async ({ where }: any) =>
          where?.id ? { plan: state.plan } : null),
      },
      planConfig: {
        findUnique: vi.fn(async ({ where }: any) =>
          state.planConfigs.get(where?.plan) ?? null),
      },
      // dipakai sendInvoiceViaWa / sendReceiptViaWa
      invoice: {
        findFirst: vi.fn(async () => state.invoice),
        update: vi.fn(),
      },
      // F5: jejak pengiriman manual (document-send-trace-service)
      messageLog: { create: vi.fn(async () => ({ id: "ml-trace" })) },
    },
  };
});
vi.mock("@/lib/wa/gateway-relay", () => ({
  gatewaySend: vi.fn(async () => ({ ok: true, messageId: "gm-1" })),
  isGatewayConfigured: vi.fn(async () => true),
  gatewaySessionStatus: vi.fn(async () => ({ ok: false })),
  gatewayLogoutSession: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/services/customer-service", () => ({
  ServiceError: class extends Error {},
  resolveBillingContact: vi.fn(async () => ({
    name: "Budi", waPhone: "628111", email: null,
  })),
}));

import * as prismaModule from "@/lib/prisma";
import { gatewaySend } from "@/lib/wa/gateway-relay";
import { sendInvoiceViaWa, sendReceiptViaWa } from "@/lib/services/invoice-service";

const state = (prismaModule as any).__state;
const mockSend = vi.mocked(gatewaySend);

const INV_ISSUED = {
  id: "inv-1", docType: "INVOICE", status: "ISSUED", number: "INV/2026/0001",
  issueDate: new Date(), dueDate: null, total: 150000, billingCustomerId: null,
  customer: { id: "cu-1", name: "Budi" },
};
const INV_PAID = { ...INV_ISSUED, id: "inv-2", status: "PAID" };

beforeEach(() => {
  vi.clearAllMocks();
  state.invoice = INV_ISSUED;
  state.planConfigs.set("TRIAL", { autoReminder: false });
  state.planConfigs.set("PROFESSIONAL", { autoReminder: true });
});

describe("F1 — guard paket di sendInvoiceViaWa (titik terendah, menutup 2 aksi)", () => {
  it("TRIAL ditolak & gatewaySend TIDAK dipanggil (tidak ada sesi gateway dibuat)", async () => {
    state.plan = "TRIAL";
    const r = await sendInvoiceViaWa("t-trial", "inv-1");
    expect(r.ok).toBe(false);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("PROFESSIONAL lolos & gatewaySend dipanggil (hak paket terpenuhi)", async () => {
    state.plan = "PROFESSIONAL";
    const r = await sendInvoiceViaWa("t-pro", "inv-1");
    expect(r.ok).toBe(true);
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it("galat TRIAL berkonteks dokumen (bukan pesan cron Pengingat)", async () => {
    state.plan = "TRIAL";
    const r = await sendInvoiceViaWa("t-trial", "inv-1");
    expect(r.ok).toBe(false);
    const error = (r as { error?: string }).error ?? "";
    expect(error).not.toMatch(/Pengingat|menu Pengingat/);
    expect(error).toMatch(/paket berbayar|WhatsApp/);
  });

  it("guard menolak SEBELUM menghubungi gateway, tetapi sesudah cek dokumen ada", async () => {
    state.plan = "TRIAL";
    state.invoice = null; // dokumen tak ada -> galat dokumen, tanpa query plan
    const r = await sendInvoiceViaWa("t-trial", "inv-hilang");
    expect(r.ok).toBe(false);
    expect((r as { error?: string }).error).toMatch(/tidak ditemukan/);
    expect(mockSend).not.toHaveBeenCalled();
  });
});

describe("F1 — guard paket di sendReceiptViaWa (titik terendah, menutup 2 aksi)", () => {
  it("TRIAL ditolak & gatewaySend TIDAK dipanggil", async () => {
    state.plan = "TRIAL";
    state.invoice = INV_PAID;
    const r = await sendReceiptViaWa("t-trial", "inv-2");
    expect(r.ok).toBe(false);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("PROFESSIONAL lolos & gatewaySend dipanggil", async () => {
    state.plan = "PROFESSIONAL";
    state.invoice = INV_PAID;
    const r = await sendReceiptViaWa("t-pro", "inv-2");
    expect(r.ok).toBe(true);
    expect(mockSend).toHaveBeenCalledTimes(1);
  });
});
