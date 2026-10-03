import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/storage/s3", () => ({
  // server-only tak ter-resolve Vitest → mock boundary ini (bukan file helper baru).
  isStorageConfigured: () => true,
  isOwnedPhotoUrl: (tenantId: string, jobId: string, url: string) =>
    url.startsWith(`https://s3.test/jobs/${tenantId}/${jobId}/`),
  publicUrl: (key: string) => `https://s3.test/${key}`,
}));

vi.mock("@/lib/services/customer-service", () => ({
  ServiceError: class ServiceError extends Error {
    code: string; constructor(code: string, message: string) { super(message); this.code = code; }
  },
  // Tanpa kantor pusat (bill-to = diri sendiri) untuk skenario dasar ini.
  resolveBillingCustomer: vi.fn(async (_t: string, id: string) => ({ id, topType: "CASH", billingCustomerId: null })),
}));
vi.mock("@/lib/services/service-catalog-service", () => ({
  resolvePrice: vi.fn(async () => 75000),
}));
vi.mock("@/lib/services/invoice-service", () => ({
  computeInvoiceTotals: ({ items, tenantIsPkp, taxPercent }: any) => {
    const subtotal = items.reduce((s: number, i: any) => s + Math.round(i.qty * i.unitPrice), 0);
    const ppnPercent = tenantIsPkp ? (taxPercent ?? 0) : 0;
    const ppnAmount = ppnPercent > 0 ? Math.round(subtotal * ppnPercent / 100) : 0;
    return { subtotal, discountAmount: 0, taxableService: subtotal, taxableGoods: 0, ppnPercent, ppnAmount, total: subtotal + ppnAmount };
  },
  computeDueDate: (issue: Date, top: string) => (top === "CASH" ? null : new Date(issue.getTime() + 30 * 86400000)),
  nextInvoiceNumber: async (_t: string, docType: string) => `${docType === "PROFORMA" ? "PRO" : "INV"}/2026/0001`,
}));

/** F4.3 — closeWorkSession memilih docType sesuai TOP (Cash→Invoice, Tempo→Proforma) + total benar. */
const store: any = {};
let created: any = null;

vi.mock("@/lib/prisma", () => ({
  prisma: {
    workSession: {
      findFirst: vi.fn(async ({ where }: any) => {
        if (where.status === "OPEN" && store.ws?.status === "OPEN") return store.ws;
        return store.ws ?? null;
      }),
      update: vi.fn(async () => ({})),
      findMany: vi.fn(async () => store.jobSessions ?? []),
    },
    // FASE 4 — finalisasi job dalam transaksi yang sama (pindahan efek transitionJob COMPLETED).
    jobOrder: {
      findUnique: vi.fn(async () => store.job ?? null),
      update: vi.fn(async ({ data }: any) => { store.jobUpdates.push(data); return { ...store.job, ...data }; }),
    },
    asset: {
      findUnique: vi.fn(async ({ where }: any) => store.assets?.[where.id] ?? null),
      update: vi.fn(async ({ where, data }: any) => { store.assetUpdates.push({ id: where.id, data }); return {}; }),
      findMany: vi.fn(async ({ where }: any) => (store.assetsExtra ?? []).filter((a: any) => where.id.in.includes(a.id))),
    },
    repeatReminder: { upsert: vi.fn(async ({ where }: any) => { store.reminderUpserts.push(where); return {}; }) },
    reviewRequest: { create: vi.fn(async (a: any) => { store.reviewCreates.push(a.data); return {}; }) },
    jobProgressEvent: { create: vi.fn(async (a: any) => { store.eventCreates.push(a.data); return {}; }) },
    // Gate checklist (assertWorkSessionChecklist): default tanpa WorkItem ber-serviceId → tidak mengunci.
    workItem: { findMany: vi.fn(async () => store.workItems ?? []) },
    checklistTemplate: { findMany: vi.fn(async () => store.checklistTemplates ?? []) },
    checklistResult: { findMany: vi.fn(async () => store.checklistResults ?? []) },
    tenant: { findUnique: vi.fn(async () => store.tenant) },
    invoice: {
      findFirst: vi.fn(async () => null), // penomoran: belum ada
      create: vi.fn(async ({ data }: any) => { created = data; return { id: "inv1" }; }),
    },
    $transaction: vi.fn(async (fn: any) => fn({
      invoice: { create: vi.fn(async ({ data }: any) => { created = data; return { id: "inv1" }; }) },
      workSession: {
        updateMany: vi.fn(async () => ({ count: store.claimCount ?? 1 })),
        findMany: vi.fn(async () => store.jobSessions ?? []),
      },
      jobOrder: {
        findUnique: vi.fn(async () => store.job ?? null),
        update: vi.fn(async ({ where, data }: any) => {
          if (where.id !== store.job?.id) throw new Error("wrong job id");
          store.jobUpdates.push(data);
          return { ...store.job, ...data };
        }),
      },
      asset: {
        findUnique: vi.fn(async ({ where }: any) => store.assets?.[where.id] ?? null),
        update: vi.fn(async ({ where, data }: any) => { store.assetUpdates.push({ id: where.id, data }); return {}; }),
        findMany: vi.fn(async ({ where }: any) => (store.assetsExtra ?? []).filter((a: any) => where.id.in.includes(a.id))),
      },
      tenant: { findUnique: vi.fn(async () => store.tenant) },
      repeatReminder: { upsert: vi.fn(async ({ where }: any) => { store.reminderUpserts.push(where); return {}; }) },
      reviewRequest: { create: vi.fn(async (a: any) => { store.reviewCreates.push(a.data); return {}; }) },
      jobProgressEvent: { create: vi.fn(async (a: any) => { store.eventCreates.push(a.data); return {}; }) },
    })),
  },
}));

