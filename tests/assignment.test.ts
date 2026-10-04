import { describe, it, expect, vi, beforeEach } from "vitest";
import { windowsOverlap } from "../src/lib/services/assignment-service";

vi.mock("@/lib/services/customer-service", () => ({
  ServiceError: class ServiceError extends Error {
    code: string;
    constructor(code: string, message: string) { super(message); this.code = code; }
  },
}));

/** F3.2 — deteksi bentrok jadwal (windowsOverlap murni) + detectConflict (queried) + assignJob. */

const d = (s: string) => new Date(s);

describe("windowsOverlap (murni)", () => {
  it("overlap penuh", () => {
    expect(windowsOverlap({ start: d("2026-08-28T09:00"), end: d("2026-08-28T11:00") },
      { start: d("2026-08-28T10:00"), end: d("2026-08-28T12:00") })).toBe(true);
  });
  it("tidak overlap (terpisah)", () => {
    expect(windowsOverlap({ start: d("2026-08-28T09:00"), end: d("2026-08-28T10:00") },
      { start: d("2026-08-28T10:30"), end: d("2026-08-28T11:30") })).toBe(false);
  });
  it("bersentuhan di ujung TIDAK bentrok", () => {
    expect(windowsOverlap({ start: d("2026-08-28T09:00"), end: d("2026-08-28T10:00") },
      { start: d("2026-08-28T10:00"), end: d("2026-08-28T11:00") })).toBe(false);
  });
  it("satu di dalam yang lain", () => {
    expect(windowsOverlap({ start: d("2026-08-28T09:00"), end: d("2026-08-28T12:00") },
      { start: d("2026-08-28T10:00"), end: d("2026-08-28T10:30") })).toBe(true);
  });
});

// ---------- detectConflict + assignJob (mocked prisma) ----------
const store: { assignments: any[]; jobs: any[]; techs: any[] } = { assignments: [], jobs: [], techs: [] };
let txCreateMany: any[] = [];
let txJobUpdates: any[] = [];

vi.mock("@/lib/prisma", () => ({
  prisma: {
    jobAssignment: {
      findMany: vi.fn(async ({ where }: any) =>
        store.assignments.filter((a) => a.tenantId === where.tenantId && (!where.personId || a.personId === where.personId) && (!where.jobId || a.jobId === where.jobId))
          .map((a) => ({ ...a, person: { id: a.personId, user: { name: a.name ?? "P" } } })),
      ),
      deleteMany: vi.fn(async () => ({ count: 0 })),
      createMany: vi.fn(async ({ data }: any) => { txCreateMany = data; return { count: data.length }; }),
    },
    jobOrder: {
      findMany: vi.fn(async ({ where }: any) => {
        // OR: [{id in jobIds}, {technicianId: personId}]
        return store.jobs.filter((j) => {
          if (j.tenantId !== where.tenantId) return false;
          if (j.deletedAt) return false;
          if (["COMPLETED", "CANCELLED"].includes(j.status)) return false;
          if (!j.windowStart || !j.windowEnd) return false;
          if (where.id?.not && j.id === where.id.not) return false;
          const jobIds = where.OR[0].id.in;
          const pid = where.OR[1].technicianId;
          return jobIds.includes(j.id) || j.technicianId === pid;
        }).map((j) => ({ id: j.id, windowStart: j.windowStart, windowEnd: j.windowEnd, customer: { name: j.customerName ?? "C" } }));
      }),
      findFirst: vi.fn(async ({ where }: any) => store.jobs.find((j) => j.id === where.id && j.tenantId === where.tenantId) ?? null),
      update: vi.fn(async ({ where, data }: any) => { txJobUpdates.push(data); return { ...store.jobs.find((j) => j.id === where.id), ...data }; }),
    },
    technician: {
      findMany: vi.fn(async ({ where }: any) => store.techs.filter((t) => t.tenantId === where.tenantId && where.id.in.includes(t.id))),
    },
    $transaction: vi.fn(async (fn: any) => fn({
      jobAssignment: {
        deleteMany: vi.fn(async () => ({ count: 0 })),
        createMany: vi.fn(async ({ data }: any) => { txCreateMany = data; return { count: data.length }; }),
      },
      jobOrder: { update: vi.fn(async ({ data }: any) => { txJobUpdates.push(data); return { ...data }; }) },
    })),
  },
}));

import { detectConflict, assignJob } from "../src/lib/services/assignment-service";

beforeEach(() => {
  txCreateMany = [];
  txJobUpdates = [];
  store.techs = [{ id: "p1", tenantId: "t1" }, { id: "p2", tenantId: "t1" }];
  store.jobs = [
    { id: "j1", tenantId: "t1", status: "ASSIGNED", deletedAt: null, technicianId: "p1",
      windowStart: d("2026-08-28T09:00"), windowEnd: d("2026-08-28T11:00"), customerName: "PT A" },
  ];
  store.assignments = [{ tenantId: "t1", jobId: "j1", personId: "p1", roleOnJob: "TECHNICIAN", isLead: true }];
});

