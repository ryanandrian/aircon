/**
 * Domain Kinerja Tim — periode + agregasi kinerja PERFORMED.
 *
 * Sumber kebenaran (audit 2026-10-05):
 * - Penugasan  = JobAssignment (BUKAN kinerja — tidak dipakai di sini).
 * - Kinerja    = WorkItem.techIds/kernetIds pada WorkSession CLOSED
 *   (88/88 item live terisi — "yang benar-benar dikerjakan", permintaan user).
 *
 * Periode: hari | minggu (Senin–Minggu, konsisten `startOfWeek` agenda) | bulan.
 * Metrik ringkasan = jumlah pekerjaan + jumlah layanan dikerjakan + insentif
 * (user menutup pilihan ini; nilai uang per baris ada di DETAIL, bukan ringkasan).
 * Insentif memakai `computeItemIncentive` + gerbang `incentiveEnabled` — aturan
 * yang SAMA dengan computeIncentives (halaman Laporan), tanpa membaca invoice
 * (dasar periode = tanggal kerja, sesuai persetujuan user 2026-10-05).
 */
import { startOfWeek as agendaStartOfWeek } from "@/lib/domain/agenda";

// MODUL INI CLIENT-SAFE: hanya periode/label/querystring (tanpa prisma/pg).
// Agregasi kinerja (butuh computeItemIncentive) ada di ./kinerja-aggregate.

export type KinPeriod = "hari" | "minggu" | "bulan";

export interface KinParams {
  period: KinPeriod;
  anchor: Date;
}

const PERIODS = new Set<string>(["hari", "minggu", "bulan"]);

/** Tanggal "YYYY-MM-DD" → Date lokal (TIDAK via toISOString/UTC). */
function parseDay(v: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  // tolak tanggal tidak valid (mis. 2026-13-99)
  return d.getFullYear() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3])
    ? d
    : null;
}

/** Tanggal "YYYY-MM" → tgl 1 bulan tsb. */
function parseMonth(v: string): Date | null {
  const m = /^(\d{4})-(\d{2})$/.exec(v);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, 1);
  return d.getMonth() === Number(m[2]) - 1 ? d : null;
}

const first = (sp: { [k: string]: string | string[] | undefined }, k: string): string | undefined => {
  const v = sp[k];
  return Array.isArray(v) ? v[0] : v;
};

export function parseKinerjaParams(sp: { [k: string]: string | string[] | undefined }): KinParams {
  const raw = first(sp, "periode");
  const period = raw && PERIODS.has(raw) ? (raw as KinPeriod) : "hari";
  const t = first(sp, "t");
  if (t) {
    const d = period === "bulan" ? parseMonth(t) : parseDay(t);
    if (d) return { period, anchor: d };
  }
  const now = new Date();
  return { period, anchor: new Date(now.getFullYear(), now.getMonth(), now.getDate()) };
}

export function kinRange(p: KinParams): { start: Date; end: Date } {
  if (p.period === "hari") {
    return {
      start: new Date(p.anchor.getFullYear(), p.anchor.getMonth(), p.anchor.getDate(), 0, 0, 0, 0),
      end: new Date(p.anchor.getFullYear(), p.anchor.getMonth(), p.anchor.getDate(), 23, 59, 59, 999),
    };
  }
  if (p.period === "minggu") {
    const start = agendaStartOfWeek(p.anchor);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 23, 59, 59, 999);
    return { start, end };
  }
  return {
    start: new Date(p.anchor.getFullYear(), p.anchor.getMonth(), 1, 0, 0, 0, 0),
    end: new Date(p.anchor.getFullYear(), p.anchor.getMonth() + 1, 0, 23, 59, 59, 999),
  };
}

/** Label periode utk tampilan (id-ID), mengikuti poli halaman detail/agenda. */
export function kinLabel(p: KinParams): string {
  const dateFmt = { day: "numeric", month: "long", year: "numeric" } as const;
  if (p.period === "hari") return p.anchor.toLocaleDateString("id-ID", dateFmt);
  if (p.period === "bulan") return p.anchor.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  const { start, end } = kinRange(p);
  const sameMonth = start.getMonth() === end.getMonth();
  const left = start.toLocaleDateString("id-ID", { day: "numeric", month: sameMonth ? undefined : "short" });
  const right = end.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  return `${left} – ${right}`;
}

/** Geser anchor ±1 unit periode (hari: ±1, minggu: ±7, bulan: ±1 bulan, tanggal diklaim). */
export function shiftKinerja(p: KinParams, dir: 1 | -1): KinParams {
  const a = p.anchor;
  if (p.period === "hari") return { period: p.period, anchor: new Date(a.getFullYear(), a.getMonth(), a.getDate() + dir) };
  if (p.period === "minggu") return { period: p.period, anchor: new Date(a.getFullYear(), a.getMonth(), a.getDate() + dir * 7) };
  const y = a.getFullYear(), m = a.getMonth() + dir, day = a.getDate();
  const last = new Date(y, m + 1, 0).getDate(); // hindari overflow tgl 31
  return { period: p.period, anchor: new Date(y, m, Math.min(day, last)) };
}

/** URL query utk navigasi board (?periode=&t=) — poli agendaQueryString. */
export function kinerjaQueryString(p: KinParams): string {
  const q = new URLSearchParams();
  q.set("periode", p.period);
  if (p.period === "bulan") {
    q.set("t", `${p.anchor.getFullYear()}-${String(p.anchor.getMonth() + 1).padStart(2, "0")}`);
  } else {
    q.set(
      "t",
      `${p.anchor.getFullYear()}-${String(p.anchor.getMonth() + 1).padStart(2, "0")}-${String(p.anchor.getDate()).padStart(2, "0")}`,
    );
  }
  return q.toString();
}
