import { describe, it, expect, vi } from "vitest";

// Perluasan guard assign: ACCEPTED ditambahkan (permintaan pemilik 2026-10-14).
//
// BUKTI: job Effi (Jaya Mandiri) berstatus ACCEPTED — teknisi Ryan sudah menekan
// "Terima" di aplikasi /t, tapi admin belum mengirim notifikasi/invoice & tidak
// bisa mengoreksi tim karena panel edit disembunyikan. Guard lama {DRAFT, ASSIGNED}
// menutup pintu terlalu dini.
//
// BATAS YANG DIPERTAHANKAN (jangan sampai salah jaga):
// - ACCEPTED = teknisi MENERIMA tapi BELUM BERANGKAT (kerja mulai di EN_ROUTE)
//   → masih boleh dikoreksi admin (sama dgn CANCELLABLE yang sudah mencakup
//   ACCEPTED — bukti pemilik sendiri boleh membatalkan di status ini).
// - EN_ROUTE/ARRIVED/IN_PROGRESS/WAITING tetap TIDAK boleh di-assign ulang
//   (teknisi sudah di jalan / mengerjakan — pekerjaan tidak boleh berubah).
// - COMPLETED/CANCELLED tetap terminal.

vi.mock("server-only", () => ({}));
vi.mock("@/lib/services/push-notification-service", () => ({
  notifyAssignees: vi.fn(async () => ({ perPerson: [] })),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    jobOrder: {
      findFirst: vi.fn(),
      update: vi.fn(async () => ({})),
    },
    jobAssignment: {
      findMany: vi.fn(async () => []),
      deleteMany: vi.fn(async () => ({ count: 0 })),
      createMany: vi.fn(async ({ data }: any) => ({ count: data.length })),
    },
    technician: { findMany: vi.fn(async () => []) },
    $transaction: vi.fn(async (fn: any) => fn({
      jobOrder: { update: vi.fn(async () => ({})) },
      jobAssignment: {
        deleteMany: vi.fn(async () => ({ count: 0 })),
        createMany: vi.fn(async ({ data }: any) => ({ count: data.length })),
      },
    })),
  },
}));

import { assignJob } from "@/lib/services/assignment-service";
import { prisma } from "@/lib/prisma";

const mockPrisma = prisma as any;

const OK_JOB = { id: "j1", status: "ACCEPTED" };
const PEOPLE = [{ personId: "p1", roleOnJob: "TECHNICIAN" as const }];

describe("assignJob — guard status (perluasan ACCEPTED)", () => {
  it("ACCEPTED diperbolehkan (teknisi terima tapi belum berangkat)", async () => {
    mockPrisma.jobOrder.findFirst.mockResolvedValueOnce(OK_JOB);
    mockPrisma.technician.findMany.mockResolvedValueOnce([{ id: "p1", userId: "u1", user: { name: "Ryan" } }]);
    // kontrak kini: assignJob mengembalikan PushDeliveryReport (G-A9b)
    await expect(assignJob("t1", "j1", PEOPLE)).resolves.toMatchObject({ perPerson: [] });
  });

  it("EN_ROUTE ditolak (teknisi sudah berangkat)", async () => {
    mockPrisma.jobOrder.findFirst.mockResolvedValueOnce({ id: "j1", status: "EN_ROUTE" });
    await expect(assignJob("t1", "j1", PEOPLE)).rejects.toThrow();
  });

  it("IN_PROGRESS ditolak", async () => {
    mockPrisma.jobOrder.findFirst.mockResolvedValueOnce({ id: "j1", status: "IN_PROGRESS" });
    await expect(assignJob("t1", "j1", PEOPLE)).rejects.toThrow();
  });

  it("COMPLETED tetap ditolak (terminal)", async () => {
    mockPrisma.jobOrder.findFirst.mockResolvedValueOnce({ id: "j1", status: "COMPLETED" });
    await expect(assignJob("t1", "j1", PEOPLE)).rejects.toThrow();
  });

  it("CANCELLED tetap ditolak (terminal)", async () => {
    mockPrisma.jobOrder.findFirst.mockResolvedValueOnce({ id: "j1", status: "CANCELLED" });
    await expect(assignJob("t1", "j1", PEOPLE)).rejects.toThrow();
  });
});
