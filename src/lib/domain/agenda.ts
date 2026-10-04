/**
 * Agenda Pekerjaan — helper PERIODE, FILTER & GRUP HARI (murni, tanpa side-effect).
 * Dipakai server page dan client board; sengaja bebas Prisma/Next agar mudah diuji.
 * Semua tanggal/jam memakai locale id-ID dan zona waktu lokal.
 *
 * Konvensi (sejajar formatter di halaman detail pekerjaan):
 * - Rentang pekan Senin..Minggu; rentang bulan tgl 1..akhir bulan, inklusif.
 * - "Belum terjadwal" (scheduledDate null) selalu tampil di ATAS.
 */
export type AgendaView = "week" | "month" | "riwayat";
export type AgendaStatusKey = "SEMUA" | "BELUM" | "SELESAI" | "BATAL" | "ULANG";

export const STATUS_FILTERS: { key: AgendaStatusKey; label: string }[] = [
  { key: "SEMUA", label: "Semua status" },
  { key: "BELUM", label: "Belum Selesai" },
  { key: "SELESAI", label: "Selesai" },
  { key: "BATAL", label: "Dibatalkan" },
  { key: "ULANG", label: "Dijadwalkan Ulang" },
];

const VIEW_KEYS = new Set<string>(["week", "month", "riwayat"]);
const STATUS_KEYS = new Set<string>(STATUS_FILTERS.map((f) => f.key));

export interface AgendaParams {
  view: AgendaView;
  /** 1-12 (1 = Januari) — untuk view month. */
  month: number;
  /** Tahun rentang — untuk view week/month. */
  year: number;
  /** Tanggal berapa pun dalam rentang — untuk view week. */
  day: number;
  q: string;
  /** id Technician untuk filter tim ("" = semua). */
  tim: string;
  status: AgendaStatusKey;
}

/**
 * Validasi searchParams mentah → AgendaParams siap pakai.
 * `?q=...` TANPA `tampilan` eksplisit → view jatuh ke "riwayat" supaya pencarian
 * mencakup SEMUA periode (mengikuti perilaku tab lama yang mencari lintas bucket).
 */