describe("detectConflict", () => {
  it("mendeteksi overlap dgn job existing person", async () => {
    const c = await detectConflict("t1", "p1", d("2026-08-28T10:00"), d("2026-08-28T12:00"));
    expect(c).toHaveLength(1);
    expect(c[0].jobId).toBe("j1");
  });
  it("tak ada konflik bila waktu terpisah", async () => {
    const c = await detectConflict("t1", "p1", d("2026-08-28T13:00"), d("2026-08-28T14:00"));
    expect(c).toHaveLength(0);
  });
  it("excludeJobId mengabaikan job itu sendiri (edit)", async () => {
    const c = await detectConflict("t1", "p1", d("2026-08-28T10:00"), d("2026-08-28T12:00"), "j1");
    expect(c).toHaveLength(0);
  });
  it("person tanpa job → tak konflik", async () => {
    const c = await detectConflict("t1", "p2", d("2026-08-28T10:00"), d("2026-08-28T12:00"));
    expect(c).toHaveLength(0);
  });
});

describe("assignJob", () => {
  it("multi-personel peran cair; lead default personel pertama", async () => {
    await assignJob("t1", "j1", [
      { personId: "p1", roleOnJob: "TECHNICIAN" },
      { personId: "p2", roleOnJob: "KERNET" },
    ]);
    expect(txCreateMany).toHaveLength(2);
    expect(txCreateMany[0].isLead).toBe(true);  // p1 lead default
    expect(txCreateMany[1].isLead).toBe(false);
    expect(txCreateMany[1].roleOnJob).toBe("KERNET");
  });
  it("hormati isLead eksplisit", async () => {
    await assignJob("t1", "j1", [
      { personId: "p1", roleOnJob: "KERNET" },
      { personId: "p2", roleOnJob: "TECHNICIAN", isLead: true },
    ]);
    const lead = txCreateMany.find((x) => x.isLead);
    expect(lead.personId).toBe("p2");
  });
  it("tolak personel bukan milik tenant", async () => {
    await expect(assignJob("t1", "j1", [{ personId: "pX", roleOnJob: "TECHNICIAN" }])).rejects.toThrow();
  });
  it("tolak daftar kosong", async () => {
    await expect(assignJob("t1", "j1", [])).rejects.toThrow();
  });

  // ---- Poin 2: jadwal konsisten (scheduledDate ikut tersimpan) ----
  it("menulis scheduledDate identik window.start bersama window saat diberikan", async () => {
    await assignJob("t1", "j1",
      [{ personId: "p1", roleOnJob: "TECHNICIAN" }],
      { start: d("2026-08-28T09:00"), end: d("2026-08-28T11:00") },
    );
    expect(txJobUpdates).toHaveLength(1);
    expect(txJobUpdates[0]).toMatchObject({
      technicianId: "p1",
      scheduledDate: d("2026-08-28T09:00"),
      windowStart: d("2026-08-28T09:00"),
      windowEnd: d("2026-08-28T11:00"),
    });
    // JANGAN pernah derive ulang lewat toISOString — harus instan yang sama.
    expect(txJobUpdates[0].scheduledDate.getTime()).toBe(txJobUpdates[0].windowStart.getTime());
  });
  it("tanpa window: jadwal existing TIDAK disentuh (hanya roster/lead)", async () => {
    await assignJob("t1", "j1", [{ personId: "p1", roleOnJob: "TECHNICIAN" }]);
    expect(txJobUpdates).toHaveLength(1);
    expect(txJobUpdates[0]).not.toHaveProperty("scheduledDate");
    expect(txJobUpdates[0]).not.toHaveProperty("windowStart");
    expect(txJobUpdates[0]).not.toHaveProperty("windowEnd");
    expect(txJobUpdates[0]).toMatchObject({ technicianId: "p1" });
  });

  // ---- Poin 2: guard status di lapisan service (bukan hanya tombol FE) ----
  it("tolak reassign bila status job sudah berjalan", async () => {
    store.jobs[0] = { ...store.jobs[0], status: "IN_PROGRESS" };
    await expect(
      assignJob("t1", "j1", [{ personId: "p1", roleOnJob: "TECHNICIAN" }],
        { start: d("2026-08-28T09:00"), end: d("2026-08-28T11:00") }),
    ).rejects.toThrow();
    expect(txCreateMany).toHaveLength(0); // roster tidak dihapus/retulis
    expect(txJobUpdates).toHaveLength(0); // job tidak diupdate
  });
  it("tolak bila status COMPLETED / CANCELLED (terminal)", async () => {
    for (const status of ["COMPLETED", "CANCELLED"]) {
      txCreateMany = []; txJobUpdates = [];
      store.jobs[0] = { ...store.jobs[0], status };
      await expect(assignJob("t1", "j1", [{ personId: "p1", roleOnJob: "TECHNICIAN" }])).rejects.toThrow();
      expect(txJobUpdates).toHaveLength(0);
    }
  });
  it("DRAFT dan ASSIGNED tetap boleh (kontrak UI ASSIGNABLE)", async () => {
    for (const status of ["DRAFT", "ASSIGNED"]) {
      txCreateMany = []; txJobUpdates = [];
      store.jobs[0] = { ...store.jobs[0], status };
      await assignJob("t1", "j1", [{ personId: "p1", roleOnJob: "TECHNICIAN" }],
        { start: d("2026-08-28T09:00"), end: d("2026-08-28T10:00") });
      expect(txJobUpdates).toHaveLength(1);
      expect(txJobUpdates[0].scheduledDate).toEqual(d("2026-08-28T09:00"));
    }
  });
});
