import { describe, it, expect, vi, beforeEach } from "vitest";

// G-A5 — kontrak notifikasi penugasan: KEDUA titik assignment harus memanggil
// notifyAssignees, dengan argumen benar, dan kegagalan push TIDAK boleh
// menggagalkan penugasan.
//
// TDD: test ini ditulis setelah wiring ada → dibuktikan RED dengan MENGHAPUS
// wiring sementara (lihat catatan sesi). Tanpa bukti RED, test ini = tests-after
// yang tak membuktikan apa-apa.

vi.mock("server-only", () => ({}));
vi.mock("@/lib/services/push-notification-service", () => ({
  notifyAssignees: vi.fn(async () => {}),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    jobOrder: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
    jobProgressEvent: { create: vi.fn() },
    technician: { findMany: vi.fn(async () => []), findFirst: vi.fn() },
    jobAssignment: {
      findMany: vi.fn(async () => []),
      deleteMany: vi.fn(async () => ({ count: 0 })),
      createMany: vi.fn(async ({ data }: any) => ({ count: data.length })),
      create: vi.fn(async (x: any) => x.data),
    },
    customer: { findFirst: vi.fn(), findUnique: vi.fn() },
    asset: { findFirst: vi.fn(async () => null) },
    $transaction: vi.fn(async (fn: any) => {
      const tx = {
        jobOrder: {
          create: vi.fn(async (a: any) => ({ id: "job-new", ...a.data })),
          update: vi.fn(async () => ({})),
          findFirst: vi.fn(async () => null),
        },
        jobProgressEvent: { create: vi.fn(async () => ({})) },
        jobAssignment: {
          deleteMany: vi.fn(async () => ({ count: 0 })),
          createMany: vi.fn(async ({ data }: any) => ({ count: data.length })),
          create: vi.fn(async (a: any) => a.data),
        },
      };
      return fn(tx);
    }),
  },
}));
vi.mock("@/lib/services/customer-service", () => ({
  ServiceError: class extends Error {},
  resolveBillingContact: vi.fn(),
}));
// job-management-service TIDAK di-mock seluruhnya — createJob harus ASLI
// (test ini mengujinya). Prisma & push service sudah dimock di atas.

import { notifyAssignees } from "@/lib/services/push-notification-service";
import { assignJob } from "@/lib/services/assignment-service";
import { createJob } from "@/lib/services/job-management-service";

const mockNotify = vi.mocked(notifyAssignees);
const prisma = (await import("@/lib/prisma")).prisma as any;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("titik 1 — assignJob memanggil notifyAssignees", () => {
  it("dipanggil DENGAN tenantId, jobId, personIds yang benar", async () => {
    (prisma.jobOrder.findFirst as any).mockResolvedValue({ id: "j1", status: "DRAFT" });
    (prisma.technician.findMany as any).mockResolvedValue([{ id: "p1" }, { id: "p2" }]);

    await assignJob("t1", "j1", [
      { personId: "p1", roleOnJob: "TECHNICIAN", isLead: true },
      { personId: "p2", roleOnJob: "KERNET" },
    ]);

    expect(mockNotify).toHaveBeenCalledTimes(1);
    expect(mockNotify).toHaveBeenCalledWith({ tenantId: "t1", jobId: "j1", personIds: ["p1", "p2"] });
  });

  it("TIDAK dipanggil bila penugasan ditolak (guard status) — tak ada notifikasi palsu", async () => {
    (prisma.jobOrder.findFirst as any).mockResolvedValue({ id: "j1", status: "COMPLETED" });

    await expect(assignJob("t1", "j1", [{ personId: "p1", roleOnJob: "TECHNICIAN" }])).rejects.toThrow();
    expect(mockNotify).not.toHaveBeenCalled();
  });
});

describe("titik 2 — createJob memanggil notifyAssignees SETELAH commit", () => {
  it("dipanggil utk teknisi dari form, dengan job id hasil transaksi", async () => {
    (prisma.customer.findFirst as any).mockResolvedValue({ id: "c1", address: "Jl. A" });
    (prisma.technician.findFirst as any).mockResolvedValue({ id: "tech1" });

    const job = await createJob("t1", "u1", {
      customerId: "c1",
      serviceType: "SERVICE" as any,
      technicianId: "tech1",
      scheduledDate: new Date(),
    } as any);

    expect(mockNotify).toHaveBeenCalledTimes(1);
    expect(mockNotify).toHaveBeenCalledWith({ tenantId: "t1", jobId: job.id, personIds: ["tech1"] });
  });

  it("TIDAK dipanggil bila job tanpa teknisi (tak ada yang ditugaskan)", async () => {
    (prisma.customer.findUnique as any).mockResolvedValue({ id: "c1", address: null });

    await createJob("t1", "u1", {
      customerId: "c1",
      serviceType: "SERVICE" as any,
    } as any);

    expect(mockNotify).not.toHaveBeenCalled();
  });
});

describe("kontrak aman-gagal — push tak pernah menggagalkan penugasan", () => {
  it("notifyAssignees menelan error internal (jobQuery gagal) tanpa melempar", async () => {
    (prisma.jobOrder.findFirst as any).mockRejectedValue(new Error("DB down"));
    await expect(notifyAssignees({ tenantId: "t", jobId: "j", personIds: ["p"] })).resolves.toBeUndefined();
  });

  it("notifyAssignees tanpa personel = no-op tanpa query job", async () => {
    (prisma.jobOrder.findFirst as any).mockReset();
    await notifyAssignees({ tenantId: "t", jobId: "j", personIds: [] });
    expect(prisma.jobOrder.findFirst).not.toHaveBeenCalled();
  });
});
