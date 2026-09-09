/**
 * Helper MURNI untuk tracking kunjungan — TANPA server-only/prisma agar bisa diuji vitest.
 */
import { createHash } from "crypto";

/** Tanggal "YYYY-MM-DD" zona WIB (+07) — kunci idempoten harian. */
export function wibDay(now: Date = new Date()): string {
  const wib = new Date(now.getTime() + 7 * 3600 * 1000);
  return wib.toISOString().slice(0, 10);
}

/** Hash IP + salt (SESSION_SECRET dipakai sbg salt; jatuh ke default bila absen). */
export function hashIp(ip: string): string {
  const salt = process.env.SESSION_SECRET || process.env.CRON_SECRET || "aircon-visit-salt";
  return createHash("sha256").update(salt + "|" + ip).digest("hex");
}

/** Ambil IP asli pengunjung dari header proxy (x-forwarded-for / x-real-ip). */
export function clientIpFromHeaders(h: Headers): string | null {
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return h.get("x-real-ip")?.trim() || null;
}

/** Bot/crawler umum — jangan dihitung agar angka campaign jujur. */
export function isBotUserAgent(ua: string | null): boolean {
  if (!ua) return true; // tanpa UA = mencurigakan (kebanyakan bot)
  return /bot|crawl|spider|slurp|bing|yandex|baidu|duckduck|facebookexternalhit|whatsapp|telegram|preview|headless|lighthouse|python-requests|curl|wget|axios|go-http/i.test(ua);
}
