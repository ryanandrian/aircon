/**
 * Kebijakan anti-ban & hemat-RAM untuk WhatsApp Gateway.
 * Server ini UNTUK NOTIFIKASI (transaksional/opt-in), BUKAN blasting promosi.
 * Semua angka dari ENV (no hardcode) — bisa disetel tanpa ubah kode.
 */

export const policy = {
  // — Throttle laju (meniru manusia) —
  minGapMs: Number(process.env.WA_MIN_GAP_MS ?? 6000),      // jeda min antar pesan / sesi
  maxGapMs: Number(process.env.WA_MAX_GAP_MS ?? 15000),     // jeda maks (acak di antara)
  maxPerMin: Number(process.env.WA_MAX_PER_MIN ?? 8),       // batas pesan / menit / nomor

  // — Batas HARIAN per nomor (kunci anti-ban) —
  maxPerDay: Number(process.env.WA_MAX_PER_DAY ?? 200),     // plafon harian / nomor

  // — Warm-up nomor BARU (hari pertama pelan, naik bertahap) —
  warmupEnabled: (process.env.WA_WARMUP ?? "1") === "1",
  warmupDays: Number(process.env.WA_WARMUP_DAYS ?? 7),      // durasi ramp
  warmupDay1Cap: Number(process.env.WA_WARMUP_DAY1 ?? 20),  // plafon hari-1

  // — Jam tenang (jangan kirim tengah malam = mencurigakan & mengganggu) —
  quietStartHour: Number(process.env.WA_QUIET_START ?? 21), // 21:00
  quietEndHour: Number(process.env.WA_QUIET_END ?? 7),      // 07:00
  quietTzOffset: Number(process.env.WA_TZ_OFFSET ?? 7),     // WIB = UTC+7

  // — Hemat RAM: batasi sesi Chromium aktif + evict yang menganggur —
  maxLiveSessions: Number(process.env.WA_MAX_LIVE_SESSIONS ?? 20), // maks Chromium hidup
  idleEvictMs: Number(process.env.WA_IDLE_EVICT_MS ?? 30 * 60 * 1000), // 30 mnt idle → tutup
};

/** Apakah SEKARANG jam tenang? (kirim ditunda ke jam aktif) */
export function isQuietHour(now = new Date()) {
  const h = (now.getUTCHours() + policy.quietTzOffset + 24) % 24;
  const { quietStartHour: s, quietEndHour: e } = policy;
  return s < e ? (h >= s && h < e) : (h >= s || h < e); // tangani lewat tengah malam
}

/** Plafon efektif hari ini utk sebuah nomor (warm-up untuk nomor baru). */
export function dailyCap(firstSeenMs, now = Date.now()) {
  if (!policy.warmupEnabled || !firstSeenMs) return policy.maxPerDay;
  const ageDays = Math.floor((now - firstSeenMs) / (24 * 3600 * 1000));
  if (ageDays >= policy.warmupDays) return policy.maxPerDay;
  // Ramp linear dari day1Cap → maxPerDay sepanjang warmupDays.
  const frac = (ageDays + 1) / policy.warmupDays;
  const cap = Math.round(policy.warmupDay1Cap + (policy.maxPerDay - policy.warmupDay1Cap) * frac);
  return Math.min(cap, policy.maxPerDay);
}

/** Kunci hari (UTC+offset) untuk hitung kuota harian. */
export function dayKey(now = new Date()) {
  const shifted = new Date(now.getTime() + policy.quietTzOffset * 3600 * 1000);
  return shifted.toISOString().slice(0, 10);
}
