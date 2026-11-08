import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Cegah "zombie": WorkSession OPEN yang tertaut job terminal (COMPLETED/CANCELLED).
 *
 * Gejala di lapangan (PT ASE 7 Nov 2026): "Tidak bisa ditutup meski job dibatalkan,
 * dibuatkan pekerjaan baru, dan dicoba teknisi lain" — karena sesi OPEN pelanggan itu
 * masih tertaut job lama yang sudah COMPLETED, dan closeWorkSession menolak status terminal.
 */
const store: {
  customer: { id: string } | null;
  job: { id: string; customerId: string; status: string } | null;
  jobsById: Record<string, { status: string }>;
  existing: { id: string; jobId: string | null } | null;
  created: Record<string, unknown> | null;
  updated: { data: Record<string, unknown> } | null;
  detached: string[];
} = {
  customer: { id: "cust-1" },
  job: null,
  jobsById: {},
  existing: null,
  created: null,
  updated: null,
  detached: [],
};

vi.mock("@/lib/storage/s3", () => ({ isOwnedPhotoUrl: () => false }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    customer: { findFirst: vi.fn(async () => store.customer) },
    jobOrder: {
      findFirst: vi.fn(async ({ where }: { where: { id?: string } }) => {
        if (where.id && store.jobsById[where.id]) {
          return { id: where.id, customerId: "cust-1", status: store.jobsById[where.id].status };
        }
        return store.job;
      }),
    },
    workSession: {
      findFirst: vi.fn(async () => store.existing),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        store.created = data;
        return { id: "ws-new" };
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        store.updated = { data };
        return { id: where.id };
      }),
      updateMany: vi.fn(async ({ where, data }: { where: { id?: string }; data: Record<string, unknown> }) => {
        if (where.id && "jobId" in data && data.jobId === null) store.detached.push(where.id);
        return { count: 1 };
      }),
    },
  },
}));

import { openWorkSession } from "../src/lib/services/worksession-service";

beforeEach(() => {
  store.existing = null;
  store.created = null;
  store.updated = null;
  store.detached = [];
  store.job = { id: "job-active", customerId: "cust-1", status: "IN_PROGRESS" };
  store.jobsById = {};
});

describe("openWorkSession — job terminal tak boleh jadi sesi baru", () => {
  it("job COMPLETED dari URL: DITOLAK", async () => {
    store.job = { id: "job-done", customerId: "cust-1", status: "COMPLETED" };
    await expect(openWorkSession("t1", "cust-1", "u1", "job-done")).rejects.toThrow(/selesai atau dibatalkan/i);
    expect(store.created).toBeNull();
  });

  it("job CANCELLED dari URL: DITOLAK", async () => {
    store.job = { id: "job-cancel", customerId: "cust-1", status: "CANCELLED" };
    await expect(openWorkSession("t1", "cust-1", "u1", "job-cancel")).rejects.toThrow(/selesai atau dibatalkan/i);
    expect(store.created).toBeNull();
  });
});

describe("openWorkSession — sesi zombie diperbaiki (lepas dari job terminal)", () => {
  it("sesi OPEN tertaut job COMPLETED + dibuka dengan job AKTIF: sesi dilepas lalu diarahkan ke job aktif", async () => {
    store.existing = { id: "ws-zombie", jobId: "job-done" };
    store.jobsById["job-done"] = { status: "COMPLETED" };
    const id = await openWorkSession("t1", "cust-1", "u1", "job-active");
    expect(store.detached).toContain("ws-zombie");
    expect(store.updated?.data).toMatchObject({ jobId: "job-active" });
    expect(id).toBe("ws-zombie");
    expect(store.created).toBeNull(); // sesi dipakai, tak dibuat baru
  });

  it("sesi OPEN tertaut job CANCELLED + dibuka tanpa job: sesi dilepas (jobId null), WorkItem tetap utuh", async () => {
    store.existing = { id: "ws-zombie2", jobId: "job-cancel" };
    store.jobsById["job-cancel"] = { status: "CANCELLED" };
    const id = await openWorkSession("t1", "cust-1", "u1");
    expect(store.detached).toContain("ws-zombie2");
    expect(store.updated).toBeNull();
    expect(id).toBe("ws-zombie2");
  });

  it("sesi OPEN tertaut job AKTIF: tak dilepas (regresi normal)", async () => {
    store.existing = { id: "ws-ok", jobId: "job-active" };
    const id = await openWorkSession("t1", "cust-1", "u1", "job-active");
    expect(store.detached).toEqual([]);
    expect(id).toBe("ws-ok");
  });

  it("sesi OPEN tanpa job + dibuka dengan job valid: taut-kan (perilaku B1 lama dipertahankan)", async () => {
    store.existing = { id: "ws-old", jobId: null };
    const id = await openWorkSession("t1", "cust-1", "u1", "job-active");
    expect(id).toBe("ws-old");
    expect(store.updated?.data).toMatchObject({ jobId: "job-active" });
  });
});
