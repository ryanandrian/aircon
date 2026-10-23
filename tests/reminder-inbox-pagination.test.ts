import { describe, it, expect, vi, beforeEach } from "vitest";

// G-A10 — seragamkan inbox Pengingat ke pola cursor (standar pelanggan/faktur/
// pekerjaan yang sudah mapan di repo). Keputusan pemilik 2026-10-14.
//
// BUKTI skala: Jaya Mandiri = 142 unit due (query live read-only) — halaman
// mengambil SEMUA sekaligus sementara halaman lain memakai take limit+1.
//
// Kontrak BARU listReminderInbox (jalur lama dikembangkan, nol modul baru):
//   { rows, nextCursor, totalCount }
// - limit default = 20 (sama dgn DEFAULT_LIMIT pelanggan)
// - cursor = assetId baris terakhir; baris berikutnya dimulai SETELAHnya
//   dalam urutan baku (overdueDays desc, nextServiceDate asc, customerName asc)
// - totalCount = jumlah baris lolos filter (sebelum slice) — dipakai kartu
//   Ringkasan (/app) agar jumlah tetap AKURAT walau halaman berpaginasi
// - sendStatus (filter server-side) — pengganti filter client yang lama
// - includeClosed tetap berlaku

vi.mock("@/lib/prisma", () => {
  const state: {
    tenant: { reminderLeadDays: number } | null;
    units: any[];
    reminders: any[];
    messages: any[];
  } = { tenant: { reminderLeadDays: 0 }, units: [], reminders: [], messages: [] };
  return {
    __state: state,
    prisma: {
      tenant: { findUnique: vi.fn(async () => state.tenant) },
      asset: { findMany: vi.fn(async () => state.units) },
      repeatReminder: { findMany: vi.fn(async () => state.reminders) },
      messageLog: { findMany: vi.fn(async () => state.messages) },
    },
  };
});

import * as prismaModule from "@/lib/prisma";
import { listReminderInbox } from "@/lib/services/reminder-service";

const state = (prismaModule as any).__state;

function unit(id: string, nextInDays: number, customerName = `C-${id}`) {
  const d = new Date();
  d.setDate(d.getDate() + nextInDays);
  return {
    id,
    brand: "Daikin",
    model: "FTM",
    capacityPk: 1,
    roomLocation: "Kamar",
    nextServiceDate: d,
    customerId: `cu-${id}`,
    customer: { name: customerName, phone: "62812" },
    deletedAt: null,
  };
}

beforeEach(() => {
  state.tenant = { reminderLeadDays: 0 };
  state.units = [];
  state.reminders = [];
  state.messages = [];
});

describe("listReminderInbox — cursor pagination (standar repo)", () => {
  it("default: mengambil 20 baris pertama + nextCursor utk sisa", async () => {
    state.units = Array.from({ length: 25 }, (_, i) => unit(`a${String(i).padStart(2, "0")}`, -(i + 1)));
    const r = await listReminderInbox("t1");
    expect(r.rows).toHaveLength(20);
    expect(r.totalCount).toBe(25);
    expect(r.nextCursor).toBe(r.rows[19].assetId); // baris terakhir halaman
  });

  it("cursor: halaman berikutnya melanjutkan SETELAH baris terakhir, tanpa tumpang tindih", async () => {
    state.units = Array.from({ length: 25 }, (_, i) => unit(`a${String(i).padStart(2, "0")}`, -(i + 1)));
    const p1 = await listReminderInbox("t1");
    const p2 = await listReminderInbox("t1", { cursor: p1.nextCursor ?? undefined });
    expect(p2.rows).toHaveLength(5); // 25 - 20
    const ids1 = new Set(p1.rows.map((x) => x.assetId));
    for (const row of p2.rows) expect(ids1.has(row.assetId)).toBe(false); // tanpa duplikat
    expect(p2.nextCursor).toBeNull(); // halaman terakhir
  });

  it("totalCount TIDAK terpengaruh limit (kartu Ringkasan tetap akurat)", async () => {
    state.units = Array.from({ length: 30 }, (_, i) => unit(`a${String(i).padStart(2, "0")}`, -1));
    const p1 = await listReminderInbox("t1", { limit: 5 });
    expect(p1.rows).toHaveLength(5);
    expect(p1.totalCount).toBe(30);
  });

  it("limit eksplisit dihormati (di-clamp positif)", async () => {
    state.units = Array.from({ length: 10 }, (_, i) => unit(`a${i}`, -1));
    const r = await listReminderInbox("t1", { limit: 3 });
    expect(r.rows).toHaveLength(3);
    expect(r.totalCount).toBe(10);
  });
});

