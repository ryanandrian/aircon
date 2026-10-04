import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Poin 2 — guard status di SERVER ACTION (bukan hanya tombol FE).
 * Jalur nyata: actionAssignTeam → assignJob (service) → prisma $transaction.
 * Hanya prisma & transisi status yang di-mock; guard & pesan error diuji apa adanya.
 */

let session: { tenantId: string; userId: string; role: string; name: string };

const db = {
  job: { status: "ASSIGNED" as string },
  updateCalls: [] as any[],
  createManyCalls: [] as any[],
};

vi.mock("@/lib/auth/context", () => ({
  getServerContext: vi.fn(async () => session),
  tryGetServerContext: vi.fn(async () => session),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/services/customer-service", () => ({
  ServiceError: class ServiceError extends Error {
    code: string;
    constructor(code: string, message: string) { super(message); this.code = code; }
  },
}));
vi.mock("@/lib/prisma", () => {
  const tx = {
    jobOrder: {
      update: vi.fn(async ({ data }: any) => { db.updateCalls.push(data); return { ...data }; }),
    },
    jobAssignment: {
      deleteMany: vi.fn(async () => ({ count: 0 })),
      createMany: vi.fn(async ({ data }: any) => { db.createManyCalls.push(data); return { count: data.length }; }),
    },
    jobProgressEvent: { create: vi.fn(async () => ({ id: "e1" })) },
  };
  return {
    prisma: {
      jobOrder: {
        findFirst: vi.fn(async ({ where }: any) =>
          // meniru prisma: cek id DAN tenantId dalam satu query
          where.id === "j1" && where.tenantId === "t1" ? { id: "j1", status: db.job.status } : null,
        ),
        update: tx.jobOrder.update,
      },
      technician: {
        findMany: vi.fn(async () => [{ id: "p1" }]),
      },
      jobAssignment: tx.jobAssignment,
      jobProgressEvent: tx.jobProgressEvent,
      $transaction: vi.fn(async (fn: any) => fn(tx)),
    },
  };
});
// Transisi status DRAFT→ASSIGNED oleh action: mock terpisah agar fokus test = guard assign.
vi.mock("@/lib/services/job-service", () => ({
  transitionJob: vi.fn(async () => ({ job: {}, idempotentReplay: false })),
  TransitionError: class TransitionError extends Error { code = "X"; details = {}; },
}));

import { actionAssignTeam } from "../src/app/app/pekerjaan/actions";

const members = [{ personId: "p1", roleOnJob: "TECHNICIAN" as const }];

beforeEach(() => {
  session = { tenantId: "t1", userId: "u1", role: "OWNER", name: "Pemilik" };
  db.job.status = "ASSIGNED";
  db.updateCalls = [];
  db.createManyCalls = [];
  vi.clearAllMocks();
});

describe("actionAssignTeam — guard status di server (Poin 2)", () => {
  it("DRAFT/ASSIGNED boleh → roster + jadwal tersimpan dalam transaksi", async () => {
    for (const status of ["DRAFT", "ASSIGNED"]) {
      db.job.status = status;
      db.updateCalls = []; db.createManyCalls = [];
      const res = await actionAssignTeam("j1", members, "2026-10-05", "09:00", 60);
      expect(res.ok).toBe(true);
      expect(db.createManyCalls).toHaveLength(1);
      expect(db.updateCalls[0]).toMatchObject({
        technicianId: "p1",
        scheduledDate: new Date(2026, 9, 5, 9, 0),
        windowStart: new Date(2026, 9, 5, 9, 0),
      });
      expect(db.updateCalls[0].windowEnd).toBeInstanceOf(Date);
    }
  });

  it("status berjalan (IN_PROGRESS) DITOLAK dengan pesan guard, tanpa mutasi apa pun", async () => {
    db.job.status = "IN_PROGRESS";
    const res = await actionAssignTeam("j1", members, "2026-10-05", "09:00", 60);
    expect(res.ok).toBe(false);
    expect(!res.ok && res.error).toContain("sudah berjalan"); // pesan JobError sampai ke user
    expect(db.updateCalls).toHaveLength(0);
    expect(db.createManyCalls).toHaveLength(0);
  });

  it("status terminal COMPLETED/CANCELLED DITOLAK", async () => {
    for (const status of ["COMPLETED", "CANCELLED"]) {
      db.job.status = status;
      db.updateCalls = []; db.createManyCalls = [];
      const res = await actionAssignTeam("j1", members, "2026-10-05", "09:00", 60);
      expect(res.ok).toBe(false);
      expect(db.createManyCalls).toHaveLength(0);
      expect(db.updateCalls).toHaveLength(0);
    }
  });

  it("role TECHNICIAN ditolak oleh guard role sebelum menyentuh data", async () => {
    session = { tenantId: "t1", userId: "u3", role: "TECHNICIAN", name: "Tukang" };
    const res = await actionAssignTeam("j1", members, "2026-10-05", "09:00", 60);
    expect(res.ok).toBe(false);
    expect(db.createManyCalls).toHaveLength(0);
    expect(db.updateCalls).toHaveLength(0);
  });

  it("tanggal kosong → ditolak sebelum mutasi (kontrak validasi lama dipertahankan)", async () => {
    const res = await actionAssignTeam("j1", members, "", "09:00", 60);
    expect(res.ok).toBe(false);
    expect(db.createManyCalls).toHaveLength(0);
    expect(db.updateCalls).toHaveLength(0);
  });

  it("jobId tidak ada di tenant ini → NOT_FOUND tanpa mutasi", async () => {
    const res = await actionAssignTeam("j-asing", members, "2026-10-05", "09:00", 60);
    expect(res.ok).toBe(false);
    expect(db.createManyCalls).toHaveLength(0);
    expect(db.updateCalls).toHaveLength(0);
  });
});