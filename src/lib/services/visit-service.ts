/**
 * Tracking pengunjung unik landing publik (ukur hasil campaign).
 * PRIVASI: IP di-hash (SHA-256 + salt rahasia), TIDAK menyimpan IP mentah.
 * Idempoten: 1 (ipHash, hari) dihitung sekali → refresh/berkali-buka tak menggembungkan angka.
 * Helper murni (wibDay/hashIp/isBot/clientIp) ada di ../domain/visit-pure (teruji vitest).
 */
import "server-only";
import { prisma } from "@/lib/prisma";
import { wibDay, hashIp, isBotUserAgent, clientIpFromHeaders } from "@/lib/domain/visit-pure";

export { wibDay, isBotUserAgent, clientIpFromHeaders };

/**
 * Catat 1 kunjungan unik/hari. Idempoten via unique(ipHash, day).
 * Mengembalikan true bila baris BARU (pengunjung unik hari ini), false bila sudah tercatat/dilewati.
 */
export async function recordVisit(opts: { ip: string | null; userAgent: string | null; path?: string }): Promise<boolean> {
  if (!opts.ip) return false;
  if (isBotUserAgent(opts.userAgent)) return false;
  const ipHash = hashIp(opts.ip);
  const day = wibDay();
  try {
    await prisma.pageVisit.create({ data: { ipHash, day, path: opts.path?.slice(0, 200) || "/" } });
    return true; // baris baru → unik hari ini
  } catch {
    return false; // bentrok unique (sudah tercatat hari ini) atau error → tak dihitung ganda
  }
}

/** Statistik pengunjung untuk Ringkasan admin. */
export async function getVisitorStats(): Promise<{ uniqueAllTime: number; uniqueToday: number; visitsToday: number }> {
  const day = wibDay();
  const [distinctAll, todayRows] = await Promise.all([
    prisma.pageVisit.findMany({ distinct: ["ipHash"], select: { ipHash: true } }),
    prisma.pageVisit.count({ where: { day } }),
  ]);
  return {
    uniqueAllTime: distinctAll.length,
    uniqueToday: todayRows, // per hari, 1 baris = 1 IP unik hari itu
    visitsToday: todayRows,
  };
}