describe("listReminderInbox — filter sendStatus di SERVER (pengganti filter client)", () => {
  function sentReminder(assetId: string, status: string, manual?: boolean) {
    const sentAt = new Date();
    return {
      id: `r-${assetId}`,
      assetId,
      status,
      sentAt,
      manualSentAt: manual ? sentAt : null,
      dueDate: sentAt,
      leadTimeDays: 0,
    };
  }

  it("filter BELUM_DIKIRIM: hanya unit tanpa reminder", async () => {
    state.units = [unit("a1", -1), unit("a2", -2)];
    state.reminders = [sentReminder("a2", "SENT", true)]; // a2 = TERKIRIM_MANUAL
    const r = await listReminderInbox("t1", { sendStatus: ["BELUM_DIKIRIM"] });
    expect(r.rows.map((x) => x.assetId)).toEqual(["a1"]);
    expect(r.totalCount).toBe(1); // terfilter di server, bukan di client
  });

  it("filter TERKIRIM_MANUAL: hanya unit dgn manualSentAt", async () => {
    state.units = [unit("a1", -1), unit("a2", -2)];
    state.reminders = [sentReminder("a2", "SENT", true)];
    const r = await listReminderInbox("t1", { sendStatus: ["TERKIRIM_MANUAL"] });
    expect(r.rows.map((x) => x.assetId)).toEqual(["a2"]);
  });

  it("filter kelompok 'Terkirim' (multi-status) mencakup 4 status — sama dgn Filter UI", async () => {
    state.units = [unit("a1", -1), unit("a2", -2), unit("a3", -3)];
    const at = new Date();
    state.reminders = [
      { id: "r2", assetId: "a2", status: "SENT", sentAt: at, manualSentAt: at, dueDate: at, leadTimeDays: 0 },
      { id: "r3", assetId: "a3", status: "SENT", sentAt: at, manualSentAt: null, dueDate: at, leadTimeDays: 0 },
    ];
    // a2 = TERKIRIM_MANUAL; a3 tanpa match MessageLog = TIDAK_DIKETAHUI
    const r = await listReminderInbox("t1", {
      sendStatus: ["TERKIRIM_OTOMATIS", "TERKIRIM_MANUAL", "DITERIMA", "DIBACA"],
    });
    expect(r.rows.map((x) => x.assetId)).toEqual(["a2"]);
  });

  it("tanpa filter sendStatus: semua baris lolos (perilaku default tidak berubah)", async () => {
    state.units = [unit("a1", -1), unit("a2", -2)];
    state.reminders = [sentReminder("a2", "SENT", true)];
    const r = await listReminderInbox("t1");
    expect(r.rows).toHaveLength(2);
  });
});

describe("listReminderInbox — regresi aturan lama TETAP UTUH", () => {
  it("includeClosed=false tetap menyembunyikan reminder DISMISSED", async () => {
    state.units = [unit("a1", -1)];
    state.reminders = [{
      id: "r1", assetId: "a1", status: "DISMISSED", sentAt: null,
      manualSentAt: null, dueDate: new Date(), leadTimeDays: 0,
    }];
    expect((await listReminderInbox("t1")).rows).toHaveLength(0);
    expect((await listReminderInbox("t1", { includeClosed: true })).rows).toHaveLength(1);
  });

  it("aturan jatuh tempo leadTime tenant TIDAK berubah", async () => {
    state.tenant = { reminderLeadDays: 3 };
    state.units = [unit("a1", 2)]; // 2 hari lagi, lead 3 -> masuk
    expect((await listReminderInbox("t1")).rows).toHaveLength(1);
    state.tenant = { reminderLeadDays: 0 };
    expect((await listReminderInbox("t1")).rows).toHaveLength(0);
  });

  it("urutan baku: overdue terbesar di halaman pertama", async () => {
    state.units = [unit("a1", -1), unit("a2", -10), unit("a3", -5)];
    const r = await listReminderInbox("t1");
    expect(r.rows.map((x) => x.assetId)).toEqual(["a2", "a3", "a1"]);
  });
});

describe("listReminderInbox — pencarian q (nama pelanggan, server-side)", () => {
  it("q mencocokkan nama pelanggan case-insensitive dan memangkas totalCount", async () => {
    state.units = [unit("a1", -1, "Budi Santoso"), unit("a2", -2, "Siti Aminah"), unit("a3", -3, "budi wijaya")];
    const r = await listReminderInbox("t1", { q: "BUDI" });
    // urutan baku: overdue terbesar dulu (a3=3 hari, a1=1 hari)
    expect(r.rows.map((x) => x.assetId)).toEqual(["a3", "a1"]);
    expect(r.totalCount).toBe(2); // totalCount = hasil pencarian, bukan semua
  });

  it("q hanya di-trim; whitespace kosong = tanpa pencarian (perilaku default utuh)", async () => {
    state.units = [unit("a1", -1, "Budi"), unit("a2", -2, "Siti")];
    const r = await listReminderInbox("t1", { q: "   " });
    expect(r.totalCount).toBe(2);
    expect(r.rows).toHaveLength(2);
  });

  it("q tanpa cocokan = kosong (rows 0, totalCount 0, nextCursor null)", async () => {
    state.units = [unit("a1", -1, "Budi")];
    const r = await listReminderInbox("t1", { q: "zaki" });
    expect(r.rows).toHaveLength(0);
    expect(r.totalCount).toBe(0);
    expect(r.nextCursor).toBeNull();
  });

  it("q BERKOMBINASI dgn filter sendStatus (dua filter aktif bersamaan)", async () => {
    const at = new Date();
    state.units = [unit("a1", -1, "Budi"), unit("a2", -2, "Siti")];
    state.reminders = [
      { id: "r2", assetId: "a2", status: "SENT", sentAt: at, manualSentAt: at, dueDate: at, leadTimeDays: 0 },
    ];
    const r = await listReminderInbox("t1", { sendStatus: ["BELUM_DIKIRIM"], q: "Budi" });
    expect(r.rows.map((x) => x.assetId)).toEqual(["a1"]);
    expect(r.totalCount).toBe(1);
  });

  it("cursor pagination melanjut di DALAM hasil pencarian", async () => {
    state.units = Array.from({ length: 25 }, (_, i) =>
      unit(`a${String(i).padStart(2, "0")}`, -(i + 1), `Budi ${i}`),
    );
    const p1 = await listReminderInbox("t1", { q: "budi", limit: 20 });
    expect(p1.totalCount).toBe(25);
    const p2 = await listReminderInbox("t1", { q: "budi", cursor: p1.nextCursor ?? undefined });
    expect(p2.rows).toHaveLength(5);
    expect(p2.totalCount).toBe(25);
  });
});
