import { describe, it, expect, vi, beforeEach } from "vitest";

// F9d+ (SSOT_Alar_Teknisi 0.2): cash COMPLETED BELUM LUNAS = BELUM tuntas →
// kelompok "Menunggu pelunasan cash" di BERANDA. Tanpa ini, setelah F9c'
// (riwayat hanya tuntas) pekerjaan seperti Ibu Hesti hilang dari DUA halaman.
//
// RED: kelompok & helper BELUM ada di beranda (page.tsx) saat test ditulis.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const homePage = readFileSync(resolve(process.cwd(), "src/app/t/page.tsx"), "utf8");

describe("F9d+ — beranda: kelompok 'Menunggu pelunasan cash' (belum tuntas)", () => {
  it("page /t memuat helper listTechnicianUnpaidCashJobs", () => {
    expect(homePage).toContain("listTechnicianUnpaidCashJobs");
  });

  it("page /t merender kelompok 'Menunggu pelunasan cash'", () => {
    expect(homePage).toContain("Menunggu pelunasan cash");
  });

  it("empty-state memperhitungkan ketiga kelompok (tak klaim 'tidak ada pekerjaan' saat ada yg tertunda)", () => {
    expect(homePage).toMatch(/jobs\.length === 0 && backlog\.length === 0 && unpaidCash\.length === 0/);
  });

  it("angka ringkasan memuat semua kelompok (hari ini + perlu ditindaklanjuti + menunggu lunas)", () => {
    expect(homePage).toContain("Menunggu lunas");
  });
});

// ── Kontrak helper listTechnicianUnpaidCashJobs (guard terhadap regresi) ──
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => {
  const state = { completedJobs: [] as any[], sessions: [] as any[] };
  return {
    __state: state,
    prisma: {
      jobAssignment: { findMany: vi.fn(async () => []) },
      jobOrder: {
        findMany: vi.fn(async () => state.completedJobs),
        count: vi.fn(async () => state.completedJobs.length),
      },
      workSession: { findMany: vi.fn(async () => state.sessions.map((s: any) => ({ id: s.id, jobId: s.jobId }))) },
      invoice: {
        // Derive dari data test (sessions[].invoices) — kontrak 3-query helper:
        // workSession tanpa relasi invoices, lalu invoice terpisah per sesi.
        findMany: vi.fn(async ({ where }: any) =>
          state.sessions.flatMap((s: any) =>
            (s.invoices ?? []).map((x: any) => ({ workSessionId: s.id, ...x }))
          ).filter((x: any) => !where?.workSessionId?.in || where.workSessionId.in.includes(x.workSessionId))),
      },
    },
  };
});

import * as prismaModule from "@/lib/prisma";
import { listTechnicianUnpaidCashJobs } from "@/lib/services/job-management-service";

const state = (prismaModule as any).__state;

function completedJob(id: string) {
  return {
    id, status: "COMPLETED", windowStart: null, scheduledDate: new Date("2026-10-10T02:00:00Z"),
    customer: { name: "Pelanggan", phone: null, address: null },
    asset: { brand: "LG", model: null, roomLocation: null },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  state.completedJobs = [];
  state.sessions = [];
});

describe("F9d+ — kontrak listTechnicianUnpaidCashJobs", () => {
  it("cash COMPLETED invoice BELUM lunas → MASUK kelompok", async () => {
    state.completedJobs = [completedJob("j-cash-unpaid")];
    state.sessions = [{ id: "ws", jobId: "j-cash-unpaid", invoices: [{ docType: "INVOICE", status: "ISSUED" }] }];
    const r = await listTechnicianUnpaidCashJobs("t1", "tech-1");
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe("j-cash-unpaid");
  });

  it("cash COMPLETED invoice SUDAH lunas → TIDAK masuk (tuntas, riwayat saja)", async () => {
    state.completedJobs = [completedJob("j-cash-paid")];
    state.sessions = [{ id: "ws", jobId: "j-cash-paid", invoices: [{ docType: "INVOICE", status: "PAID" }] }];
    const r = await listTechnicianUnpaidCashJobs("t1", "tech-1");
    expect(r).toHaveLength(0);
  });

  it("tempo (proforma terbit) → TIDAK masuk (tugas teknisi tuntas di closing)", async () => {
    state.completedJobs = [completedJob("j-tempo")];
    state.sessions = [{ id: "ws", jobId: "j-tempo", invoices: [{ docType: "PROFORMA", status: "ISSUED" }] }];
    const r = await listTechnicianUnpaidCashJobs("t1", "tech-1");
    expect(r).toHaveLength(0);
  });

  it("tanpa invoice (sesi bukan alur kas) → TIDAK masuk", async () => {
    state.completedJobs = [completedJob("j-no-invoice")];
    state.sessions = [{ id: "ws", jobId: "j-no-invoice", invoices: [] }];
    const r = await listTechnicianUnpaidCashJobs("t1", "tech-1");
    expect(r).toHaveLength(0);
  });

  it("tanpa WorkSession sama sekali → TIDAK masuk", async () => {
    state.completedJobs = [completedJob("j-no-session")];
    state.sessions = [];
    const r = await listTechnicianUnpaidCashJobs("t1", "tech-1");
    expect(r).toHaveLength(0);
  });
});
