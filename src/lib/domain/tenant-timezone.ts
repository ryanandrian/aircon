/**
 * Zona waktu TENANT (keputusan K7, 2026-10-17).
 *
 * MENGAPA: seluruh rentang tanggal lama dihitung memakai zona SERVER (VPS = UTC),
 * sehingga pembayaran pukul 00.00–06.59 WIB tanggal 1 jatuh ke bulan sebelumnya
 * (fakta M5). Untuk laporan uang, ini tidak dapat diterima.
 *
 * Modul ini MURNI (tanpa DB, tanpa jaringan) — dipakai layar laporan & layar teknisi
 * supaya batas bulan / "sejak X hari" mengikuti zona milik tenant, bukan zona server.
 * Bawaan: WIB (seluruh tenant yang ada saat ini berzona WIB — diisi lewat migrasi L1).
 */

/** Zona bawaan bila tenant belum punya (dan seluruh tenant lama). */
export const DEFAULT_TENANT_TZ = "Asia/Jakarta";

/** Zona yang boleh dipakai di Indonesia. */
const KNOWN_ZONES = ["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura"];

/** Apakah string ini nama zona waktu yang dikenali runtime. */
function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Zona efektif tenant. Aman terhadap nilai kosong/tak dikenal → WIB
 * (laporan tidak boleh rusak hanya karena zona salah tulis).
 */
export function tenantTimeZone(tz?: string | null): string {
  if (!tz) return DEFAULT_TENANT_TZ;
  return isValidTimeZone(tz) ? tz : DEFAULT_TENANT_TZ;
}

/** Daftar zona yang boleh dipilih saat onboarding tenant. */
export function availableTenantTimeZones(): readonly string[] {
  return KNOWN_ZONES;
}

/** Komponen tanggal-waktu sebuah instan DILIHAT di zona tertentu. */
function zoneParts(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(instant);
  const val = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  return {
    year: val("year"), month: val("month"), day: val("day"),
    hour: val("hour"), minute: val("minute"), second: val("second"),
  };
}

/** Selisih zona (ms) pada instan itu: waktu-di-zona − waktu-UTC. */
function offsetMs(instant: Date, timeZone: string): number {
  const p = zoneParts(instant, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const truncatedToSecond = instant.getTime() - instant.getMilliseconds();
  return asUtc - truncatedToSecond;
}

/** Ubah "jam dinding" di suatu zona menjadi instan UTC yang sebenarnya. */
function fromZone(
  year: number, month: number, day: number,
  hour: number, minute: number, second: number, ms: number,
  timeZone: string,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute, second, ms);
  const first = offsetMs(new Date(guess), timeZone);
  let ts = guess - first;
  // Penyesuaian sekali lagi untuk tepi zona (Indonesia tanpa DST → tetap benar).
  const second_ = offsetMs(new Date(ts), timeZone);
  if (second_ !== first) ts = guess - second_;
  return new Date(ts);
}

/** Jumlah hari dalam bulan (1-12) pada tahun tertentu. */
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export interface ZoneRange {
  /** Instan UTC awal bulan (pukul 00.00.00.000 di zona tenant). */
  start: Date;
  /** Instan UTC akhir bulan (pukul 23.59.59.999 di zona tenant). */
  end: Date;
}

/**
 * Rentang "bulan ini" MENURUT ZONA TENANT untuk instan acuan.
 * Inilah pengganti `new Date(now.getFullYear(), now.getMonth(), 1)` yang memakai
 * zona server (M5) — dan sekarang sadar-zona, jadi pembayaran subuh tanggal 1
 * tetap masuk bulan berjalan.
 */
export function monthRangeInZone(instant: Date, tz?: string | null): ZoneRange {
  const timeZone = tenantTimeZone(tz);
  const { year, month } = zoneParts(instant, timeZone);
  const lastDay = daysInMonth(year, month);
  return {
    start: fromZone(year, month, 1, 0, 0, 0, 0, timeZone),
    end: fromZone(year, month, lastDay, 23, 59, 59, 999, timeZone),
  };
}

/** Nomor hari absolut sebuah instan menurut zona (untuk selisih hari kalender). */
function dayNumberInZone(instant: Date, timeZone: string): number {
  const { year, month, day } = zoneParts(instant, timeZone);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

/**
 * "Sejak X hari" menurut kalender zona tenant (keterangan umur, bukan penanda telat —
 * K6: tidak ada konsep terlambat). Hasil tidak pernah negatif.
 */
export function daysSinceInZone(from: Date, to: Date, tz?: string | null): number {
  const timeZone = tenantTimeZone(tz);
  return Math.max(0, dayNumberInZone(to, timeZone) - dayNumberInZone(from, timeZone));
}
