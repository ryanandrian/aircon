import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * FASE 5 modul Pengingat — konversi pengingat jadi pekerjaan.
 * Tombol "Jadikan Pekerjaan" di /app/pengingat membawa reminderId ke form
 * /app/pekerjaan/baru; setelah job dibuat, pengingat -> CONVERTED + jobId
 * (jalur konversi tunggal sejak createRepeatJob dihapus pada audit 2026-10-04).
 *
 * Guard WAJIB: reminderId tenant-scoped + harus milik unit/pelanggan yang sama,
 * dan status masih QUEUED/SENT (bukan sudah ditutup/konversi orang lain).
 */

const store: {
  reminders: any[];
  jobs: any[];
  customers: any[];
  assets: any[];
  techs: any[];
  assignments: any[];
} = { reminders: [], jobs: [], customers: [], assets: [], techs: [], assignments: [] };

let session: any = { tenantId: "t1", userId: "u1", role: "OWNER", name: "Pemilik" };

vi.mock("@/lib/prisma", () => ({
  prisma: {
    customer: { findFirst: vi.fn(async ({ where }: any) => store.customers.find((c) => c.id === where.id && c.tenantId === where.tenantId && !c.deletedAt) ?? null) },
    asset: { findFirst: vi.fn(async ({ where }: any) => store.assets.find((a) => a.id === where.id && a.tenantId === where.tenantId) ?? null) },
    technician: { findFirst: vi.fn(async ({ where }: any) => store.techs.find((t) => t.id === where.id && t.tenantId === where.tenantId) ?? null) },
    jobOrder: {
      create: vi.fn(async ({ data }: any) => { const row = { id: `j${store.jobs.length + 1}`, status: "DRAFT", ...data }; store.jobs.push(row); return row; }),
      findFirst: vi.fn(async () => null),
    },
    jobProgressEvent: { create: vi.fn(async () => ({ id: "e1" })) },
    repeatReminder: {
      updateMany: vi.fn(async ({ where, data }: any) => {
        let count = 0;
        for (const r of store.reminders) {
          const statusOk = where.status?.in ? where.status.in.includes(r.status) : r.status === where.status;
          if (r.id === where.id && r.tenantId === where.tenantId && statusOk && (!where.assetId || r.assetId === where.assetId)) {
            Object.assign(r, data); count++;
          }
        }
        return { count };
      }),
      update: vi.fn(async ({ where, data }: any) => { const r = store.reminders.find((x) => x.id === where.id); if (!r) throw new Error("tidak ada"); Object.assign(r, data); return r; }),
      findFirst: vi.fn(async ({ where }: any) => store.reminders.find((r) => r.id === where.id && r.tenantId === where.tenantId) ?? null),
    },
    // Callback (bukan array) — bentuk yang dipakai src: prisma.$transaction(async (tx) => ...).
    // Preseden sama dengan tests/assignment.test.ts. Akses store via closure saat runtime.
    $transaction: vi.fn(async (fn: any) => fn({
      jobOrder: {
        create: vi.fn(async ({ data }: any) => { const row = { id: `j${store.jobs.length + 1}`, status: "DRAFT", ...data }; store.jobs.push(row); return row; }),
        findFirst: vi.fn(async () => null),
      },
      jobProgressEvent: { create: vi.fn(async () => ({ id: "e1" })) },
      // Fiks A: createJob dengan teknisi ikut menulis roster penugasan.
      jobAssignment: {
        create: vi.fn(async ({ data }: any) => { store.assignments.push(data); return { id: `a${store.assignments.length}`, ...data }; }),
      },
    })),
  },
}));

