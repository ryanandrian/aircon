import { describe, it, expect } from "vitest";
import {
  parseAgendaParams,
  agendaRange,
  agendaRangeLabel,
  agendaQueryString,
  agendaToday,
  effectiveHistoryDate,
  shiftAgenda,
  startOfWeek,
  dayKey,
  dayLabel,
  dayBox,
  fmtJam,
  fmtDurasi,
  groupByDay,
  STATUS_FILTERS,
} from "../src/lib/domain/agenda";

/** Base param pekan kerja (dipakai banyak test — hindari hardcode berulang). */
const base = {
  view: "week" as const,
  year: 2026,
  month: 10,
  day: 5, // Senin 5 Okt 2026
  q: "",
  tim: "",
  status: "SEMUA" as const,
};

describe("parseAgendaParams — validasi ketat", () => {
  it("default: pekan berjalan (tanpa param)", () => {
    const p = parseAgendaParams({});
    expect(p.view).toBe("week");
    expect(p.status).toBe("SEMUA");
    expect(p.q).toBe("");
    expect(p.tim).toBe("");
    expect(p.year).toBe(new Date().getFullYear());
    expect(p.month).toBe(new Date().getMonth() + 1);
    expect(p.day).toBe(new Date().getDate());
  });

  it("tanpa `tampilan` tapi ada `q` → jatuh ke riwayat (cari lintas periode)", () => {
    expect(parseAgendaParams({ q: "0812" }).view).toBe("riwayat");
    expect(parseAgendaParams({ q: "0812" }).q).toBe("0812");
  });

  it("`tampilan` eksplisit mengalahkan default dari q", () => {
    expect(parseAgendaParams({ tampilan: "month", q: "x" }).view).toBe("month");
    expect(parseAgendaParams({ tampilan: "riwayat" }).view).toBe("riwayat");
    expect(parseAgendaParams({ tampilan: "week" }).view).toBe("week");
  });

  it("nilai aneh ditolak → default (tanpa crash)", () => {
    const p = parseAgendaParams({ tampilan: "foo", bulan: "99", tahun: "abcd", tanggal: "-5", status: "XYZ" });
    expect(p.view).toBe("week");
    expect(p.month).toBe(new Date().getMonth() + 1);
    expect(p.year).toBe(new Date().getFullYear());
    expect(p.day).toBe(new Date().getDate());
    expect(p.status).toBe("SEMUA");
  });

  it("param array memakai elemen pertama", () => {
    const p = parseAgendaParams({ tampilan: ["month", "week"], status: ["BATAL", "SEMUA"] });
    expect(p.view).toBe("month");
    expect(p.status).toBe("BATAL");
  });

  it("q & tim dipotong panjangnya (harness: input tak terpercaya)", () => {
    expect(parseAgendaParams({ q: "x".repeat(500) }).q.length).toBe(80);
    expect(parseAgendaParams({ tim: "t".repeat(500) }).tim.length).toBe(60);
  });

  it("semua status key terdaftar", () => {
    for (const f of STATUS_FILTERS) {
      expect(parseAgendaParams({ status: f.key }).status).toBe(f.key);
    }
  });
});

describe("effectiveHistoryDate — job final tanpa jadwal tidak jadi 'Belum terjadwal'", () => {
  // REGRESI live AC Depok Jaya 2026-10-04 (lihat juga tests/agenda-where.test.ts).
  it("COMPLETED tanpa jadwal memakai completedAt", () => {
    expect(effectiveHistoryDate({
      scheduledDate: null, status: "COMPLETED",
      completedAt: "2026-09-18T03:45:08.066Z", updatedAt: "2026-09-18T03:45:08.443Z",
    })).toBe("2026-09-18T03:45:08.066Z");
  });
  it("CANCELLED tanpa jadwal memakai updatedAt", () => {
    expect(effectiveHistoryDate({
      scheduledDate: null, status: "CANCELLED",
      completedAt: null, updatedAt: "2026-09-18T04:00:56.672Z",
    })).toBe("2026-09-18T04:00:56.672Z");
  });
  it("job AKTIF tanpa jadwal tetap null (berhak masuk 'Belum terjadwal')", () => {
    for (const status of ["DRAFT", "ASSIGNED", "IN_PROGRESS", "WAITING"]) {
      expect(effectiveHistoryDate({ scheduledDate: null, status, completedAt: null, updatedAt: "x" })).toBeNull();
    }
  });
  it("jadwal menang atas tanggal lain (prioritas pertama)", () => {
    expect(effectiveHistoryDate({
      scheduledDate: "2026-09-10T00:00:00.000Z", status: "COMPLETED",
      completedAt: "2026-09-18T03:45:08.066Z", updatedAt: "2026-09-18T04:00:00Z",
    })).toBe("2026-09-10T00:00:00.000Z");
  });
});

