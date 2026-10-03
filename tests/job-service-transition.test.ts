import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * FASE 5 — penutupan jalur penyelesaian FOSIL.
 *
 * Setelah FASE 4, SATU-satunya penyelesaian = closeWorkSession (sesi + dokumen + efek atomik).
 * transitionJob harus MENOLAK toStatus COMPLETED apa pun kondisinya; kalau tidak, status bisa
 * jadi COMPLETED tanpa tagihan/reminder/review = kembali ke dua-jalur (bukti nyata live:
 * 1 job COMPLETED tanpa invoice).
 */
const store: any = {};
vi.mock("@/lib/prisma", () => ({
  prisma: {
    jobProgressEvent: {
      findUnique: vi.fn(async () => store.duplicateEvent ?? null),
      create: vi.fn(async (a: any) => { store.events.push(a.data); return {}; }),
    },
    jobOrder: {
      findFirst: vi.fn(async () => store.job),
      update: vi.fn(async ({ data }: any) => { store.jobUpdates.push(data); return { ...store.job, ...data }; }),
    },
    // guard legacy FASE 5: tidak ada template per-serviceType -> tidak mengunci
    checklistTemplate: { findFirst: vi.fn(async () => null) },
    checklistResult: { findMany: vi.fn(async () => []) },
    jobPhoto: { count: vi.fn(async () => 0) },
    asset: { findUnique: vi.fn(async () => null), update: vi.fn(async () => ({})), findMany: vi.fn(async () => []) },
    tenant: { findUnique: vi.fn(async () => ({ maintenanceIntervalDays: 90, reminderLeadDays: 3 })) },
    workSession: { findMany: vi.fn(async () => []) },
    repeatReminder: { upsert: vi.fn(async () => ({})) },
    reviewRequest: { create: vi.fn(async () => ({})) },
    $transaction: vi.fn(async (fn: any) => fn({
      jobOrder: { update: vi.fn(async ({ data }: any) => { store.jobUpdates.push(data); return { ...store.job, ...data }; }) },
      asset: { findUnique: vi.fn(async () => null), update: vi.fn(async () => ({})), findMany: vi.fn(async () => []) },
      tenant: { findUnique: vi.fn(async () => ({ maintenanceIntervalDays: 90, reminderLeadDays: 3 })) },
      workSession: { findMany: vi.fn(async () => []) },
      repeatReminder: { upsert: vi.fn(async () => ({})) },
      reviewRequest: { create: vi.fn(async () => ({})) },
      jobProgressEvent: { create: vi.fn(async (a: any) => { store.events.push(a.data); return {}; }) },
    })),
  },
}));

import { transitionJob, TransitionError } from "../src/lib/services/job-service";

beforeEach(() => {
  store.events = [];
  store.jobUpdates = [];
  store.duplicateEvent = null;
  store.job = { id: "job1", tenantId: "t1", status: "IN_PROGRESS", serviceType: "CLEANING", assetId: null, customerId: "c1" };
});

describe("transitionJob — FASE 5: COMPLETED diambil alih closeWorkSession", () => {
  it("menolak toStatus COMPLETED (tidak ada jalan pintas status final)", async () => {
    await expect(transitionJob({
      tenantId: "t1", jobId: "job1", toStatus: "COMPLETED",
      actorId: "u1", role: "TECHNICIAN",
    })).rejects.toThrow(TransitionError);
    expect(store.jobUpdates).toHaveLength(0); // tak ada tulisan status apa pun
  });

  it("transisi non-final TETAP jalan (ARRIVED → IN_PROGRESS)", async () => {
    store.job.status = "ARRIVED";
    const r = await transitionJob({
      tenantId: "t1", jobId: "job1", toStatus: "IN_PROGRESS",
      actorId: "u1", role: "TECHNICIAN",
    });
    expect(r.job?.status).toBe("IN_PROGRESS");
    expect(store.jobUpdates).toHaveLength(1);
  });
});
