import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * FASE 2 modul Pengingat Perawatan AC — server action "Tutup Pengingat".
 * Menulis RepeatReminder -> DISMISSED (enum sudah ada, sebelumnya tak pernah ditulis).
 * Guard: role OWNER/ADMIN + tenant-scoped by session (anti tamper).
 */

const store: { reminders: any[] } = { reminders: [] };
let session: any = { tenantId: "t1", userId: "u1", role: "OWNER", name: "Pemilik" };

vi.mock("@/lib/prisma", () => ({
  prisma: {
    repeatReminder: {
      updateMany: vi.fn(async ({ where, data }: any) => {
        let count = 0;
        for (const r of store.reminders) {
          const statusOk = typeof where.status === "string" ? r.status === where.status : (where.status?.in ?? []).includes(r.status);
          if (r.id === where.id && r.tenantId === where.tenantId && statusOk) {
            Object.assign(r, data); count++;
          }
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

import { actionCloseReminder } from "../src/app/app/pengingat/actions";

beforeEach(() => {
  store.reminders = [
    { id: "r1", tenantId: "t1", status: "QUEUED" },
    { id: "r2", tenantId: "t-asing", status: "QUEUED" },
  ];
  session = { tenantId: "t1", userId: "u1", role: "OWNER", name: "Pemilik" };
});

describe("actionCloseReminder", () => {
  it("menutup pengingat milik sendiri -> DISMISSED", async () => {
    const res = await actionCloseReminder("r1");
    expect(res.ok).toBe(true);
    expect(store.reminders[0].status).toBe("DISMISSED");
  });

  it("tolak pengingat tenant lain (tenant-scoped)", async () => {
    const res = await actionCloseReminder("r2");
    expect(res.ok).toBe(false);
    expect(store.reminders[1].status).toBe("QUEUED");
  });

  it("tolak role TECHNICIAN", async () => {
    session = { tenantId: "t1", userId: "u1", role: "TECHNICIAN", name: "Tukang" };
    const res = await actionCloseReminder("r1");
    expect(res.ok).toBe(false);
    expect(store.reminders[0].status).toBe("QUEUED");
  });

  it("tolak bila belum login", async () => {
    session = null;
    const res = await actionCloseReminder("r1");
    expect(res.ok).toBe(false);
  });

  it("tolak pengingat yang sudah CONVERTED (tidak bisa ditutup manual)", async () => {
    store.reminders[0].status = "CONVERTED";
    const res = await actionCloseReminder("r1");
    expect(res.ok).toBe(false);
    expect(store.reminders[0].status).toBe("CONVERTED");
  });

  it("input kosong / bukan string -> tolak (anti tamper)", async () => {
    expect((await actionCloseReminder("")).ok).toBe(false);
    expect((await actionCloseReminder(null as any)).ok).toBe(false);
    expect((await actionCloseReminder({ id: "r1" } as any)).ok).toBe(false);
  });
});
