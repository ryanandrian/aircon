import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/storage/s3", () => ({ isOwnedPhotoUrl: () => false }));

/**
 * FASE 6 — otorisasi tautan WorkSession ↔ JobOrder.
 *
 * Bukti dari kode (bukan asumsi): openWorkSession() menerima `jobId` dari klien TANPA
 * memverifikasi bahwa job itu milik tenant & customer yang sama. Pintu: /t/kerja/[customerId]?job=X.
 * Tanpa verifikasi, sesi pelanggan A bisa tertaut ke pekerjaan pelanggan B dalam tenant sama.
 * Pemeriksaan role TIDAK dipakai di sini: Role enum = OWNER/ADMIN/TECHNICIAN dan data live
 * menunjukkan pembuka sesi = OWNER + TECHNICIAN (keduanya sah); yang diverifikasi adalah
 * konsistensi sumber daya (tenant + customer), bukan role.
 */
const store: any = {};
vi.mock("@/lib/prisma", () => ({
  prisma: {
    customer: { findFirst: vi.fn(async () => store.customer) },
    jobOrder: { findFirst: vi.fn(async () => store.job) },
    workSession: {
      findFirst: vi.fn(async () => store.existing ?? null),
      create: vi.fn(async ({ data }: any) => { store.created = data; return { id: "ws-new" }; }),
      update: vi.fn(async ({ where, data }: any) => { store.updated = { where, data }; return { id: where.id }; }),
    },
  },
}));

import { openWorkSession } from "../src/lib/services/worksession-service";

beforeEach(() => {
  store.created = null;
  store.updated = null;
  store.existing = null;
  store.customer = { id: "cust-1" };
  store.job = { id: "job-1", customerId: "cust-1" };
});

describe("openWorkSession — tautan jobId diverifikasi (tenant + customer)", () => {
  it("tanpa jobId: buka sesi normal", async () => {
    const id = await openWorkSession("t1", "cust-1", "u1");
    expect(id).toBe("ws-new");
    expect(store.created).toMatchObject({ tenantId: "t1", customerId: "cust-1", jobId: null });
  });

  it("dengan jobId valid (milik customer yang sama): sesi tertaut", async () => {
    const id = await openWorkSession("t1", "cust-1", "u1", "job-1");
    expect(id).toBe("ws-new");
    expect(store.created).toMatchObject({ jobId: "job-1" });
  });

  it("jobId dari customer LAIN dalam tenant sama: DITOLAK (tidak boleh tertaut)", async () => {
    store.job = { id: "job-1", customerId: "cust-LAIN" };
    await expect(openWorkSession("t1", "cust-1", "u1", "job-1")).rejects.toThrow(/pekerjaan/i);
    expect(store.created).toBeNull();
  });

  it("jobId lintas-tenant (job tidak ditemukan dengan tenantId): DITOLAK", async () => {
    store.job = null; // findFirst dengan where tenantId tidak cocok
    await expect(openWorkSession("t1", "cust-1", "u1", "job-tanpa-izin")).rejects.toThrow(/pekerjaan/i);
    expect(store.created).toBeNull();
  });

  it("sesi OPEN lama tanpa job, dibuka ulang dengan jobId valid: di-taut-kan (B1 fix tetap)", async () => {
    store.existing = { id: "ws-old", jobId: null };
    const id = await openWorkSession("t1", "cust-1", "u1", "job-1");
    expect(id).toBe("ws-old");
    expect(store.updated?.data).toMatchObject({ jobId: "job-1" });
  });

  it("sesi OPEN lama, jobId tidak valid: DITOLAK (tak mengubah sesi)", async () => {
    store.existing = { id: "ws-old", jobId: null };
    store.job = { id: "job-1", customerId: "cust-LAIN" };
    await expect(openWorkSession("t1", "cust-1", "u1", "job-1")).rejects.toThrow(/pekerjaan/i);
    expect(store.updated).toBeNull();
  });
});
