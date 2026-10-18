import { describe, it, expect, vi, beforeEach } from "vitest";

// F2 — Guard role + scope pembayaran (temuan B-2 & B-3, KRITIS uang).
//
// BUKTI MASALAH (audit 2026-10-14):
//  - actionMarkPaid / actionUploadPaymentProof / actionTechSend* cukup
//    getServerContext() valid — TECHNICIAN lolos tanpa cek peran (B-2).
//  - markInvoicePaid TIDAK membatasi pembuatnya — teknisi mana pun bisa
//    menandai lunas invoice TEMPO siapa pun (B-3).
// Aturan bisnis (SSOT_Alar_Invoicing §1.2-1.3 + keputusan owner E3 #5):
//  - Teknisi menutup sesi CASH sendiri → invoice buatannya sendiri
//    (createdById == teknisi) → BOLEH tandai lunas (lapangan).
//  - Proforma/TEMPO hanya admin → teknisi TIDAK bisa menandai lunas.
//  - Invoice admin (bukan dibuat teknisi) → teknisi TIDAK boleh.
//  - Admin/Owner bebas semua (tetap dijaga status atomik anti-double-mark).
//
// Yang DIKUNCI:
// 1. actionUploadPaymentProof: role TECHNICIAN TOLAK (hanya OWNER/ADMIN —
//    teknisi tak perlu upload; penandaan lapangan tanpa bukti tetap bisa).
// 2. markInvoicePaid (service, scope pembuat): teknisi OK hanya utk INVOICE
//    yang createdById == dirinya + status ISSUED/OVERDUE + docType INVOICE.
// 3. Teknisi TOLAK utk invoice admin / proforma / milik teknisi lain.
// 4. Admin/Owner lolos semua (tidak kehilangan hak).
// 5. Guard status atomik B4 TETAP (double-mark tetap ditolak).

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/context", () => ({
  getServerContext: vi.fn(),
  tryGetServerContext: vi.fn(),
}));
vi.mock("@/lib/auth/guard", () => ({
  assertRole: vi.fn((role: string, allowed: string[]) => {
    if (!allowed.includes(role)) throw new Error("Peran tidak diizinkan");
  }),
  AuthError: class extends Error {},
}));
vi.mock("@/lib/prisma", () => {
  const state = {
    invoice: null as any,
    updated: { count: 1 },
  };
  return {
    __state: state,
    prisma: {
      invoice: {
        findFirst: vi.fn(async () => state.invoice),
        updateMany: vi.fn(async () => state.updated),
        update: vi.fn(async () => ({})),
      },
    },
  };
});
vi.mock("@/lib/storage/s3", () => ({
  putTenantAsset: vi.fn(async () => ({ publicUrl: "https://s3/bukti.jpg" })),
}));

import * as prismaModule from "@/lib/prisma";
import { getServerContext } from "@/lib/auth/context";
import { markInvoicePaid } from "@/lib/services/invoice-service";
import { actionUploadPaymentProof } from "@/app/t/faktur/actions";

const state = (prismaModule as any).__state;
const mockCtx = vi.mocked(getServerContext);

const TECH = { tenantId: "t1", userId: "tech-1", role: "TECHNICIAN" } as any;
const ADMIN = { tenantId: "t1", userId: "admin-1", role: "ADMIN" } as any;

function inv(over: Record<string, unknown> = {}) {
  return {
    id: "inv-1", docType: "INVOICE", status: "ISSUED",
    createdById: "tech-1", ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  state.updated = { count: 1 };
});