vi.mock("@/lib/auth/context", () => ({
  tryGetServerContext: vi.fn(async () => session),
  getServerContext: vi.fn(async () => session),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { actionCreateJob } from "../src/app/app/pekerjaan/actions";

beforeEach(() => {
  store.customers = [{ id: "c1", tenantId: "t1", name: "Budi", address: null, deletedAt: null }];
  store.assets = [{ id: "a1", tenantId: "t1", customerId: "c1" }];
  store.techs = [{ id: "tech1", tenantId: "t1" }];
  store.jobs = [];
  store.assignments = [];
  store.reminders = [
    { id: "r1", tenantId: "t1", assetId: "a1", status: "QUEUED", jobId: null },
    { id: "r-asing", tenantId: "t-asing", assetId: "a2", status: "QUEUED", jobId: null },
    { id: "r-salah-unit", tenantId: "t1", assetId: "a-lain", status: "QUEUED", jobId: null },
    { id: "r-tutup", tenantId: "t1", assetId: "a1", status: "DISMISSED", jobId: null },
  ];
  session = { tenantId: "t1", userId: "u1", role: "OWNER", name: "Pemilik" };
});

const base = { customerId: "c1", assetId: "a1", serviceType: "CLEANING" };

describe("actionCreateJob — konversi pengingat (reminderId)", () => {
  it("job dibuat + pengingat jadi CONVERTED dengan jobId", async () => {
    const res = await actionCreateJob({ ...base, reminderId: "r1" });
    expect(res.ok).toBe(true);
    expect(store.reminders[0].status).toBe("CONVERTED");
    expect(store.reminders[0].jobId).toBe(store.jobs[0].id);
  });

  it("tanpa reminderId perilaku lama tak berubah (job DRAFT, tak ada reminder disentuh)", async () => {
    const res = await actionCreateJob(base);
    expect(res.ok).toBe(true);
    expect(store.reminders[0].status).toBe("QUEUED");
    expect(store.reminders[0].jobId).toBeNull();
  });

  it("reminderId milik tenant lain -> TIDAK diubah, job tetap dibuat", async () => {
    const res = await actionCreateJob({ ...base, reminderId: "r-asing" });
    expect(res.ok).toBe(true);
    expect(store.reminders[1].status).toBe("QUEUED"); // tak tersentuh
    expect(store.jobs).toHaveLength(1);
  });

  it("reminderId unit berbeda dari job -> TIDAK diubah (guard unit harus sama)", async () => {
    const res = await actionCreateJob({ ...base, reminderId: "r-salah-unit" });
    expect(res.ok).toBe(true);
    expect(store.reminders[2].status).toBe("QUEUED");
  });

  it("reminder sudah DISMISSED -> TIDAK diubah (tidak bisa dikonversi)", async () => {
    const res = await actionCreateJob({ ...base, reminderId: "r-tutup" });
    expect(res.ok).toBe(true);
    expect(store.reminders[3].status).toBe("DISMISSED");
  });

  it("reminderId tidak dikenal -> job tetap dibuat (pengingat tak memblokir operasi utama)", async () => {
    const res = await actionCreateJob({ ...base, reminderId: "r-tidak-ada" });
    expect(res.ok).toBe(true);
    expect(store.jobs).toHaveLength(1);
  });

  it("role TECHNICIAN ditolak (guard lama tetap berlaku)", async () => {
    session = { tenantId: "t1", userId: "u1", role: "TECHNICIAN", name: "Tukang" };
    const res = await actionCreateJob({ ...base, reminderId: "r1" });
    expect(res.ok).toBe(false);
    expect(store.reminders[0].status).toBe("QUEUED");
  });
});

// Poin 1 — kontrak "Harga" di form Pekerjaan Baru.
// Kolom Harga form TIDAK MENENTUKAN biaya apa pun (biaya resmi = ServiceCatalog.standardPrice
// / CustomerPricing → resolvePrice saat sesi kerja → snapshot ke WorkItem/Invoice).
// Field itu dihapus dari UI dan payload; nilai `price` dari klien TIDAK pernah tersimpan.
describe("actionCreateJob — kontrak harga form (Poin 1)", () => {
  it("price dari klien TIDAK pernah dipakai (kirim 50000 → tetap kosong)", async () => {
    const res = await actionCreateJob({ ...base, price: "50000" } as any);
    expect(res.ok).toBe(true);
    // harga resmi TIDAK datang dari form: ServiceCatalog/CustomerPricing → resolvePrice
    expect(Number(store.jobs[0].price ?? 0)).toBe(0);
  });
  it("tanpa price → job dibuat normal (DRAFT) & price job kosong", async () => {
    const res = await actionCreateJob(base);
    expect(res.ok).toBe(true);
    expect(store.jobs).toHaveLength(1);
    expect(store.jobs[0].status).toBe("DRAFT");
    expect(Number(store.jobs[0].price ?? 0)).toBe(0);
  });
});
