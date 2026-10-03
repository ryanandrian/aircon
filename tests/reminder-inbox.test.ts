import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * FASE 1 modul Pengingat Perawatan AC — listReminderInbox.
 * SATU-SATUNYA sumber data untuk: (a) metrik "Jatuh Tempo" di Ringkasan,
 * (b) halaman /app/pengingat. Dua query terpisah = angka beda (risiko R10).
 *
 * Aturan "jatuh tempo" (dikunci di sini): unit masuk daftar bila
 *   nextServiceDate - Tenant.reminderLeadDays <= sekarang
 * (sesuai perintah user: "sesuai konfigurasi, misalnya 3 hari sebelum hari H").
 *
 * Status pengiriman dikorelasi RepeatReminder -> MessageLog (keputusan FASE 0.2,
 * relasi dijamin satu transaksi, lihat reminder-service.ts sendCustomerReminderWa).
 */

type Unit = {
  id: string; tenantId: string; brand: string | null; model: string | null;
  capacityPk: number | null; roomLocation: string | null;
  nextServiceDate: Date | null; customerId: string;
};
type Rem = { id: string; tenantId: string; assetId: string; dueDate: Date; leadTimeDays: number; status: string; sentAt: Date | null };
type Msg = { id: string; tenantId: string; customerId: string | null; templateKey: string | null; at: Date; status: string };

const state = {
  tenants: {} as Record<string, { id: string; reminderLeadDays: number }>,
  units: [] as Unit[],
  reminders: [] as Rem[],
  messages: [] as Msg[],
  customers: {} as Record<string, { id: string; name: string; phone: string }>,
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    tenant: {
      findUnique: vi.fn(async ({ where, select }: any) => {
        const t = state.tenants[where.id];
        if (!t) return null;
        if (select) { const o: any = {}; for (const k of Object.keys(select)) if (select[k]) o[k] = (t as any)[k]; return o; }
        return t;
      }),
    },
    asset: {
      findMany: vi.fn(async ({ where, include }: any) =>
        state.units
          .filter((u) => u.tenantId === where.tenantId)
          .map((u) => (include?.customer ? { ...u, customer: state.customers[u.customerId] } : u)),
      ),
    },
    repeatReminder: {
      findMany: vi.fn(async ({ where, orderBy }: any) => {
        const rows = state.reminders.filter((r) => r.tenantId === where.tenantId && where.assetId.in.includes(r.assetId));
        if (orderBy?.dueDate === "desc") rows.sort((a, b) => b.dueDate.getTime() - a.dueDate.getTime());
        else if (orderBy?.dueDate === "asc") rows.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
        return rows;
      }),
    },
    messageLog: {
      findMany: vi.fn(async ({ where }: any) =>
        state.messages.filter((m) =>
          m.tenantId === where.tenantId &&
          m.templateKey && where.templateKey.in.includes(m.templateKey) &&
          m.at >= where.at.gte && m.at <= where.at.lte),
      ),
    },
  },
}));

import { ServiceError } from "../src/lib/services/customer-service";
import { listReminderInbox } from "../src/lib/services/reminder-service";

const NOW = Date.now();
const day = 86_400_000;
const iso = (ms: number) => new Date(NOW + ms);

beforeEach(() => {
  state.tenants = { t1: { id: "t1", reminderLeadDays: 3 } };
  state.customers = { c1: { id: "c1", name: "Budi", phone: "62811110001" } };
  state.units = [];
  state.reminders = [];
  state.messages = [];
});

function unit(id: string, nextInDays: number): Unit {
  return { id, tenantId: "t1", brand: "Panasonic", model: "CS-100", capacityPk: 1, roomLocation: "R. Tamu", nextServiceDate: iso(nextInDays * day), customerId: "c1" };
}

