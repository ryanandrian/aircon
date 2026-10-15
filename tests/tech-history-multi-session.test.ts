import { describe, it, expect, vi, beforeEach } from "vitest";

// REGRESI KRITIS (laporan pemilik 2026-10-15 17:44, uang sudah lunas & disetor
// tapi badge riwayat "Selesai - Belum dibayar" + insentif 0, padahal beranda 20rb).
//
// AKAR TERBUKTI (probe DB live):
//   job Ibu Hesti punya DUA WorkSession:
//     ws-1 (closing, 14 Okt) = punya invoice INV/2026/0032 PAID
//     ws-2 (15 Okt, kosong)  = tanpa invoice
//   kode lama: sessionByJob.set(jobId, s) = LAST-WRITE WINS (asumsi 1 sesi/job)
//   → sesi kosong terpilih → wsInvoices=[] → paid=false → label salah;
//     qualifies=false → insentif 0 (beranda benar karena tak lewat peta ini).
//
// Kontrak BARU (jalur existing — kembangkan sessionByJob, nol path baru):
//  1. invoice/kelunasan = AGREGAT semua sesi utk job itu (any PAID).
//  2. item insentif = sesi closing (yg punya items), bukan sesi kosong terakhir.
//  3. urutan sesi deterministik (createdAt asc).

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => {
  const state = {
    assignments: [] as any[],
    sessions: [] as any[],
    invoices: [] as any[],
    catalog: [] as any[],
  };
  return {
    __state: state,
    prisma: {
      technician: { findFirst: vi.fn(async () => ({ id: "tech-1" })) },
      tenant: { findUnique: vi.fn(async () => ({ teamIncentiveMode: "BAGI_RATA", incentiveBasis: "LUNAS", incentiveEnabled: true })) },
      jobAssignment: {
        findMany: vi.fn(async () => state.assignments),
      },
      workSession: {
        // urutan dijaga (prod: orderBy createdAt asc)
        findMany: vi.fn(async () => [...state.sessions].sort((a: any, b: any) => (a.createdAt ?? 0) < (b.createdAt ?? 0) ? -1 : 1)),
      },
      invoice: {
        findMany: vi.fn(async ({ where }: any) =>
          state.invoices.filter((x) => !where?.docType || x.docType === where.docType)),
      },
      serviceCatalog: { findMany: vi.fn(async () => state.catalog) },
    },
  };
});

import * as prismaModule from "@/lib/prisma";
import { listTechnicianJobHistory } from "@/lib/services/technician-service";

const state = (prismaModule as any).__state;

const tech = "tech-1";
const assignmentRow = (jobId: string) => ({
  id: `asg-${jobId}`, roleOnJob: "TECHNICIAN", jobId,
  job: {
    scheduledDate: new Date("2026-10-14T00:00:00Z"),
    completedAt: new Date("2026-10-14T04:42:43Z"),
    createdAt: new Date("2026-10-14T00:00:00Z"),
    serviceType: "CLEANING", status: "COMPLETED",
    customer: { name: "Ibu Hesti" }, asset: { brand: "LG", model: null, roomLocation: null },
  },
});

// Sesi CLOSING (punya item) — di posisi AWAL (urutan createdAt asc)
const closingSession = {
  id: "ws-closing", jobId: "job-1", createdAt: new Date("2026-10-14T04:42:43Z"),
  items: [{ serviceId: "svc-1", unitPriceSnapshot: 75000, qty: 1, techIds: [tech], kernetIds: [] }],
};
// Sesi KEDUA (kosong, tanpa invoice) — di posisi AKHIR (penyebab bug live)
const extraSession = {
  id: "ws-empty", jobId: "job-1", createdAt: new Date("2026-10-15T03:00:00Z"),
  items: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  state.assignments = [assignmentRow("job-1")];
  state.sessions = [closingSession, extraSession];
  state.invoices = [];
  state.catalog = [{
    id: "svc-1", standardPrice: 75000,
    techIncentiveType: "PERCENT", techIncentiveValue: 26.67, // ≈20rb utk 75rb
    kernetIncentiveType: "NONE", kernetIncentiveValue: 0,
  }];
});

describe("REGRESI: dua WorkSession utk 1 job (probe live Ibu Hesti)", () => {
  it("invoice PAID di sesi CLOSING → paid=true (badge 'Lunas'), walau sesi kosong ada di belakang", async () => {
    state.invoices = [{ docType: "INVOICE", workSessionId: "ws-closing", status: "PAID", paidAt: new Date("2026-10-15T03:23:06Z"), issueDate: new Date("2026-10-14") }];
    const r = await listTechnicianJobHistory("t1", tech, "2026-10");
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].paid).toBe(true); // dulu: false (sesi kosong terpilih)
    expect(r.rows[0].incentive).toBeGreaterThan(0); // dulu: 0
  });

  it("invoice belum lunas di sesi CLOSING → row DIBUANG (F9c': belum tuntas, beranda saja)", async () => {
    state.invoices = [{ docType: "INVOICE", workSessionId: "ws-closing", status: "ISSUED", paidAt: null, issueDate: new Date("2026-10-14") }];
    const r = await listTechnicianJobHistory("t1", tech, "2026-10");
    expect(r.rows).toHaveLength(0);
  });

  it("tanpa sesi kosong pun hasil tetap benar (regresi jalur lama utk 1 sesi)", async () => {
    state.sessions = [closingSession];
    state.invoices = [{ docType: "INVOICE", workSessionId: "ws-closing", status: "PAID", paidAt: new Date("2026-10-15T03:23:06Z"), issueDate: new Date("2026-10-14") }];
    const r = await listTechnicianJobHistory("t1", tech, "2026-10");
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].paid).toBe(true);
    expect(r.rows[0].incentive).toBeGreaterThan(0);
  });

  it("sesi insentif diambil dari sesi yang PUNYA item (bukan sesi kosong terakhir)", async () => {
    state.invoices = [{ docType: "INVOICE", workSessionId: "ws-closing", status: "PAID", paidAt: new Date("2026-10-15T03:23:06Z"), issueDate: new Date("2026-10-14") }];
    const r = await listTechnicianJobHistory("t1", tech, "2026-10");
    // 75000 × ~26.67% ≈ 20000 (konsisten dgn kartu beranda)
    expect(r.rows[0].incentive).toBeGreaterThanOrEqual(19000);
  });
});
