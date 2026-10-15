import { describe, it, expect, vi, beforeEach } from "vitest";

// F9c' — RIWAYAT hanya pekerjaan TUNTAS (kesepakatan pemilik; item rencana
// yang TERTUANG tapi belum dieksekusi → penyebab duplikasi Effi/Ibu Hesti di
// beranda + riwayat, dilaporkan pemilik 2026-10-15).
// Aturan terkunci (SSOT_Alar_Teknisi 0.2):
//   cash  tuntas = COMPLETED + invoice PAID
//   tempo tuntas = COMPLETED (proforma terbit)
//   Dibatalkan   = arsip;  sisanya = belum tuntas (beranda saja).

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => {
  const state = { assignments: [] as any[], sessions: [] as any[], invoices: [] as any[] };
  return {
    __state: state,
    prisma: {
      technician: { findFirst: vi.fn(async () => ({ id: "tech-1" })) },
      tenant: { findUnique: vi.fn(async () => ({ teamIncentiveMode: "BAGI_RATA", incentiveBasis: "LUNAS", incentiveEnabled: true })) },
      jobAssignment: { findMany: vi.fn(async () => state.assignments) },
      workSession: { findMany: vi.fn(async () => state.sessions) },
      invoice: {
        // Mock menghormati where.docType — dua query terpisah (INVOICE utk
        // insentif/lunas, PROFORMA utk klasifikasi cash-vs-tempo di F9c').
        findMany: vi.fn(async ({ where }: any) =>
          state.invoices.filter((x) => !where?.docType || x.docType === where.docType)),
      },
      serviceCatalog: { findMany: vi.fn(async () => []) },
    },
  };
});

import * as prismaModule from "@/lib/prisma";
const { prisma } = prismaModule as any;
import { listTechnicianJobHistory } from "@/lib/services/technician-service";

const state = (prismaModule as any).__state;

function assignment(jobId: string, status: string, scheduledDate: string) {
  return {
    id: `asg-${jobId}`, roleOnJob: "TECHNICIAN", jobId,
    job: {
      scheduledDate: new Date(scheduledDate), completedAt: null, createdAt: new Date(scheduledDate),
      serviceType: "CLEANING", status,
      customer: { name: "Pelanggan" }, asset: { brand: "LG", model: null, roomLocation: null },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  state.assignments = [];
  state.sessions = [];
  state.invoices = [];
});

describe("F9c' — riwayat hanya pekerjaan TUNTAS (tidak duplikat dgn beranda)", () => {
  it("query riwayat hanya meminta job COMPLETED/CANCELLED (status aktif tak ikut — Effi di beranda saja)", async () => {
    // Filter status ada DI QUERY Prisma (relasi job) — kontrak: findMany
    // jobAssignment menerima where job.status.in [COMPLETED, CANCELLED].
    state.assignments = [assignment("j-accept", "ACCEPTED", "2026-10-13T15:00:00Z")];
    await listTechnicianJobHistory("t1", "tech-1");
    const mock = prisma.jobAssignment.findMany as any;
    const where = mock.mock.calls[mock.mock.calls.length - 1][0].where;
    expect(where.job.status.in).toEqual(["COMPLETED", "CANCELLED"]);
  });

  it("cash COMPLETED invoice BELUM lunas TIDAK muncul — Ibu Hesti di beranda saja", async () => {
    state.assignments = [assignment("j-cash", "COMPLETED", "2026-10-14T02:00:00Z")];
    state.sessions = [{ id: "ws-1", jobId: "j-cash", items: [] }];
    state.invoices = [{ id: "inv-1", docType: "INVOICE", workSessionId: "ws-1", status: "ISSUED", paidAt: null, issueDate: new Date("2026-10-14") }];
    const r = await listTechnicianJobHistory("t1", "tech-1");
    expect(r.rows).toHaveLength(0);
  });

  it("cash COMPLETED invoice PAID = tuntas → muncul (arsip)", async () => {
    state.assignments = [assignment("j-paid", "COMPLETED", "2026-10-14T02:00:00Z")];
    state.sessions = [{ id: "ws-2", jobId: "j-paid", items: [] }];
    state.invoices = [{ id: "inv-2", docType: "INVOICE", workSessionId: "ws-2", status: "PAID", paidAt: new Date("2026-10-14T04:00:00Z"), issueDate: new Date("2026-10-14") }];
    const r = await listTechnicianJobHistory("t1", "tech-1", "2026-10");
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].jobId).toBe("j-paid");
  });

  it("tempo COMPLETED (proforma terbit) = tugas teknisi tuntas → muncul utk dipantau", async () => {
    state.assignments = [assignment("j-tempo", "COMPLETED", "2026-10-10T02:00:00Z")];
    state.sessions = [{ id: "ws-3", jobId: "j-tempo", items: [] }];
    state.invoices = [{ id: "inv-3", docType: "PROFORMA", workSessionId: "ws-3", status: "ISSUED", paidAt: null, issueDate: new Date("2026-10-10") }];
    const r = await listTechnicianJobHistory("t1", "tech-1", "2026-10");
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].jobId).toBe("j-tempo");
  });

  it("CANCELLED tetap arsip di riwayat", async () => {
    state.assignments = [assignment("j-batal", "CANCELLED", "2026-10-05T02:00:00Z")];
    const r = await listTechnicianJobHistory("t1", "tech-1", "2026-10");
    expect(r.rows).toHaveLength(1);
  });
});