describe("startOfWeek — Senin..Minggu", () => {
  it("Senin tetap Senin", () => {
    const s = startOfWeek(new Date(2026, 9, 5));
    expect(s.getDay()).toBe(1);
    expect(s.getDate()).toBe(5);
  });
  it("Minggu mundur ke Senin pekan sama", () => {
    const s = startOfWeek(new Date(2026, 9, 11));
    expect(s.getDate()).toBe(5);
    expect(s.getMonth()).toBe(9);
  });
  it("Selasa maju mundur ke Senin", () => {
    const s = startOfWeek(new Date(2026, 9, 6));
    expect(s.getDate()).toBe(5);
  });
  it("lintas bulan: Minggu 4 Okt → Senin 28 Sep", () => {
    const s = startOfWeek(new Date(2026, 9, 4));
    expect(s.getMonth()).toBe(8);
    expect(s.getDate()).toBe(28);
  });
  it("waktu selalu 00:00.000 lokal", () => {
    const s = startOfWeek(new Date(2026, 9, 7, 13, 45, 30, 123));
    expect([s.getHours(), s.getMinutes(), s.getSeconds(), s.getMilliseconds()]).toEqual([0, 0, 0, 0]);
  });
});

describe("agendaRange — rentang inklusif", () => {
  it("pekan: Senin 00:00 → Minggu 23:59.999", () => {
    const r = agendaRange(base)!;
    expect(r.from.getDate()).toBe(5);
    expect(r.to.getDate()).toBe(11);
    expect(r.from.getHours()).toBe(0);
    expect([r.to.getHours(), r.to.getMinutes(), r.to.getSeconds(), r.to.getMilliseconds()]).toEqual([23, 59, 59, 999]);
  });
  it("bulan: tgl 1 → akhir bulan 23:59.999 (termasuk 31)", () => {
    const r = agendaRange({ ...base, view: "month", day: 15 })!;
    expect(r.from.getDate()).toBe(1);
    expect(r.from.getMonth()).toBe(9);
    expect(r.to.getDate()).toBe(31);
    expect(r.to.getMonth()).toBe(9);
  });
  it("bulan Februari non-kabisat → 28", () => {
    const r = agendaRange({ ...base, view: "month", year: 2026, month: 2, day: 1 })!;
    expect(r.to.getDate()).toBe(28);
  });
  it("riwayat → null (tanpa rentang)", () => {
    expect(agendaRange({ ...base, view: "riwayat" })).toBeNull();
  });
});

describe("agendaRangeLabel", () => {
  it("pekan dalam satu bulan", () => {
    expect(agendaRangeLabel(base)).toBe("5–11 Oktober 2026");
  });
  it("pekan lintas bulan menulis dua bulan", () => {
    const l = agendaRangeLabel({ ...base, day: 4 }); // 28 Sep – 4 Okt 2026
    expect(l).toMatch(/28 Sep/);
    expect(l).toMatch(/4 Okt 2026/);
  });
  it("bulan", () => {
    expect(agendaRangeLabel({ ...base, view: "month", day: 1 })).toBe("Oktober 2026");
  });
  it("riwayat", () => {
    expect(agendaRangeLabel({ ...base, view: "riwayat" })).toBe("Seluruh riwayat");
  });
});

describe("agendaQueryString — roundtrip", () => {
  it("semua param eksplisit + null roundtrip lewat parse", () => {
    const p = { ...base, q: "Rizky", tim: "tim-1", status: "SELESAI" as const };
    const sp = Object.fromEntries(new URLSearchParams(agendaQueryString(p)));
    expect(parseAgendaParams(sp)).toEqual(p);
  });
  it("q/tim/status kosong & SEMUA TIDAK ikut di URL (URL bersih)", () => {
    const qs = agendaQueryString(base);
    expect(qs).not.toContain("q=");
    expect(qs).not.toContain("tim=");
    expect(qs).not.toContain("status=");
    expect(qs).toContain("tampilan=week");
  });
});

describe("shiftAgenda & agendaToday", () => {
  it("pekan +1 / -1", () => {
    expect(shiftAgenda(base, 1).day).toBe(12);
    expect(shiftAgenda(base, -1).day).toBe(28);
    expect(shiftAgenda(base, -1).month).toBe(9); // lintas bulan ikut menggeser
  });
  it("pekan +4 melewati batas bulan", () => {
    const p = shiftAgenda(base, 4); // 5 Okt + 28 hari = 2 Nov
    expect(p.month).toBe(11);
    expect(p.day).toBe(2);
  });
  it("bulan +1 → November, -1 → September (tahun ikut)", () => {
    const m = { ...base, view: "month" as const, day: 1 };
    expect(shiftAgenda(m, 1).month).toBe(11);
    const des = { ...base, view: "month" as const, month: 1, day: 1 };
    expect(shiftAgenda(des, -1)).toMatchObject({ month: 12, year: 2025 });
  });
  it("riwayat tidak bergeser", () => {
    const r = { ...base, view: "riwayat" as const };
    expect(shiftAgenda(r, 3)).toEqual(r);
    expect(agendaToday(r)).toEqual(r);
  });
  it("agendaToday = pekan/bulan berjalan", () => {
    const now = new Date();
    const t = agendaToday({ ...base, year: 2000, month: 1, day: 1 });
    expect(t.year).toBe(now.getFullYear());
    expect(t.month).toBe(now.getMonth() + 1);
    expect(t.day).toBe(now.getDate());
  });
});