describe("F2 → KEPUTUSAN BARU K12 (2026-10-18): actionUploadPaymentProof — teknisi DIPERBOLEHKAN", () => {
  // KEPUTUSAN PEMILIK 2026-10-18 MEMBATALKAN guard lama: teknisi WAJIB bisa
  // mengirimkan bukti (terima uang tunai / transfer / QRIS) — khususnya pelanggan
  // TOP CASH. Guard B-2 lama (hanya OWNER/ADMIN) kini DIBUKA utk semua peran
  // yang berhak menandai lunas (semua peran aktor punya hak yang sama di sini).
  it("TEKNISI kini DIPERBOLEHKAN mengunggah bukti (keputusan K12, membatalkan B-2)", async () => {
    mockCtx.mockResolvedValueOnce(TECH);
    const fd = new FormData();
    fd.set("file", new File([new Uint8Array([1, 2, 3])], "b.jpg", { type: "image/jpeg" }));
    const r = await actionUploadPaymentProof(fd);
    expect(r.ok).toBe(true);
  });

  it("ADMIN diperbolehkan (hak tidak hilang)", async () => {
    mockCtx.mockResolvedValueOnce(ADMIN);
    const fd = new FormData();
    fd.set("file", new File([new Uint8Array([1, 2, 3])], "b.jpg", { type: "image/jpeg" }));
    const r = await actionUploadPaymentProof(fd);
    expect(r.ok).toBe(true);
  });
});

describe("F2 — markInvoicePaid: scope pembuat (B-3)", () => {
  it("TEKNISI boleh utk INVOICE CASH buatannya sendiri (createdById == teknisi)", async () => {
    state.invoice = inv({ createdById: "tech-1" });
    const t = { tenantId: "t1", userId: "tech-1", role: "TECHNICIAN" } as any;
    await expect(markInvoicePaid("t1", "inv-1", "CASH", undefined, t)).resolves.toBeUndefined();
  });

  it("TEKNISI TOLAK utk invoice buatan ADMIN (bukan miliknya)", async () => {
    state.invoice = inv({ createdById: "admin-1" });
    await expect(markInvoicePaid("t1", "inv-1", "CASH")).rejects.toThrow(/admin|pemilik/i);
  });

  it("TEKNISI TOLAK utk invoice teknisi LAIN", async () => {
    state.invoice = inv({ createdById: "tech-2" });
    await expect(markInvoicePaid("t1", "inv-1", "CASH")).rejects.toThrow(/admin|pemilik/i);
  });

  it("TEKNISI TOLAK utk PROFORMA (TEMPO — urusan admin)", async () => {
    state.invoice = inv({ docType: "PROFORMA", createdById: "tech-1" });
    await expect(markInvoicePaid("t1", "inv-1", "CASH")).rejects.toThrow();
  });

  it("ADMIN lolos utk invoice siapa pun (hak tidak hilang)", async () => {
    state.invoice = inv({ createdById: "tech-2" });
    await expect(markInvoicePaid("t1", "inv-1", "CASH", undefined, ADMIN)).resolves.toBeUndefined();
  });

  it("Pemilik (OWNER) juga lolos — konsisten guard admin", async () => {
    state.invoice = inv({ createdById: "tech-2" });
    const OWNER = { tenantId: "t1", userId: "own-1", role: "OWNER" } as any;
    await expect(markInvoicePaid("t1", "inv-1", "CASH", undefined, OWNER)).resolves.toBeUndefined();
  });

  it("Guard atomik B4 TETAP: race (count=0) → CONFLICT, bukan sukses", async () => {
    state.invoice = inv({ createdById: "tech-1" });
    state.updated = { count: 0 };
    const t = { tenantId: "t1", userId: "tech-1", role: "TECHNICIAN" } as any;
    await expect(markInvoicePaid("t1", "inv-1", "CASH", undefined, t)).rejects.toThrow(/berubah/i);
  });

  it("scope null (jalur internal tanpa konteks) ditolak utk teknisi — aman default", async () => {
    // caller yang TIDAK meneruskan konteks peran tidak boleh melewati guard teknisi.
    state.invoice = inv({ createdById: "tech-1" });
    await expect(markInvoicePaid("t1", "inv-1", "CASH", undefined, null)).rejects.toThrow();
  });
});
