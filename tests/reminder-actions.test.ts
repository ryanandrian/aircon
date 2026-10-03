import { describe, it, expect, vi, beforeEach } from "vitest";

const store: { reminders: any[] } = { reminders: [] };
let session: any = { tenantId: "t1", userId: "u1", role: "OWNER", name: "Pemilik" };

vi.mock("@/lib/prisma", () => ({
  prisma: {
    tenant: {
      findUnique: vi.fn(async () => ({ id: "t1", reminderLeadDays: 3 })),
    },
    repeatReminder: {
      // unique key tenant+asset+dueDate (pola job-service)
      findUnique: vi.fn(async ({ where, select }: any) => {
        const k = where.tenantId_assetId_dueDate;
        const r = store.reminders.find(
          (x) => x.tenantId === k.tenantId && x.assetId === k.assetId &&
            new Date(x.dueDate).getTime() === new Date(k.dueDate).getTime(),
        );
        if (!r) return null;
        if (select) { const o: any = {}; for (const key of Object.keys(select)) if (select[key]) o[key] = r[key]; return o; }
        return r;
      }),
      create: vi.fn(async ({ data }: any) => {
        const row = { id: "r" + (store.reminders.length + 1), sentAt: null, ...data };
        store.reminders.push(row);
        return row;
      }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        let count = 0;
        for (const r of store.reminders) {
          const statusOk = typeof where.status === "string" ? r.status === where.status : (where.status?.in ?? []).includes(r.status);
          const idOk = where.id === undefined || r.id === where.id;
          const tenantOk = where.tenantId === undefined || r.tenantId === where.tenantId;
          if (idOk && tenantOk && statusOk) { Object.assign(r, data); count++; }
        }
        return { count };
      }),
    },
  },
}));
vi.mock("@/lib/auth/context", () => ({
  tryGetServerContext: vi.fn(async () => session),
  getServerContext: vi.fn(async () => session),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { actionCloseReminder, actionMarkReminderSentManual } from "../src/app/app/pengingat/actions";

beforeEach(() => {
  store.reminders = [
    { id: "r1", tenantId: "t1", status: "QUEUED", sentAt: null, manualSentAt: null },
    { id: "r2", tenantId: "t-asing", status: "QUEUED", sentAt: null, manualSentAt: null },
    { id: "r3", tenantId: "t1", status: "SENT", sentAt: new Date(), manualSentAt: null },
    { id: "r4", tenantId: "t1", status: "DISMISSED", sentAt: null, manualSentAt: null },
  ];
  session = { tenantId: "t1", userId: "u1", role: "OWNER", name: "Pemilik" };
});

describe("actionCloseReminder", () => {
  it("menutup milik sendiri -> DISMISSED", async () => {
    const res = await actionCloseReminder("r1");
    expect(res.ok).toBe(true);
    expect(store.reminders[0].status).toBe("DISMISSED");
  });
  it("tolak tenant lain", async () => {
    const res = await actionCloseReminder("r2");
    expect(res.ok).toBe(false);
    expect(store.reminders[1].status).toBe("QUEUED");
  });
  it("tolak TECHNICIAN dan belum login", async () => {
    session = { tenantId: "t1", userId: "u1", role: "TECHNICIAN", name: "T" };
    expect((await actionCloseReminder("r1")).ok).toBe(false);
    session = null;
    expect((await actionCloseReminder("r1")).ok).toBe(false);
  });
  it("tolak CONVERTED dan input invalid", async () => {
    store.reminders[0].status = "CONVERTED";
    expect((await actionCloseReminder("r1")).ok).toBe(false);
    expect((await actionCloseReminder("")).ok).toBe(false);
    expect((await actionCloseReminder(null as any)).ok).toBe(false);
  });
});

describe("actionMarkReminderSentManual", () => {
  it("menandai milik sendiri: QUEUED->SENT + manualSentAt", async () => {
    const res = await actionMarkReminderSentManual("r1");
    expect(res.ok).toBe(true);
    expect(store.reminders[0].status).toBe("SENT");
    expect(store.reminders[0].manualSentAt).toBeInstanceOf(Date);
  });
  it("menandai milik sendiri yang terkirim otomatis tanpa menghapus sentAt", async () => {
    const old = store.reminders[2].sentAt;
    const res = await actionMarkReminderSentManual("r3");
    expect(res.ok).toBe(true);
    expect(store.reminders[2].sentAt).toBe(old);
    expect(store.reminders[2].manualSentAt).toBeInstanceOf(Date);
  });
  it("tolak tenant lain", async () => {
    expect((await actionMarkReminderSentManual("r2")).ok).toBe(false);
    expect(store.reminders[1].manualSentAt).toBeNull();
  });
  it("tolak reminder tertutup dan input invalid", async () => {
    expect((await actionMarkReminderSentManual("r4")).ok).toBe(false);
    expect((await actionMarkReminderSentManual("")).ok).toBe(false);
    expect((await actionMarkReminderSentManual(null as any)).ok).toBe(false);
  });
  it("tolak TECHNICIAN dan belum login", async () => {
    session = { tenantId: "t1", userId: "u1", role: "TECHNICIAN", name: "T" };
    expect((await actionMarkReminderSentManual("r1")).ok).toBe(false);
    session = null;
    expect((await actionMarkReminderSentManual("r1")).ok).toBe(false);
  });
});

describe("actionMarkReminderSentManual — unit TANPA baris pengingat (kasus 79/84 kartu)", () => {
  beforeEach(() => {
    // Store kosong: unit jatuh tempo tapi belum pernah punya RepeatReminder
    store.reminders = [];
    session = { tenantId: "t1", userId: "u1", role: "OWNER", name: "Pemilik" };
  });

  it("dengan assetId+dueDate (reminderId null) -> membuat baris pengingat lalu menandai manual", async () => {
    const due = new Date("2026-10-01T00:00:00.000Z");
    const res = await actionMarkReminderSentManual(null, { assetId: "a1", dueDate: due });
    expect(res.ok).toBe(true);
    expect(store.reminders).toHaveLength(1);
    const r = store.reminders[0];
    expect(r.tenantId).toBe("t1");
    expect(r.assetId).toBe("a1");
    expect(r.status).toBe("SENT");
    expect(r.manualSentAt).toBeInstanceOf(Date);
    expect(r.dueDate.getTime()).toBe(due.getTime());
  });

  it("panggilan kedua (idempoten) tidak membuat baris ganda", async () => {
    const due = new Date("2026-10-01T00:00:00.000Z");
    await actionMarkReminderSentManual(null, { assetId: "a1", dueDate: due });
    await actionMarkReminderSentManual(null, { assetId: "a1", dueDate: due });
    expect(store.reminders).toHaveLength(1);
  });

  it("reminderId diberikan -> pakai baris itu (tidak membuat duplikat)", async () => {
    store.reminders = [{ id: "r1", tenantId: "t1", assetId: "a1", status: "QUEUED", sentAt: null, manualSentAt: null }];
    const due = new Date("2026-10-01T00:00:00.000Z");
    const res = await actionMarkReminderSentManual("r1", { assetId: "a1", dueDate: due });
    expect(res.ok).toBe(true);
    expect(store.reminders).toHaveLength(1);
    expect(store.reminders[0].id).toBe("r1");
    expect(store.reminders[0].manualSentAt).toBeInstanceOf(Date);
  });

  it("tanpa reminderId DAN tanpa assetId -> ditolak (jangan buat pengingat tanpa sasaran)", async () => {
    const res = await actionMarkReminderSentManual(null, { assetId: "", dueDate: new Date() });
    expect(res.ok).toBe(false);
    expect(store.reminders).toHaveLength(0);
  });

  it("tenant lain tidak tersentuh walau assetId cocok miliknya (tenant-scoped di upsert)", async () => {
    const due = new Date("2026-10-01T00:00:00.000Z");
    const res = await actionMarkReminderSentManual(null, { assetId: "a-asing", dueDate: due });
    expect(res.ok).toBe(true);
    // baris dibuat dengan tenantId sesi -> milik sendiri, bukan pencurian aset orang
    expect(store.reminders[0].tenantId).toBe("t1");
    expect(store.reminders[0].assetId).toBe("a-asing");
  });

  it("TIDAK boleh mencuri pengingat milik tenant lain (upsert pakai unique key tenant+asset+due)", async () => {
    store.reminders = [{ id: "r-asing", tenantId: "t-asing", assetId: "a1", status: "QUEUED", sentAt: null, manualSentAt: null }];
    const due = new Date("2026-10-01T00:00:00.000Z");
    await actionMarkReminderSentManual(null, { assetId: "a1", dueDate: due });
    const other = store.reminders.find((r) => r.id === "r-asing");
    expect(other.tenantId).toBe("t-asing");       // tidak berubah
    expect(other.manualSentAt).toBeNull();        // tidak disentuh
    // milik sendiri dibuat terpisah
    expect(store.reminders.filter((r) => r.tenantId === "t1")).toHaveLength(1);
  });
});

describe("actionMarkReminderSentManual — baris pengingat belum ada", () => {
  it("tanpa reminderId + assetId/dueDate -> membuat RepeatReminder SENT manual", async () => {
    store.reminders = [];
    const due = new Date("2026-10-01T00:00:00.000Z");
    const res = await actionMarkReminderSentManual(null, { assetId: "a1", dueDate: due });
    expect(res.ok).toBe(true);
    expect(store.reminders).toHaveLength(1);
    expect(store.reminders[0]).toMatchObject({
      tenantId: "t1", assetId: "a1", status: "SENT", manualSentAt: expect.any(Date),
    });
    expect(store.reminders[0].dueDate.getTime()).toBe(due.getTime());
  });

  it("panggilan ulang idempoten: tidak menciptakan baris duplikat", async () => {
    store.reminders = [];
    const due = new Date("2026-10-01T00:00:00.000Z");
    await actionMarkReminderSentManual(null, { assetId: "a1", dueDate: due });
    await actionMarkReminderSentManual(null, { assetId: "a1", dueDate: due });
    expect(store.reminders).toHaveLength(1);
  });

  it("tolak pembuatan bila assetId tidak ada", async () => {
    store.reminders = [];
    const res = await actionMarkReminderSentManual(null, { dueDate: new Date() } as any);
    expect(res.ok).toBe(false);
    expect(store.reminders).toHaveLength(0);
  });
});
