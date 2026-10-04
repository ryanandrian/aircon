import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Poin 3 — fasilitas edit Catatan pekerjaan (field `JobOrder.notes`) sebelum closing.
 *
 * Audit repo: `actionUpdateJob`/`actionEditJob` TIDAK ADA → fasilitas edit ini memang
 * belum pernah ada, dan inilah satu-satunya jalur edit umum baru di scope 5 poin.
 *
 * Kontrak:
 * - hanya OWNER/ADMIN (dicek di action, diuji terpisah);
 * - tenant-scoped: job tenant lain tidak terlihat;
 * - ditolak bila status terminal (COMPLETED/CANCELLED) — closing = closeWorkSession;
 * - status aktif (DRAFT..WAITING) boleh diedit;
 * - HANYA `notes` yang berubah; customer/asset/roster/jadwal/status tidak tersentuh.
 */

const store: { jobs: any[] } = { jobs: [] };

vi.mock("@/lib/prisma", () => ({
  prisma: {
    jobOrder: {
      findFirst: vi.fn(async ({ where }: any) =>
        store.jobs.find((j) => j.id === where.id && j.tenantId === where.tenantId && !j.deletedAt) ?? null,
      ),
      update: vi.fn(async ({ where, data }: any) => {
        const job = store.jobs.find((j) => j.id === where.id);
        if (job) Object.assign(job, data);
        return { ...job, ...data };
      }),
    },
  },
}));

vi.mock("@/lib/services/customer-service", () => ({
  ServiceError: class ServiceError extends Error {
    code: string;
    constructor(code: string, message: string) { super(message); this.code = code; }
  },
}));

let session: { tenantId: string; userId: string; role: string; name: string };

vi.mock("@/lib/auth/context", () => ({
  getServerContext: vi.fn(async () => session),
  tryGetServerContext: vi.fn(async () => session),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { updateJobNotes } from "../src/lib/services/job-management-service";
import { JobError } from "../src/lib/services/job-management-service";
import { actionUpdateJobNotes } from "../src/app/app/pekerjaan/actions";

beforeEach(() => {
  session = { tenantId: "t1", userId: "u1", role: "OWNER", name: "Pemilik" };
  store.jobs = [
    { id: "j-draft", tenantId: "t1", status: "DRAFT", deletedAt: null, notes: null, customerId: "c1", assetId: null, price: null, scheduledDate: null },
    { id: "j-active", tenantId: "t1", status: "IN_PROGRESS", deletedAt: null, notes: "lama", customerId: "c1", assetId: null, price: null, scheduledDate: null },
    { id: "j-done", tenantId: "t1", status: "COMPLETED", deletedAt: null, notes: "selesai", customerId: "c1", assetId: null, price: null, scheduledDate: null },
    { id: "j-cancel", tenantId: "t1", status: "CANCELLED", deletedAt: null, notes: null, customerId: "c1", assetId: null, price: null, scheduledDate: null },
    { id: "j-asing", tenantId: "T-ASING", status: "DRAFT", deletedAt: null, notes: "rahasia", customerId: "cX", assetId: null, price: null, scheduledDate: null },
    { id: "j-hapus", tenantId: "t1", status: "DRAFT", deletedAt: true, notes: null, customerId: "c1", assetId: null, price: null, scheduledDate: null },
  ];
});

describe("updateJobNotes — edit catatan sebelum closing (Poin 3)", () => {
  it("job DRAFT: notes baru tersimpan", async () => {
    await updateJobNotes("t1", "j-draft", "baru");
    expect(store.jobs[0].notes).toBe("baru");
  });

  it("status aktif (IN_PROGRESS): catatan tetap boleh dikoreksi", async () => {
    await updateJobNotes("t1", "j-active", "dikoreksi teknisi lupa bawa freon");
    expect(store.jobs[1].notes).toBe("dikoreksi teknisi lupa bawa freon");
  });

  it("string kosong → dihapus (null) — konsisten dengan konvensi customer/asset (?? null)", async () => {
    await updateJobNotes("t1", "j-active", "   ");
    expect(store.jobs[1].notes).toBeNull();
  });

  it("ditolak untuk COMPLETED (hanya closeWorkSession yang boleh finalisasi)", async () => {
    await expect(updateJobNotes("t1", "j-done", "diubah")).rejects.toThrow(JobError);
    expect(store.jobs[2].notes).toBe("selesai"); // tidak berubah
  });

  it("ditolak untuk CANCELLED (terminal)", async () => {
    await expect(updateJobNotes("t1", "j-cancel", "diubah")).rejects.toThrow(JobError);
    expect(store.jobs[3].notes).toBeNull();
  });

  it("job tenant lain → NOT_FOUND (tidak bocor lintas tenant)", async () => {
    await expect(updateJobNotes("t1", "j-asing", "disusupi")).rejects.toThrow(JobError);
    expect(store.jobs[4].notes).toBe("rahasia");
  });

  it("job terhapus soft-delete → NOT_FOUND", async () => {
    await expect(updateJobNotes("t1", "j-hapus", "diubah")).rejects.toThrow(JobError);
    expect(store.jobs[5].notes).toBeNull();
  });

  it("HANYA notes yang berubah — field lain tidak tersentuh", async () => {
    const before = { ...store.jobs[1] };
    await updateJobNotes("t1", "j-active", "catatan baru");
    const after = store.jobs[1];
    expect(after.notes).toBe("catatan baru");
    for (const k of ["customerId", "assetId", "price", "scheduledDate", "status", "tenantId"] as const) {
      expect(after[k]).toEqual(before[k]);
    }
  });
});

// ---- Layer ACTION (role guard + pesan sampai ke user) ----
describe("actionUpdateJobNotes — guard role & pesan (Poin 3)", () => {
  it("OWNER sukses + revalidate path detail", async () => {
    const { revalidatePath } = await import("next/cache");
    const res = await actionUpdateJobNotes("j-draft", "catatan dari action");
    expect(res.ok).toBe(true);
    expect(store.jobs[0].notes).toBe("catatan dari action");
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith("/app/pekerjaan");
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith("/app/pekerjaan/j-draft");
  });

  it("ADMIN juga boleh", async () => {
    session = { tenantId: "t1", userId: "u2", role: "ADMIN", name: "Admin" };
    const res = await actionUpdateJobNotes("j-draft", "admin");
    expect(res.ok).toBe(true);
  });

  it("TEKNISI DITOLAK (role guard) — job tidak berubah", async () => {
    session = { tenantId: "t1", userId: "u3", role: "TECHNICIAN", name: "Tukang" };
    const res = await actionUpdateJobNotes("j-draft", "disisipi teknisi");
    expect(res.ok).toBe(false);
    expect(store.jobs[0].notes).toBeNull();
  });

  it("job COMPLETED → res.ok false dgn pesan jelas (bukan throw)", async () => {
    const res = await actionUpdateJobNotes("j-done", "diubah");
    expect(res.ok).toBe(false);
    expect(!res.ok && res.error).toContain("selesai");
    expect(store.jobs[2].notes).toBe("selesai");
  });

  it("jobId kosong → error validasi sebelum query", async () => {
    const res = await actionUpdateJobNotes("", "x");
    expect(res.ok).toBe(false);
  });

  it("jobId asing (tenant lain) → ok=false, notes asing tak tersentuh", async () => {
    const res = await actionUpdateJobNotes("j-asing", "disusupi");
    expect(res.ok).toBe(false);
    expect(store.jobs[4].notes).toBe("rahasia");
  });
});
