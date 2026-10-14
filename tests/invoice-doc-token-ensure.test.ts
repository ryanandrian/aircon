import { describe, it, expect, vi, beforeEach } from "vitest";

// E2 — ANTI-MANGKRAK token dokumen (keputusan pemilik: docToken WAJIB dipakai).
//
// MASALAH YANG DIPERBAIKI: dokumen LAMA (sebelum F7a) punya docToken NULL →
// tombol "Salin link dokumen" & tautan di pesan WA MATI untuk mereka, sampai
// dokumen diambil ulang lewat jalur create (yang tidak pernah terjadi lagi).
// FIX: ensureInvoiceDocToken — isi token SEKALI saat dokumen DIBUKA (titik
// bersama: page detail admin + teknisi + loader publik = getInvoiceForView).
//
// Yang DIKUNCI (mock ringan pola invoice-wa-plan-guard / invoice-payment-guard):
// 1. Dokumen SUDAH punya token → return langsung, TANPA menyentuh DB
//    (token TIDAK pernah di-rotate/di-overwrite — link lama tetap sah).
// 2. Dokumen NULL token → generate + updateMany WHERE docToken null (sekali
//    jalan; race-safe: proses lain yang menang = token tetap valid & unik).
// 3. Return SELALU berisi token (hasil re-read bila ada proses lain menang).

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => {
  const state = {
    updateManyCalls: [] as any[],
    findFirstRet: null as string | null,
    updateManyCount: 1,
  };
  return {
    __state: state,
    prisma: {
      invoice: {
        updateMany: vi.fn(async (a: any) => {
          state.updateManyCalls.push(a);
          return { count: state.updateManyCount };
        }),
        findFirst: vi.fn(async () => ({ docToken: state.findFirstRet })),
        findUnique: vi.fn(async () => null),
        create: vi.fn(),
        update: vi.fn(),
      },
    },
  };
});
vi.mock("@/lib/services/customer-service", () => ({ ServiceError: class extends Error {} }));

import * as prismaModule from "@/lib/prisma";
import { ensureInvoiceDocToken } from "@/lib/services/invoice-service";

const state = (prismaModule as any).__state;

beforeEach(() => {
  vi.clearAllMocks();
  state.updateManyCalls = [];
  state.findFirstRet = null;
  state.updateManyCount = 1;
});

describe("E2 — ensureInvoiceDocToken (anti-mangkrak)", () => {
  it("dokumen SUDAH punya token → return langsung, TANPA menyentuh DB (token tak di-rotate)", async () => {
    const t = await ensureInvoiceDocToken({ id: "inv-1", docToken: "TOKENLAMA1234567890123456789012" });
    expect(t).toBe("TOKENLAMA1234567890123456789012");
    expect(state.updateManyCalls).toHaveLength(0); // nol tulis = link lama tetap sah
  });

  it("dokumen NULL token → generate + updateMany WHERE docToken null (race-safe, sekali jalan)", async () => {
    const t = await ensureInvoiceDocToken({ id: "inv-2", docToken: null });
    expect(t).toMatch(/^[A-Za-z0-9_-]{32}$/); // token baru, format benar
    expect(state.updateManyCalls).toHaveLength(1);
    const call = state.updateManyCalls[0];
    expect(call.where).toMatchObject({ id: "inv-2", docToken: null }); // guard anti-overwrite
    expect(call.data.docToken).toBe(t); // token yang dikembalikan = yang ditulis
  });

  it("re-read mengembalikan token proses LAIN bila ada race (count=0 = sudah terisi)", async () => {
    // proses lain menang duluan → updateMany count=0 → pakai token hasil re-read
    state.updateManyCount = 0;
    state.findFirstRet = "TOKENPROSESLAIN1234567890123456";
    const t = await ensureInvoiceDocToken({ id: "inv-3", docToken: null });
    expect(t).toBe("TOKENPROSESLAIN1234567890123456"); // token valid milik proses lain
  });

  it("tidak pernah mengembalikan null/undefined — selalu token string", async () => {
    const a = await ensureInvoiceDocToken({ id: "inv-4", docToken: null });
    const b = await ensureInvoiceDocToken({ id: "inv-5", docToken: "TOKENSUDAHADA123456789012345678" });
    expect(typeof a).toBe("string");
    expect(typeof b).toBe("string");
    expect(a.length).toBe(32);
  });

  it("dua panggilan paralel utk dokumen null → keduanya dapat token (unik, bukan null)", async () => {
    const [x, y] = await Promise.all([
      ensureInvoiceDocToken({ id: "inv-6", docToken: null }),
      ensureInvoiceDocToken({ id: "inv-6", docToken: null }),
    ]);
    expect(typeof x).toBe("string");
    expect(typeof y).toBe("string");
    expect(x).not.toBe(""); // token valid — bukan kosong/null
  });
});