describe("listReminderInbox — aturan jatuh tempo (sesuai konfigurasi tenant)", () => {
  it("unit yang sudah lewat jadwal masuk daftar", async () => {
    state.units = [unit("a1", -1)];
    const rows = await listReminderInbox("t1");
    expect(rows).toHaveLength(1);
    expect(rows[0].assetId).toBe("a1");
  });

  it("unit jauh di masa depan TIDAK masuk daftar", async () => {
    state.units = [unit("a1", 60)];
    expect(await listReminderInbox("t1")).toHaveLength(0);
  });

  it("unit 2 hari lagi MASUK bila lead tenant = 3 hari (H-3 sudah waktunya siap)", async () => {
    state.units = [unit("a1", 2)];
    expect(await listReminderInbox("t1")).toHaveLength(1);
  });

  it("unit 2 hari lagi TIDAK masuk bila lead tenant = 0 (kirim pas hari H)", async () => {
    state.tenants.t1.reminderLeadDays = 0;
    state.units = [unit("a1", 2)];
    expect(await listReminderInbox("t1")).toHaveLength(0);
  });

  it("unit tanpa jadwal (nextServiceDate null) tidak masuk", async () => {
    state.units = [{ ...unit("a1", -1), nextServiceDate: null }];
    expect(await listReminderInbox("t1")).toHaveLength(0);
  });
});

describe("listReminderInbox — isi baris (info pelanggan + unit)", () => {
  it("baris memuat identitas unit, pelanggan, dan jadwal", async () => {
    state.units = [unit("a1", -5)];
    const [r] = await listReminderInbox("t1");
    expect(r.assetId).toBe("a1");
    expect(r.brand).toBe("Panasonic");
    expect(r.roomLocation).toBe("R. Tamu");
    expect(r.customerId).toBe("c1");
    expect(r.customerName).toBe("Budi");
    expect(r.customerPhone).toBe("62811110001");
    expect(r.nextServiceDate).toBeInstanceOf(Date);
    expect(r.waLink).toContain("62811110001");
  });
});

describe("listReminderInbox — status pengiriman via korelasi MessageLog", () => {
  const REM_SENT = (sentAt: Date): Rem => ({ id: "r1", tenantId: "t1", assetId: "a1", dueDate: iso(-5 * day), leadTimeDays: 3, status: "SENT", sentAt });

  it("tanpa RepeatReminder -> BELUM_DIKIRIM", async () => {
    state.units = [unit("a1", -5)];
    const [r] = await listReminderInbox("t1");
    expect(r.sendStatus).toBe("BELUM_DIKIRIM");
    expect(r.messageLogId).toBeNull();
  });

  it("RepeatReminder QUEUED -> MENUNGGU_KRIM (antre menunggu cron)", async () => {
    state.units = [unit("a1", -5)];
    state.reminders = [{ id: "r1", tenantId: "t1", assetId: "a1", dueDate: iso(-5 * day), leadTimeDays: 3, status: "QUEUED", sentAt: null }];
    const [r] = await listReminderInbox("t1");
    expect(r.sendStatus).toBe("MENUNGGU_KRIM");
  });

  it("SENT + MessageLog DELIVERED -> DITERIMA (korelasi satu transaksi)", async () => {
    const sentAt = iso(-2 * day);
    state.units = [unit("a1", -5)];
    state.reminders = [REM_SENT(sentAt)];
    state.messages = [{ id: "m1", tenantId: "t1", customerId: "c1", templateKey: "reminder", at: new Date(sentAt.getTime() + 500), status: "DELIVERED" }];
    const [r] = await listReminderInbox("t1");
    expect(r.sendStatus).toBe("DITERIMA");
    expect(r.messageLogId).toBe("m1");
  });

  it("SENT + MessageLog FAILED -> GAGAL (menangkap kegagalan yang disembunyikan status SENT)", async () => {
    const sentAt = iso(-2 * day);
    state.units = [unit("a1", -5)];
    state.reminders = [REM_SENT(sentAt)];
    state.messages = [{ id: "m1", tenantId: "t1", customerId: "c1", templateKey: "reminder", at: new Date(sentAt.getTime() + 300), status: "FAILED" }];
    const [r] = await listReminderInbox("t1");
    expect(r.sendStatus).toBe("GAGAL");
  });

  it("SENT + MessageLog READ_CONFIRMED -> DIBACA", async () => {
    const sentAt = iso(-2 * day);
    state.units = [unit("a1", -5)];
    state.reminders = [REM_SENT(sentAt)];
    state.messages = [{ id: "m1", tenantId: "t1", customerId: "c1", templateKey: "reminder", at: new Date(sentAt.getTime() + 300), status: "READ_CONFIRMED" }];
    const [r] = await listReminderInbox("t1");
    expect(r.sendStatus).toBe("DIBACA");
  });

  it("SENT tapi MessageLog tidak ketemu -> TIDAK_DIKETAHUI (jangan menebak)", async () => {
    state.units = [unit("a1", -5)];
    state.reminders = [{ ...REM_SENT(iso(-2 * day)), sentAt: null }];
    const [r] = await listReminderInbox("t1");
    expect(r.sendStatus).toBe("TIDAK_DIKETAHUI");
    expect(r.messageLogId).toBeNull();
  });

  it("MessageLog lain tenant / template lain TIDAK boleh tercorong (tenant-scoped)", async () => {
    const sentAt = iso(-2 * day);
    state.units = [unit("a1", -5)];
    state.reminders = [REM_SENT(sentAt)];
    state.messages = [{ id: "m-asing", tenantId: "t-asing", customerId: "c1", templateKey: "reminder", at: sentAt, status: "DELIVERED" }];
    const [r] = await listReminderInbox("t1");
    expect(r.sendStatus).toBe("TIDAK_DIKETAHUI");
  });
});

