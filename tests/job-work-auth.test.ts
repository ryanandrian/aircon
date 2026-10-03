import { describe, it, expect, vi, beforeEach } from "vitest";

const store: any = {};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    jobOrder: { findFirst: vi.fn(async () => store.job) },
    jobAssignment: { findFirst: vi.fn(async () => store.assignment) },
  },
}));

import { assertCanOperateOnJob } from "../src/lib/services/job-work-service";

/**
 * FASE 3 — siapa boleh bekerja pada sebuah pekerjaan (upload foto checklist, isi checklist, dst).
 *
 * Bukti dari DB live (read-only):
 *  - JobAssignment: 70 TECHNICIAN + 23 KERNET (kernet NYATA dipakai).
 *  - 3 sampel assignment kernet: `job.technicianId != kernet.id` (MATCH=false semua).
 *  → pemeriksaan lama `job.technicianId === saya` menolak kernet yang ditugaskan.
 */
describe("assertCanOperateOnJob — teknisi lead maupun anggota tim (kernet)", () => {
  beforeEach(() => {
    store.job = { id: "job1", technicianId: "techLead" };
    store.assignment = null;
  });

  it("teknisi lead (job.technicianId) pada job milik tenant: lolos", async () => {
    await expect(assertCanOperateOnJob("t1", "techLead", "job1")).resolves.toBeUndefined();
  });

  it("kernet yang terdaftar di JobAssignment untuk job itu: lolos", async () => {
    store.job = { id: "job1", technicianId: "techLead" }; // job dipegang TEKNISI lain
    store.assignment = { id: "as1", personId: "kernet1", roleOnJob: "KERNET" };
    await expect(assertCanOperateOnJob("t1", "kernet1", "job1")).resolves.toBeUndefined();
  });

  it("bukan lead dan tidak ada JobAssignment: tolak", async () => {
    store.job = { id: "job1", technicianId: "techLead" };
    store.assignment = null;
    await expect(assertCanOperateOnJob("t1", "orangLain", "job1")).rejects.toThrow(/bukan tugas/i);
  });

  it("job tidak ditemukan / lintas-tenant: tolak (query tenant-scoped)", async () => {
    store.job = null;
    await expect(assertCanOperateOnJob("t1", "techLead", "job-tidak-ada")).rejects.toThrow(/bukan tugas/i);
  });
});
