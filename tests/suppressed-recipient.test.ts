import { describe, it, expect, vi, beforeEach } from "vitest";

// REGRESSION (G28 — nomor/email tujuan hilang tak boleh hilang diam-diam).
//
// SEBELUM: `notifyPlatform` hanya push ke array `skipped` (tak ada jejak di DB)
// dan dunning mengantre MessageLog dengan `toPhone` kosong (pasti gagal saat
// dispatch, tanpa alasan).
//
// SESUDAH: kedua jalur mencatat baris berstatus SUPPRESSED + alasan, sehingga
// operator melihatnya di Admin → Notifikasi dan bisa memperbaiki data kontak.

vi.mock("server-only", () => ({}));

const { pnCreate, pnFindUnique, mlCreate, tenantFindUnique, planConfigFindUnique, templateFindUnique, userFindFirst } = vi.hoisted(() => ({
  pnCreate: vi.fn(), pnFindUnique: vi.fn(), mlCreate: vi.fn(), tenantFindUnique: vi.fn(),
  planConfigFindUnique: vi.fn(), templateFindUnique: vi.fn(), userFindFirst: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    platformNotification: { create: pnCreate, findUnique: pnFindUnique },
    messageLog: { create: mlCreate },
    tenant: { findUnique: tenantFindUnique },
    user: { findFirst: userFindFirst },
    planConfig: { findUnique: planConfigFindUnique },
    platformTemplate: { findUnique: templateFindUnique },
  },
}));

vi.mock("@/lib/services/platform-template-service", () => ({
  getActiveTemplate: vi.fn(async (key: string) => ({
    key, subject: "Subj", body: "Halo {{tenant}}, paket {{paket}} {{nominal}} {{tanggal}} {{link}}.",
    version: 1, updatedBy: null,
  })),
}));

import { notifyPlatform } from "../src/lib/services/platform-notification-service";

describe("G28 — penerima kosong dicatat sebagai SUPPRESSED", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    templateFindUnique.mockResolvedValue(null);
    userFindFirst.mockResolvedValue(null); // owner tanpa email
    pnFindUnique.mockResolvedValue({
      id: "n1", tenantId: "t1", status: "SUPPRESSED", templateKey: "subscription_due",
      attempts: 0, dedupeKey: null, suppressedReason: "email penerima kosong",
    });
    planConfigFindUnique.mockResolvedValue({ plan: "PROFESSIONAL", displayName: "Professional" });
    pnCreate.mockResolvedValue({ id: "pn1" });
    mlCreate.mockResolvedValue({ id: "ml1" });
  });

  it("tenant tanpa nomor WA & tanpa email owner → baris SUPPRESSED + alasan (bukan di-skip senyap)", async () => {
    tenantFindUnique.mockResolvedValue({
      id: "t1", name: "CV Tanpa Kontak", plan: "PROFESSIONAL",
      phone: "", status: "ACTIVE",
    });
    const r = await notifyPlatform({
      tenantId: "t1",
      templateKey: "subscription_due",
      channels: ["WA", "EMAIL"],
      vars: { tenant: "CV Tanpa Kontak", paket: "Professional", nominal: "100000", tanggal: "1 Okt", link: "https://x" },
    });
    // DUA baris tercatat (WA + EMAIL), keduanya SUPPRESSED.
    expect(pnCreate).toHaveBeenCalledTimes(2);
    for (const call of pnCreate.mock.calls) {
      const d = call[0].data;
      expect(d.status).toBe("SUPPRESSED");
      expect(d.suppressedReason).toMatch(/kosong/);
      expect(d.tenantId).toBe("t1");
      expect(d.attempts).toBeUndefined(); // tak ada attempt: tak akan dikirim ulang
    }
    // Alasan spesifik per kanal.
    const reasons = pnCreate.mock.calls.map((c) => c[0].data.suppressedReason);
    expect(reasons.some((x: string) => x.includes("WhatsApp"))).toBe(true);
    expect(reasons.some((x: string) => x.includes("email"))).toBe(true);
    // Diteruskan ke ringkasan.
    expect(r.suppressed).toBe(2);
    expect(r.created).toBe(0);
  });

  it("penerima ADA → tak ada baris SUPPRESSED (perilaku lama tak berubah)", async () => {
    tenantFindUnique.mockResolvedValue({
      id: "t1", name: "CV Normal", plan: "PROFESSIONAL",
      phone: "08123456789", status: "ACTIVE",
    });
    await notifyPlatform({
      tenantId: "t1",
      templateKey: "subscription_due",
      channels: ["WA"],
      vars: { tenant: "CV Normal", paket: "Professional", nominal: "100000", tanggal: "1 Okt", link: "https://x" },
    });
    const d = pnCreate.mock.calls[0][0].data;
    // Status normal TIDAK ditulis eksplisit (default DB = QUEUED) — konsisten
    // dengan perilaku lama. Yang penting: tak ada SUPPRESSED.
    expect(d.status).toBeUndefined();
    expect(d.suppressedReason).toBeUndefined();
    expect(d.toAddress).toBe("628123456789"); // dinormalisasi ke format 62xxx
  });

  it("SUPPRESSED tak bisa di-replay (penyebabnya data kontak, bukan kirim ulang)", async () => {
    const { replayPlatformNotification } = await import("../src/lib/services/platform-notification-admin");
    // mock updateMany/create tak dipakai karena guard menolak lebih dulu
    const r = await replayPlatformNotification("n1", "admin@x.id");
    expect(r.ok).toBe(false);
  });
});