describe("listReminderInbox — reminder yang sudah DITUTUP keluar dari daftar (prinsip 6)", () => {
  const closed = ["DISMISSED", "CONVERTED", "EXPIRED"] as const;

  for (const st of closed) {
    it(`reminder ${st} -> unit TIDAK tampil di daftar default (tidak menumpuk selamanya)`, async () => {
      state.units = [unit("a1", -5)];
      state.reminders = [{ id: "r1", tenantId: "t1", assetId: "a1", dueDate: iso(-5 * day), leadTimeDays: 3, status: st, sentAt: null }];
      expect(await listReminderInbox("t1")).toHaveLength(0);
    });
  }

  it("filter includeClosed=true MENAMPILKAN yang sudah ditutup (riwayat, R5)", async () => {
    state.units = [unit("a1", -5)];
    state.reminders = [{ id: "r1", tenantId: "t1", assetId: "a1", dueDate: iso(-5 * day), leadTimeDays: 3, status: "DISMISSED", sentAt: null }];
    const rows = await listReminderInbox("t1", { includeClosed: true });
    expect(rows).toHaveLength(1);
    expect(rows[0].reminderStatus).toBe("DISMISSED");
  });

  it("unit due TANPA reminder tetap tampil (BELUM_DIKIRIM) saat includeClosed=true", async () => {
    state.units = [unit("a1", -5)];
    const rows = await listReminderInbox("t1", { includeClosed: true });
    expect(rows).toHaveLength(1);
    expect(rows[0].sendStatus).toBe("BELUM_DIKIRIM");
  });

  it("reminder TERAKHIR ditutup tapi lama masih SENT -> tetap ditutup (pakai yang terbaru)", async () => {
    state.units = [unit("a1", -5)];
    state.reminders = [
      { id: "r-lama", tenantId: "t1", assetId: "a1", dueDate: iso(-40 * day), leadTimeDays: 3, status: "SENT", sentAt: iso(-40 * day) },
      { id: "r-baru", tenantId: "t1", assetId: "a1", dueDate: iso(-5 * day), leadTimeDays: 3, status: "DISMISSED", sentAt: null },
    ];
    expect(await listReminderInbox("t1")).toHaveLength(0);
  });
});

describe("listReminderInbox — keamanan & error", () => {
  it("tenant tidak ada -> ServiceError NOT_FOUND", async () => {
    await expect(listReminderInbox("tak-ada")).rejects.toThrow(ServiceError);
  });

  it("hanya unit milik tenant itu yang dibaca", async () => {
    state.units = [
      unit("a1", -1),
      { ...unit("a2", -1), tenantId: "t-asing" },
    ];
    const rows = await listReminderInbox("t1");
    expect(rows.map((r) => r.assetId)).toEqual(["a1"]);
  });
});

