import { describe, it, expect, vi, beforeEach } from "vitest";

// Test adapter bentuk callback transaksi, tanpa memuat client DB nyata.
vi.mock("@prisma/client", () => ({ Prisma: { Decimal: class Decimal { constructor(public value: unknown) {} } } }));

import { createJob } from "../src/lib/services/job-management-service";

const store: { assignments: any[]; events: any[]; jobs: any[] } = { assignments: [], events: [], jobs: [] };
let txAudit: Record<string, number> = {};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    customer: {
      findFirst: vi.fn(async ({ where }: any) =>
        where.id === "customer-1" && where.tenantId === "tenant-1"
          ? { id: "customer-1", address: "Jl. Contoh", geoLat: null, geoLng: null }
          : null),
    },
    asset: {
      findFirst: vi.fn(async ({ where }: any) =>
        where.id === "asset-1" && where.tenantId === "tenant-1" && where.customerId === "customer-1"
          ? { id: "asset-1" }
          : null),
    },
    technician: {
      findFirst: vi.fn(async ({ where }: any) =>
        where.id === "tech-1" && where.tenantId === "tenant-1"
          ? { id: "tech-1" }
          : null),
    },
    jobOrder: { create: vi.fn() },
    jobProgressEvent: { create: vi.fn() },
    jobAssignment: { create: vi.fn() },
    $transaction: vi.fn(async (fn: (tx: any) => Promise<unknown>) => {
      const tx = {
        jobOrder: {
          create: vi.fn(async ({ data }: any) => {
            const row = { id: `job-${store.jobs.length + 1}`, ...data };
            store.jobs.push(row);
            return row;
          }),
        },
        jobProgressEvent: {
          create: vi.fn(async ({ data }: any) => {
            store.events.push(data);
            return { id: `event-${store.events.length}` };
          }),
        },
        jobAssignment: {
          create: vi.fn(async ({ data }: any) => {
            store.assignments.push(data);
            return { id: `assignment-${store.assignments.length}`, ...data };
          }),
        },
      };
      txAudit = {
        job: tx.jobOrder.create.mock.calls.length,
        event: tx.jobProgressEvent.create.mock.calls.length,
        assignment: tx.jobAssignment.create.mock.calls.length,
      };
      const result = await fn(tx);
      txAudit = {
        job: tx.jobOrder.create.mock.calls.length,
        event: tx.jobProgressEvent.create.mock.calls.length,
        assignment: tx.jobAssignment.create.mock.calls.length,
      };
      return result;
    }),
  },
}));

const base = {
  customerId: "customer-1",
  assetId: "asset-1",
  serviceType: "CLEANING" as const,
};

// Reset store antar-test (id job & penanda event sengaja dibuat ulang tiap test).
beforeEach(() => {
  store.jobs = [];
  store.events = [];
  store.assignments = [];
  txAudit = {};
});

describe("createJob — satu sumber penugasan", () => {
  it("tanpa teknisi: DRAFT, technicianId null, tidak membuat assignment (nanti lewat Tugaskan Tim)", async () => {
    const job = await createJob("tenant-1", "owner-1", base);
    expect(job.status).toBe("DRAFT");
    expect(job.technicianId).toBeNull();
    expect(store.assignments).toEqual([]);
    expect(store.events).toHaveLength(1);
    expect(store.events[0].toStatus).toBe("DRAFT");
    expect(txAudit).toEqual({ job: 1, event: 1, assignment: 0 });
  });

  it("dengan teknisi + jadwal: ASSIGNED + 1 JobAssignment TECHNICIAN/lead dalam transaksi", async () => {
    const scheduledDate = new Date(2026, 9, 5, 9, 0);
    const job = await createJob("tenant-1", "owner-1", {
      ...base,
      technicianId: "tech-1",
      scheduledDate,
      windowStart: scheduledDate,
    });
    expect(job.status).toBe("ASSIGNED");
    expect(job.technicianId).toBe("tech-1");
    expect(store.assignments).toEqual([{
      tenantId: "tenant-1", jobId: job.id, personId: "tech-1",
      roleOnJob: "TECHNICIAN", isLead: true,
    }]);
    expect(txAudit).toEqual({ job: 1, event: 1, assignment: 1 });
  });

  it("teknisi tanpa tanggal: DRAFT + roster dibuat (status tidak menyatakan sudah ditugaskan)", async () => {
    const job = await createJob("tenant-1", "owner-1", { ...base, technicianId: "tech-1" });
    expect(job.status).toBe("DRAFT");
    expect(job.technicianId).toBe("tech-1");
    expect(store.assignments[0]).toMatchObject({
      personId: "tech-1", roleOnJob: "TECHNICIAN", isLead: true,
    });
  });

  it("menolak teknisi dari tenant lain sebelum menulis job/event/assignment", async () => {
    await expect(createJob("tenant-1", "owner-1", { ...base, technicianId: "foreign-tech" }))
      .rejects.toThrow("Teknisi tidak ditemukan");
    expect(store.jobs).toEqual([]);
    expect(store.events).toEqual([]);
    expect(store.assignments).toEqual([]);
  });
});
