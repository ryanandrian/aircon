import { describe, it, expect, vi, beforeEach } from "vitest";

// F3 — Fallback "Buka WhatsApp" (wa.me) utk tenant TRIAL/BASIC (G-2/G-3).
//
// Konteks: F1 menutup Gateway utk TRIAL. Keputusan pemilik: TRIAL/BASIC tetap
// bisa mengirim dokumen — lewat APLIKASI WhatsApp miliknya sendiri (wa.me,
// pola menu Pengingat). F3 = mekanisme fallback di service (jalur yang ada):
//   - plan-locked + ada nomor tujuan -> { ok:false, waMe:{url,message} } —
//     UI menampilkan tombol "Buka WhatsApp" (link prefilled).
//   - plan-locked + TANPA nomor      -> error "Nomor WA tujuan kosong" (wajar).
//   - plan eligible                  -> tetap lewat GATEWAY (ok:true).
// gatewaySend TIDAK PERNAH dipanggil utk TRIAL (dijaga F1; dites ulang di sini).
// Gateway TIDAK tersentuh — kontrak teks-only tetap.
//
// Yang DIKUNCI:
// 1. TRIAL + nomor -> waMe.url memuat nomor tujuan; waMe.message memuat nomor
//    dokumen & total (pesan sudah terisi, 1 langkah bagi pelanggan).
// 2. TRIAL + nomor -> gatewaySend TIDAK dipanggil (nol sesi gateway).
// 3. TRIAL tanpa nomor -> error jelas "Nomor WA tujuan kosong".
// 4. PROFESSIONAL -> ok:true (gateway), tanpa waMe.
// 5. Fallback aktif di DUA fungsi (invoice & kwitansi).

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => {
  const state = { plan: "PROFESSIONAL", planConfigs: new Map(), invoice: null as any };
  return {
    __state: state,
    prisma: {
      tenant: { findUnique: vi.fn(async () => ({ plan: state.plan, name: "Toko AC", bankName: null, bankAccountNo: null, bankAccountName: null })) },
      planConfig: { findUnique: vi.fn(async ({ where }: any) => state.planConfigs.get(where?.plan) ?? null) },
      invoice: { findFirst: vi.fn(async () => state.invoice), update: vi.fn() },
      // F5: jejak pengiriman manual (document-send-trace-service)
      messageLog: {
        create: vi.fn(async () => ({ id: "ml-trace" })),
        findFirst: vi.fn(async () => null),
      },
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
  resolveBillingContact: vi.fn(),
}));

import * as prismaModule from "@/lib/prisma";
import { resolveBillingContact } from "@/lib/services/customer-service";
import { gatewaySend } from "@/lib/wa/gateway-relay";
import { sendInvoiceViaWa, sendReceiptViaWa } from "@/lib/services/invoice-service";

const state = (prismaModule as any).__state;
const mockSend = vi.mocked(gatewaySend);
const mockContact = vi.mocked(resolveBillingContact);

const INV = {
  id: "inv-1", docType: "INVOICE", status: "ISSUED", number: "INV/2026/0009",
  issueDate: new Date("2026-01-10"), dueDate: null, total: 250000,
  billingCustomerId: null, customer: { id: "cu-1", name: "Budi" },
};
const INV_PAID = { ...INV, id: "inv-2", status: "PAID" };

beforeEach(() => {
  vi.clearAllMocks();
  state.invoice = INV;
  state.planConfigs.set("TRIAL", { autoReminder: false });
  state.planConfigs.set("PROFESSIONAL", { autoReminder: true });
  mockContact.mockResolvedValue({ name: "Budi", waPhone: "6281234", email: null });
});

describe("F3 — fallback wa.me utk TRIAL (sendInvoiceViaWa)", () => {
  it("TRIAL + nomor: ok:false + waMe.url memuat nomor tujuan & waMe.message memuat dokumen+total", async () => {
    state.plan = "TRIAL";
    const r = await sendInvoiceViaWa("t-trial", "inv-1");
    expect(r.ok).toBe(false);
    const wa = (r as any).waMe;
    expect(wa).toBeTruthy();
    expect(wa.url).toContain("6281234"); // tujuan
    expect(wa.url).toContain("wa.me");   // pola wa.me
    expect(wa.message).toContain("INV/2026/0009"); // nomor dokumen
    expect(wa.message).toMatch(/250\.000|250000/);  // total
  });

  it("TRIAL: gatewaySend TIDAK dipanggil (nol sesi gateway) — F1 tetap dijaga", async () => {
    state.plan = "TRIAL";
    await sendInvoiceViaWa("t-trial", "inv-1");
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("TRIAL tanpa nomor tujuan: error jelas 'Nomor WA tujuan kosong'", async () => {
    state.plan = "TRIAL";
    mockContact.mockResolvedValue({ name: "Budi", waPhone: null, email: null });
    const r = await sendInvoiceViaWa("t-trial", "inv-1");
    expect(r.ok).toBe(false);
    expect((r as any).error).toMatch(/Nomor WA tujuan kosong/);
    expect((r as any).waMe).toBeUndefined();
  });

  it("PROFESSIONAL: ok:true lewat gateway, TANPA waMe (hak paket terpenuhi)", async () => {
    state.plan = "PROFESSIONAL";
    const r = await sendInvoiceViaWa("t-pro", "inv-1");
    expect(r.ok).toBe(true);
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect((r as any).waMe).toBeUndefined();
  });
});

describe("F3 — fallback wa.me utk TRIAL (sendReceiptViaWa)", () => {
  it("TRIAL + nomor: waMe aktif, gatewaySend tidak dipanggil", async () => {
    state.plan = "TRIAL";
    state.invoice = INV_PAID;
    const r = await sendReceiptViaWa("t-trial", "inv-2");
    expect(r.ok).toBe(false);
    expect((r as any).waMe?.url).toContain("6281234");
    expect((r as any).waMe?.message).toContain("KWITANSI");
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("PROFESSIONAL: ok:true lewat gateway", async () => {
    state.plan = "PROFESSIONAL";
    state.invoice = INV_PAID;
    const r = await sendReceiptViaWa("t-pro", "inv-2");
    expect(r.ok).toBe(true);
    expect(mockSend).toHaveBeenCalledTimes(1);
  });
});