import { closeWorkSession } from "../src/lib/services/worksession-service";

beforeEach(() => {
  created = null;
  store.tenant = { isPkp: false, taxPercent: 0 };
  store.jobUpdates = []; store.assetUpdates = []; store.reminderUpserts = []; store.reviewCreates = []; store.eventCreates = [];
  store.job = { id: "job1", tenantId: "t1", customerId: "c1", status: "IN_PROGRESS", serviceType: "CLEANING", assetId: "a1" };
  store.ws = {
    id: "ws1", jobId: null, status: "OPEN",
    customer: { id: "c1", topType: "CASH" },
    items: [
      { assetId: "a1", descSnapshot: "Cuci AC", category: "SERVICE", qty: 2, unit: "unit", unitPriceSnapshot: 75000, lineTotal: 150000 },
    ],
  };
});

describe("closeWorkSession", () => {
  it("CASH → Invoice (INV), total = subtotal (non-PKP)", async () => {
    const r = await closeWorkSession("t1", "ws1", "u1");
    expect(r.docType).toBe("INVOICE");
    expect(r.number.startsWith("INV/")).toBe(true);
    expect(Number(created.total)).toBe(150000);
    expect(created.cashRemitStatus).toBe("HELD_BY_TECH");
  });

  it("Tempo → Proforma (PRO) + dueDate terisi", async () => {
    store.ws.customer.topType = "TEMPO_30";
    const r = await closeWorkSession("t1", "ws1", "u1");
    expect(r.docType).toBe("PROFORMA");
    expect(r.number.startsWith("PRO/")).toBe(true);
    expect(created.dueDate).not.toBeNull();
    expect(created.cashRemitStatus).toBeNull();
  });

  it("PKP → PPN diterapkan", async () => {
    store.tenant = { isPkp: true, taxPercent: 11 };
    await closeWorkSession("t1", "ws1", "u1");
    expect(Number(created.ppnAmount)).toBe(16500); // 11% x 150000
    expect(Number(created.total)).toBe(166500);
  });

  it("sesi kosong → tolak", async () => {
    store.ws.items = [];
    await expect(closeWorkSession("t1", "ws1", "u1")).rejects.toThrow();
  });

  it("GATE checklist: item WAJIB per-unit belum lengkap → tolak terbit nota", async () => {
    // WorkItem ber-serviceId + template layanan punya item wajib + belum ada hasil → harus ditolak.
    store.workItems = [{ id: "wi1", serviceId: "svc1", descSnapshot: "Cuci AC" }];
    store.checklistTemplates = [{ serviceId: "svc1", items: [{ key: "w", label: "Cuci filter", type: "bool", required: true }] }];
    store.checklistResults = []; // belum diisi
    await expect(closeWorkSession("t1", "ws1", "u1")).rejects.toThrow(/checklist wajib belum lengkap/i);
  });

  it("GATE checklist: item WAJIB terisi → nota tetap terbit", async () => {
    store.workItems = [{ id: "wi1", serviceId: "svc1", descSnapshot: "Cuci AC" }];
    store.checklistTemplates = [{ serviceId: "svc1", items: [{ key: "w", label: "Cuci filter", type: "bool", required: true }] }];
    store.checklistResults = [{ workItemId: "wi1", itemKey: "w", checked: true, value: null }];
    const r = await closeWorkSession("t1", "ws1", "u1");
    expect(r.docType).toBe("INVOICE");
  });

  it("GATE checklist: item WAJIB tipe number berisi spasi/kosong -> tolak (validator tipe, bukan cek truthy)", async () => {
    // Nilai "   " itu truthy di JS; gate LAMA (cuma !!value) akan salah meloloskan.
    store.workItems = [{ id: "wi1", serviceId: "svc1", descSnapshot: "Cuci AC" }];
    store.checklistTemplates = [{ serviceId: "svc1", items: [{ key: "suhu", label: "Suhu keluar", type: "number", required: true }] }];
    store.checklistResults = [{ workItemId: "wi1", itemKey: "suhu", checked: false, value: "   " }];
    await expect(closeWorkSession("t1", "ws1", "u1")).rejects.toThrow(/checklist wajib belum lengkap/i);
  });

  it("GATE checklist: item WAJIB tipe number berisi angka valid -> lolos", async () => {
    store.workItems = [{ id: "wi1", serviceId: "svc1", descSnapshot: "Cuci AC" }];
    store.checklistTemplates = [{ serviceId: "svc1", items: [{ key: "suhu", label: "Suhu keluar", type: "number", required: true }] }];
    store.checklistResults = [{ workItemId: "wi1", itemKey: "suhu", checked: false, value: "21" }];
    const r = await closeWorkSession("t1", "ws1", "u1");
    expect(r.docType).toBe("INVOICE");
  });

  it("GATE checklist: item WAJIB tipe number berisi teks bukan angka -> tolak", async () => {
    store.workItems = [{ id: "wi1", serviceId: "svc1", descSnapshot: "Cuci AC" }];
    store.checklistTemplates = [{ serviceId: "svc1", items: [{ key: "suhu", label: "Suhu keluar", type: "number", required: true }] }];
    store.checklistResults = [{ workItemId: "wi1", itemKey: "suhu", checked: false, value: "dingin" }];
    await expect(closeWorkSession("t1", "ws1", "u1")).rejects.toThrow(/checklist wajib belum lengkap/i);
  });

  it("GATE checklist: item WAJIB tipe photo berisi teks bukan URL -> tolak", async () => {
    store.ws.jobId = "job1";
    store.workItems = [{ id: "wi1", serviceId: "svc1", descSnapshot: "Cuci AC" }];
    store.checklistTemplates = [{ serviceId: "svc1", items: [{ key: "p", label: "Foto sesudah", type: "photo", required: true }] }];
    store.checklistResults = [{ workItemId: "wi1", itemKey: "p", checked: false, value: "hasil-kerja.jpg" }];
    await expect(closeWorkSession("t1", "ws1", "u1")).rejects.toThrow(/checklist wajib belum lengkap/i);
  });

  it("GATE checklist: photo URL bukan milik tenant+job sesi -> tolak (anti lintas-scope)", async () => {
    store.ws.jobId = "job1";
    store.workItems = [{ id: "wi1", serviceId: "svc1", descSnapshot: "Cuci AC" }];
    store.checklistTemplates = [{ serviceId: "svc1", items: [{ key: "p", label: "Foto sesudah", type: "photo", required: true }] }];
    // URL punya tenant LAIN / pekerjaan lain
    store.checklistResults = [{ workItemId: "wi1", itemKey: "p", checked: false, value: "https://s3.test/jobs/tenantLAIN/jobLAIN/a.jpg" }];
    await expect(closeWorkSession("t1", "ws1", "u1")).rejects.toThrow(/checklist wajib belum lengkap/i);
  });

  it("GATE checklist: photo URL milik tenant+job sesi (hasil upload) -> lolos", async () => {
    store.ws.jobId = "job1";
    store.workItems = [{ id: "wi1", serviceId: "svc1", descSnapshot: "Cuci AC" }];
    store.checklistTemplates = [{ serviceId: "svc1", items: [{ key: "p", label: "Foto sesudah", type: "photo", required: true }] }];
    store.checklistResults = [{ workItemId: "wi1", itemKey: "p", checked: false, value: "https://s3.test/jobs/t1/job1/after-abc.jpg" }];
    const r = await closeWorkSession("t1", "ws1", "u1");
    expect(r.docType).toBe("INVOICE");
  });

  it("B3: race penutupan ganda → klaim atomik gagal (count 0) → tolak, cegah dobel invoice", async () => {
    store.claimCount = 0; // simulasikan sesi sudah ditutup proses lain di dalam transaksi
    await expect(closeWorkSession("t1", "ws1", "u1")).rejects.toThrow();
    store.claimCount = 1;
  });

  it("F4: sesi ber-job → job COMPLETED + efek money-loop TEPAT SATU KALI dalam transaksi", async () => {
    store.ws.jobId = "job1"; // sesi tertaut pekerjaan
    store.job = { id: "job1", tenantId: "t1", customerId: "c1", status: "IN_PROGRESS", serviceType: "CLEANING", assetId: "a1" };
    store.assets = { a1: { id: "a1", maintenanceIntervalDays: 60 } };
    store.jobSessions = [{ items: [{ assetId: "a2" }] }]; // unit ekstra dikerjakan on-site
    store.assetsExtra = [{ id: "a2", maintenanceIntervalDays: 90 }];

    await closeWorkSession("t1", "ws1", "u1");

    // job dinyatakan selesai
    expect(store.jobUpdates).toHaveLength(1);
    expect(store.jobUpdates[0].status).toBe("COMPLETED");
    expect(store.jobUpdates[0].completedAt).toBeInstanceOf(Date);
    expect(store.jobUpdates[0].nextServiceDate).toBeInstanceOf(Date);
    // asset utama + unit ekstra: update jadwal servis berikutnya masing-masing 1×
    expect(store.assetUpdates.map((u: any) => u.id).sort()).toEqual(["a1", "a2"]);
    // reminder tepat 1 per unit (upsert, anti-duplikat)
    expect(store.reminderUpserts).toHaveLength(2);
    // review request tepat 1
    expect(store.reviewCreates).toHaveLength(1);
    expect(store.reviewCreates[0]).toMatchObject({ tenantId: "t1", jobId: "job1", status: "REQUESTED" });
    // jejak progres: IN_PROGRESS → COMPLETED
    expect(store.eventCreates).toHaveLength(1);
    expect(store.eventCreates[0]).toMatchObject({ jobId: "job1", toStatus: "COMPLETED" });
  });

  it("F4: gate checklist GAGAL → nihil sama sekali: sesi terbuka, job tidak COMPLETED, tanpa efek", async () => {
    store.ws.jobId = "job1";
    store.job = { id: "job1", tenantId: "t1", customerId: "c1", status: "IN_PROGRESS", serviceType: "CLEANING", assetId: "a1" };
    store.workItems = [{ id: "wi1", serviceId: "svc1", descSnapshot: "Cuci AC" }];
    store.checklistTemplates = [{ serviceId: "svc1", items: [{ key: "w", label: "Cuci filter", type: "bool", required: true }] }];
    store.checklistResults = []; // belum diisi

    await expect(closeWorkSession("t1", "ws1", "u1")).rejects.toThrow(/checklist wajib belum lengkap/i);
    expect(created).toBeNull();                       // tidak ada dokumen
    expect(store.jobUpdates).toHaveLength(0);         // job tetap IN_PROGRESS
    expect(store.assetUpdates).toHaveLength(0);       // jadwal tidak digeser
    expect(store.reminderUpserts).toHaveLength(0);    // tidak ada reminder
    expect(store.reviewCreates).toHaveLength(0);      // tidak ada review
    expect(store.eventCreates).toHaveLength(0);       // tidak ada event
  });
});
