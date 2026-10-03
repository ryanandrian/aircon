import { describe, it, expect, vi, beforeEach } from "vitest";

const store: { reminders: any[] } = { reminders: [] };
let session: any = { tenantId: "t1", userId: "u1", role: "OWNER", name: "Pemilik" };

vi.mock("@/lib/prisma", () => ({
  prisma: {
    repeatReminder: {
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