export function parseAgendaParams(sp: { [key: string]: string | string[] | undefined }): AgendaParams {
  const first = (key: string): string | undefined => {
    const value = sp[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const rawView = first("tampilan");
  const q = (first("q") ?? "").trim().slice(0, 80);
  const view: AgendaView =
    rawView !== undefined && VIEW_KEYS.has(rawView)
      ? (rawView as AgendaView)
      : q
        ? "riwayat"
        : "week";

  const now = new Date();
  const boundedInt = (value: string | undefined, min: number, max: number, fallback: number) => {
    const parsed = Number.parseInt(value ?? "", 10);
    return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
  };
  const rawStatus = first("status") ?? "SEMUA";
  return {
    view,
    month: boundedInt(first("bulan"), 1, 12, now.getMonth() + 1),
    year: boundedInt(first("tahun"), 2000, 2100, now.getFullYear()),
    day: boundedInt(first("tanggal"), 1, 31, now.getDate()),
    q,
    tim: (first("tim") ?? "").trim().slice(0, 60),
    status: STATUS_KEYS.has(rawStatus) ? (rawStatus as AgendaStatusKey) : "SEMUA",
  };
}

/** URL query string lengkap (selalu eksplisit — dipakai client saat interaksi). */
export function agendaQueryString(params: AgendaParams): string {
  const search = new URLSearchParams({
    tampilan: params.view,
    tahun: String(params.year),
    bulan: String(params.month),
    tanggal: String(params.day),
  });
  if (params.q) search.set("q", params.q);
  if (params.tim) search.set("tim", params.tim);
  if (params.status !== "SEMUA") search.set("status", params.status);
  return search.toString();
}

/** Awal pekan (Senin) pukul 00:00 lokal dari tanggal berapa pun dalam pekan itu. */
export function startOfWeek(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const mondayOffset = (start.getDay() + 6) % 7; // Senin = 0 .. Minggu = 6
  start.setDate(start.getDate() - mondayOffset);
  return start;
}

/** Rentang waktu (lokal) tampilan. `riwayat` = tanpa rentang. */
export function agendaRange(params: AgendaParams): { from: Date; to: Date } | null {
  if (params.view === "riwayat") return null;
  if (params.view === "month") {
    return {
      from: new Date(params.year, params.month - 1, 1),
      to: new Date(params.year, params.month, 0, 23, 59, 59, 999),
    };
  }
  const from = startOfWeek(new Date(params.year, params.month - 1, params.day));
  return { from, to: new Date(from.getFullYear(), from.getMonth(), from.getDate() + 6, 23, 59, 59, 999) };
}

/** Label periode (mis. "5–11 Oktober 2026", "28 Sep – 4 Okt 2026", "Oktober 2026"). */
export function agendaRangeLabel(params: AgendaParams): string {
  if (params.view === "riwayat") return "Seluruh riwayat";
  const range = agendaRange(params);
  if (!range) return "";
  if (params.view === "month") {
    return range.from.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  }
  if (range.from.getMonth() === range.to.getMonth()) {
    return `${range.from.getDate()}–${range.to.getDate()} ${range.from.toLocaleDateString("id-ID", { month: "long", year: "numeric" })}`;
  }
  const startMonth = range.from.toLocaleDateString("id-ID", { month: "short" });
  const endMonth = range.to.toLocaleDateString("id-ID", { month: "short", year: "numeric" });
  return `${range.from.getDate()} ${startMonth} – ${range.to.getDate()} ${endMonth}`;
}

/** Geser periode ±1 pekan / ±1 bulan. `riwayat` tidak bergeser. */
export function shiftAgenda(params: AgendaParams, delta: number): AgendaParams {
  if (params.view === "riwayat") return params;
  if (params.view === "month") {
    const date = new Date(params.year, params.month - 1 + delta, 1);
    return { ...params, year: date.getFullYear(), month: date.getMonth() + 1, day: 1 };
  }
  const date = new Date(params.year, params.month - 1, params.day);
  date.setDate(date.getDate() + delta * 7);
  return { ...params, year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
}

/** Periode berjalan (tombol "Hari ini"). `riwayat` tidak berubah. */
export function agendaToday(params: AgendaParams): AgendaParams {
  if (params.view === "riwayat") return params;
  const now = new Date();
  return { ...params, year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

/** Kunci hari YYYY-MM-DD (zona LOKAL) — pemisah grup agenda. */
export function dayKey(iso: string | null | undefined): string {
  if (!iso) return "unscheduled";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "unscheduled";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Judul grup hari (mis. "Senin, 5 Oktober" / "Belum terjadwal"). */
export function dayLabel(key: string): string {
  if (key === "unscheduled") return "Belum terjadwal";
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("id-ID", {
    weekday: "long", day: "numeric", month: "long",
  });
}

/** Kotak tanggal kecil (angka + bulan pendek) utk kepala grup. */
export function dayBox(key: string): { top: string; bottom: string } {
  if (key === "unscheduled") return { top: "?", bottom: "" };
  const [year, month, day] = key.split("-").map(Number);
  return {
    top: String(day).padStart(2, "0"),
    bottom: new Date(year, month - 1, day).toLocaleDateString("id-ID", { month: "short" }).replace(/\./g, ""),
  };
}

/** Jam "HH.mm" id-ID. */
export function fmtJam(iso: string): string {
  return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

/** Durasi manusiawi dari menit (mis. "1 jam 30 mnt"). Null bila tak valid. */
export function fmtDurasi(minutes: number | null | undefined): string | null {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  const remaining = Math.round(minutes % 60);
  if (hours && remaining) return `${hours} jam ${remaining} mnt`;
  if (hours) return `${hours} jam`;
  return `${remaining} mnt`;
}

export interface AgendaGroup<T> {
  key: string;
  label: string;
  box: { top: string; bottom: string };
  jobs: T[];
}

/**
 * Kelompokkan baris agenda per hari.
 * - `dateOf` mengembalikan ISO atau null (null → grup "unscheduled" di ATAS).
 * - `desc` dipakai utk riwayat (tanggal terbaru di atas).
 * Urutan baris DALAM grup mengikuti urutan data dari server.
 */
export function groupByDay<T>(
  rows: T[],
  opts: { dateOf: (row: T) => string | null; desc?: boolean },
): AgendaGroup<T>[] {
  const groups: AgendaGroup<T>[] = [];
  const index = new Map<string, AgendaGroup<T>>();
  for (const row of rows) {
    const key = dayKey(opts.dateOf(row));
    let group = index.get(key);
    if (!group) {
      group = { key, label: dayLabel(key), box: dayBox(key), jobs: [] };
      index.set(key, group);
      groups.push(group);
    }
    group.jobs.push(row);
  }
  groups.sort((a, b) => {
    if (a.key === "unscheduled") return b.key === "unscheduled" ? 0 : -1;
    if (b.key === "unscheduled") return 1;
    if (a.key === b.key) return 0;
    const result = a.key < b.key ? -1 : 1;
    return opts.desc ? -result : result;
  });
  return groups;
}