describe("format tanggal/jam/durasi (id-ID)", () => {
  it("dayKey null/invalid → unscheduled", () => {
    expect(dayKey(null)).toBe("unscheduled");
    expect(dayKey(undefined)).toBe("unscheduled");
    expect(dayKey("bukan-tanggal")).toBe("unscheduled");
  });
  it("dayKey ISO → YYYY-MM-DD lokal", () => {
    const d = new Date(2026, 9, 5, 8, 30);
    expect(dayKey(d.toISOString())).toBe("2026-10-05");
  });
  it("dayLabel Senin / belum terjadwal", () => {
    expect(dayLabel("2026-10-05")).toBe("Senin, 5 Oktober");
    expect(dayLabel("unscheduled")).toBe("Belum terjadwal");
  });
  it("dayBox angka + bulan pendek", () => {
    expect(dayBox("2026-10-05")).toEqual({ top: "05", bottom: "Okt" });
    expect(dayBox("unscheduled")).toEqual({ top: "?", bottom: "" });
  });
  it("fmtJam format 2 digit HH.mm", () => {
    expect(fmtJam(new Date(2026, 9, 5, 8, 5).toISOString())).toBe("08.05");
    expect(fmtJam(new Date(2026, 9, 5, 0, 0).toISOString())).toBe("00.00");
  });
  it("fmtDurasi: menit → teks; kasus tak valid → null", () => {
    expect(fmtDurasi(90)).toBe("1 jam 30 mnt");
    expect(fmtDurasi(60)).toBe("1 jam");
    expect(fmtDurasi(45)).toBe("45 mnt");
    expect(fmtDurasi(null)).toBeNull();
    expect(fmtDurasi(0)).toBeNull();
    expect(fmtDurasi(-10)).toBeNull();
    expect(fmtDurasi(NaN)).toBeNull();
  });
});

describe("groupByDay — unscheduled di atas, urutan server utuh", () => {
  type Row = { scheduledDate: string | null };
  const iso = (y: number, m: number, d: number) => new Date(y, m - 1, d, 8).toISOString();

  it("job tanpa jadwal selalu grup pertama", () => {
    const rows: Row[] = [
      { scheduledDate: iso(2026, 10, 6) },
      { scheduledDate: null },
      { scheduledDate: iso(2026, 10, 5) },
    ];
    const g = groupByDay(rows, { dateOf: (r) => r.scheduledDate });
    expect(g[0].key).toBe("unscheduled");
    expect(g[0].jobs).toHaveLength(1);
    expect(g[1].key).toBe("2026-10-05");
    expect(g[2].key).toBe("2026-10-06");
  });

  it("acuan riwayat (desc) → tanggal terbaru di atas, tanpa scheduledDate tetap di atas", () => {
    const rows: Row[] = [
      { scheduledDate: iso(2026, 10, 5) },
      { scheduledDate: null },
      { scheduledDate: iso(2026, 10, 7) },
    ];
    const g = groupByDay(rows, { dateOf: (r) => r.scheduledDate, desc: true });
    expect(g[0].key).toBe("unscheduled");
    expect(g[1].key).toBe("2026-10-07");
    expect(g[2].key).toBe("2026-10-05");
  });

  it("job dalam hari sama tergabung & urutan baris dijaga", () => {
    const rows: Row[] = [
      { scheduledDate: iso(2026, 10, 5) },
      { scheduledDate: iso(2026, 10, 5) },
    ];
    const g = groupByDay(rows, { dateOf: (r) => r.scheduledDate });
    expect(g).toHaveLength(1);
    expect(g[0].jobs).toHaveLength(2);
    expect(g[0].jobs).toEqual(rows);
  });

  it("tanggal lokal dipakai, bukan tanggal UTC (anti-geser hari)", () => {
    // 4 Okt 2026 23:30 lokal (UTC+7) = 4 Okt 16:30 UTC — tetap harus masuk grup 2026-10-04.
    const rows: Row[] = [{ scheduledDate: new Date(2026, 9, 4, 23, 30).toISOString() }];
    const g = groupByDay(rows, { dateOf: (r) => r.scheduledDate });
    expect(g[0].key).toBe("2026-10-04");
    expect(g[0].label).toBe("Minggu, 4 Oktober");
  });

  it("label & box tersedia di tiap grup", () => {
    const g = groupByDay([{ scheduledDate: iso(2026, 10, 5) }], { dateOf: (r) => r.scheduledDate });
    expect(g[0].label).toBe("Senin, 5 Oktober");
    expect(g[0].box).toEqual({ top: "05", bottom: "Okt" });
  });
});