describe("listReminderInbox — urutan default kartu (Rencana B)", () => {
  it("overdueDays menurun: paling telat di atas", async () => {
    state.units = [unit("a-overdue-2", -2), unit("a-overdue-40", -40), unit("a-overdue-7", -7)];
    const rows = await listReminderInbox("t1");
    expect(rows.map((r) => r.overdueDays)).toEqual([40, 7, 2]);
  });

  it("tie-break: overdue sama -> nextServiceDate menaik", async () => {
    // unit() memakai base "sekarang"; buat 2 unit dengan selisih due identik
    const base = Date.now() - 5 * 86400000;
    state.units = [
      { ...unit("a-akhir", -5), nextServiceDate: new Date(base + 1000) },
      { ...unit("a-awal", -5), nextServiceDate: new Date(base) },
    ];
    const rows = await listReminderInbox("t1");
    expect(rows.map((r) => r.assetId)).toEqual(["a-awal", "a-akhir"]);
  });

  it("tie-break terakhir: tanggal sama -> customerName menaik", async () => {
    state.customers = {
      ...state.customers,
      cZ: { id: "cZ", name: "Zelda", phone: "62811110009" },
      cA: { id: "cA", name: "Agus", phone: "62811110008" },
    };
    const now = Date.now();
    state.units = [
      { ...unit("a1", -3), customerId: "cZ", nextServiceDate: new Date(now - 3 * 86400000) },
      { ...unit("a2", -3), customerId: "cA", nextServiceDate: new Date(now - 3 * 86400000) },
    ];
    const rows = await listReminderInbox("t1");
    expect(rows.map((r) => r.customerName)).toEqual(["Agus", "Zelda"]);
  });

  it("kasus tunggal & kosong tetap aman", async () => {
    state.units = [unit("a1", -1)];
    const rows = await listReminderInbox("t1");
    expect(rows).toHaveLength(1);
    state.units = [];
    expect(await listReminderInbox("t1")).toHaveLength(0);
  });
});

describe("listReminderInbox — Terkirim Otomatis vs Terkirim Manual (Rencana A)", () => {
  it("ada MessageLog cocok -> TERKIRIM_OTOMATIS (bukti gateway, bukan label generik)", async () => {
    const sentAt = iso(-2 * day);
    state.units = [unit("a1", -5)];
    state.reminders = [{ id: "r1", tenantId: "t1", assetId: "a1", dueDate: iso(-5 * day), leadTimeDays: 3, status: "SENT", sentAt, manualSentAt: null } as any];
    state.messages = [{ id: "m1", tenantId: "t1", customerId: "c1", templateKey: "reminder", at: new Date(sentAt.getTime() + 300), status: "SENT" }];
    const [r] = await listReminderInbox("t1");
    expect(r.sendStatus).toBe("TERKIRIM_OTOMATIS");
  });

  it("ditandai manual, tanpa MessageLog -> TERKIRIM_MANUAL", async () => {
    const manualAt = iso(-2 * day);
    state.units = [unit("a1", -5)];
    state.reminders = [{ id: "r1", tenantId: "t1", assetId: "a1", dueDate: iso(-5 * day), leadTimeDays: 3, status: "SENT", sentAt: manualAt, manualSentAt: manualAt } as any];
    state.messages = [];
    const [r] = await listReminderInbox("t1");
    expect(r.sendStatus).toBe("TERKIRIM_MANUAL");
    expect(r.messageLogId).toBeNull();
  });

  it("ada MessageLog GAGAL + pernah ditandai manual -> menampilkan GAGAL (bukti gateway menang)", async () => {
    const sentAt = iso(-2 * day);
    state.units = [unit("a1", -5)];
    state.reminders = [{ id: "r1", tenantId: "t1", assetId: "a1", dueDate: iso(-5 * day), leadTimeDays: 3, status: "SENT", sentAt, manualSentAt: iso(-1 * day) } as any];
    state.messages = [{ id: "m1", tenantId: "t1", customerId: "c1", templateKey: "reminder", at: new Date(sentAt.getTime() + 300), status: "FAILED" }];
    const [r] = await listReminderInbox("t1");
    expect(r.sendStatus).toBe("GAGAL");
  });

  it("SENT tanpa sentAt & tanpa manual -> tetap TIDAK_DIKETAHUI (jangan menebak)", async () => {
    state.units = [unit("a1", -5)];
    state.reminders = [{ id: "r1", tenantId: "t1", assetId: "a1", dueDate: iso(-5 * day), leadTimeDays: 3, status: "SENT", sentAt: null, manualSentAt: null } as any];
    state.messages = [];
    const [r] = await listReminderInbox("t1");
    expect(r.sendStatus).toBe("TIDAK_DIKETAHUI");
  });
});
