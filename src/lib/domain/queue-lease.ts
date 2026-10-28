/**
 * Lease antrean pengiriman (F3 / G10) — MURNI, tanpa DB.
 *
 * MASALAH (terbukti dari kode): dispatcher mengklaim QUEUED -> SENDING lalu memanggil
 * provider. Bila proses mati di tengah, baris tertahan SENDING selamanya karena
 * pencarian hanya mengambil QUEUED. Pesan hilang tanpa jejak.
 *
 * ATURAN (rencana §F3): JANGAN blind-requeue. Outcome provider tidak dapat
 * dipastikan (gateway tidak menyediakan endpoint lookup job), jadi kirim ulang
 * otomatis berisiko menggandakan pesan ke pelanggan. Karena itu baris dengan
 * lease kedaluwarsa ditandai UNKNOWN — terlihat oleh operator, bukan dikirim ulang.
 */

/** Durasi lease default (menit). Cukup untuk satu pengiriman normal. */
export const DEFAULT_LEASE_MINUTES = 10;

/** Batas bawah/atas yang dibenarkan (anti salah konfigurasi). */
export const MIN_LEASE_MINUTES = 2;
export const MAX_LEASE_MINUTES = 120;

export function leaseMinutesFromEnv(raw: string | undefined): number {
  // Env kosong/undefined → DEFAULT. (Number("") = 0 → akan ter-clamp ke MIN=2;
  // itu membuat lease terlalu pendek dan memicu recovery palsu pada kiriman
  // normal — bug yang ditemukan lewat tes.)
  if (raw === undefined || raw === null) return DEFAULT_LEASE_MINUTES;
  const trimmed = String(raw).trim();
  if (trimmed === "") return DEFAULT_LEASE_MINUTES;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return DEFAULT_LEASE_MINUTES;
  return Math.min(Math.max(Math.round(n), MIN_LEASE_MINUTES), MAX_LEASE_MINUTES);
}

/** Instan kedaluwarsa lease dari saat klaim. */
export function leaseExpiry(from: Date = new Date(), minutes: number = DEFAULT_LEASE_MINUTES): Date {
  return new Date(from.getTime() + minutes * 60_000);
}

/** Apakah lease sudah kedaluwarsa (bandingkan instan, bukan hari kalender). */
export function isLeaseExpired(leaseExpiresAt: Date | null, now: Date = new Date()): boolean {
  if (!leaseExpiresAt) return false;
  return leaseExpiresAt.getTime() <= now.getTime();
}

/**
 *Kondisi reclaim: baris SENDING dengan lease kedaluwarsa = "hasil tak pasti".
 * TIDAK boleh langsung dikirim ulang → status UNKNOWN.
 */
export function staleSendingOutcome(params: {
  status: string;
  leaseExpiresAt: Date | null;
  now: Date;
}): "claimable" | "stale-unknown" | "skip" {
  if (params.status === "QUEUED") return "claimable";
  if (params.status === "SENDING") {
    // null = baris legacy (diklaim sebelum kolom lease ada) oleh proses yang sudah
    // tidak berjalan → hasil juga tak pasti. Konsisten dengan query SQL recovery
    // (`leaseExpiresAt: {lte:now} OR null`).
    if (params.leaseExpiresAt === null) return "stale-unknown";
    if (isLeaseExpired(params.leaseExpiresAt, params.now)) return "stale-unknown";
  }
  return "skip";
}
