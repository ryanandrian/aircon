/**
 * Platform Notification Dispatcher — kirim antrean PlatformNotification (QUEUED).
 *
 * WA  → sesi "lumite-platform" (gatewaySendAs) — 1 nomor Lumite lintas SaaS.
 * EMAIL → SMTP admin@lumite.biz.id (sendEmail).
 *
 * Aman-gagal per item (1 gagal tak hentikan lain). Idempoten: klaim SENDING dulu (cegah dobel
 * bila dispatcher tumpang tindih). TERPISAH dari flushQueuedMessages (jalur tenant) — nol regresi.
 */
import "server-only";
import { prisma } from "@/lib/prisma";
import { gatewaySendAs, isGatewayConfigured } from "@/lib/wa/gateway-relay";
import { sendEmail, isEmailConfigured } from "@/lib/email/smtp";
import { leaseExpiry, leaseMinutesFromEnv } from "@/lib/domain/queue-lease";

const PLATFORM_WA_SESSION = "lumite-platform";
const MAX_ATTEMPTS = 3;
/** Subjek cadangan HANYA bila baris EMAIL tanpa subjek (tidak terjadi lewat notifyPlatform). */
const EMAIL_SUBJECT_FALLBACK = "Pemberitahuan Aircon";

/**
 * @param onlyIds Kirim HANYA baris ini (kirim manual admin / replay terarah).
 *  Tanpa opsi → antrean global (jalur cron). Dengan opsi → tidak menyedot
 *  antrean tenant lain (G20), dan attempts LEBIH TINGGI dari maksimum tetap
 *  boleh (itu keputusan eksplisit operator, bukan retry otomatis).
 */
export async function dispatchPlatformNotifications(
  limit = 100,
  onlyIds: string[] = [],
): Promise<{ sent: number; failed: number; skipped: number; stale: number }> {
  const waOn = await isGatewayConfigured();
  const emailOn = isEmailConfigured();

  const queued = await prisma.platformNotification.findMany({
    where: onlyIds.length
      ? { id: { in: onlyIds }, status: "QUEUED" }
      : { status: "QUEUED", attempts: { lt: MAX_ATTEMPTS } },
    orderBy: { createdAt: "asc" },
    take: onlyIds.length ? onlyIds.length : limit,
  });

  // ── RECOVERY STALE SENDING (F3/G10) ──────────────────────────────────────────
  // Lease kedaluwarsa = hasil kirim tak pasti → UNKNOWN, BUKAN kirim ulang
  // (gateway tanpa endpoint lookup job; duplikat lebih buruk daripada review).
  // Recovery (perbaikan antrean) hanya pada dispatch GLOBAL; kirim manual terarah
  // tidak menyentuh baris milik tenant lain (G20).
  const staleRows = onlyIds.length ? [] : await prisma.platformNotification.findMany({
    where: { status: "SENDING", OR: [{ leaseExpiresAt: { lte: new Date() } }, { leaseExpiresAt: null }] },
    select: { id: true, tenantId: true },
    take: limit,
  });
  for (const s of staleRows) {
    await prisma.platformNotification.update({
      where: { id: s.id },
      data: {
        status: "UNKNOWN",
        sendingAt: null,
        leaseExpiresAt: null,
        error: "lease kedaluwarsa: hasil kirim tidak dapat dipastikan; perlu review operator (tidak dikirim ulang)",
      },
    }).catch(() => {});
    console.error(`[platform-dispatch] stale SENDING -> UNKNOWN notif=${s.id} tenant=${s.tenantId}`);
  }

  let sent = 0, failed = 0, skipped = 0;
  const stale = staleRows.length;
  for (const n of queued) {
    // Channel belum siap → biarkan QUEUED (kirim nanti saat dikonfigurasi).
    if (n.channel === "WA" && !waOn) { skipped += 1; continue; }
    if (n.channel === "EMAIL" && !emailOn) { skipped += 1; continue; }

    // Klaim (QUEUED → SENDING) atomik: cegah dobel kirim.
    const claim = await prisma.platformNotification.updateMany({
      where: { id: n.id, status: "QUEUED" },
      data: {
        status: "SENDING",
        attempts: { increment: 1 },
        sendingAt: new Date(),
        leaseExpiresAt: leaseExpiry(new Date(), leaseMinutesFromEnv(process.env.PLATFORM_NOTIFICATION_LEASE_MINUTES)),
      },
    });
    if (claim.count === 0) { skipped += 1; continue; }

    const res = n.channel === "WA"
      ? await gatewaySendAs(PLATFORM_WA_SESSION, n.toAddress, n.body,
          // dedupeKey = idempotensi per-EVENT milik row. Meneruskannya membuat
          // gateway berhenti menebak dari isi pesan (lihat catatan di relay).
          { idempotencyKey: n.dedupeKey ?? null })
      : await sendEmail(n.toAddress, n.subject ?? EMAIL_SUBJECT_FALLBACK, n.body);

    if (res.ok) {
      await prisma.platformNotification.update({
        where: { id: n.id },
        data: { status: "SENT", sentAt: new Date(), gatewayMessageId: res.messageId ?? null, error: null, sendingAt: null, leaseExpiresAt: null },
      }).catch(() => {});
      sent += 1;
    } else if ("duplicate" in res && res.duplicate) {
      // ---------------------------------------------------------------------
      // 409 DUPLICATE = pesan identik SUDAH PERNAH terkirim (bukan kegagalan).
      //
      // Gateway mengembalikan `duplicate:true` + `messageId` (job yang
      // benar-benar mengirimkannya). Menyimpannya sebagai FAILED/QUEUED adalah
      // KEBOHONAN DATA: penerimanya memang sudah menerima pesan itu, sementara
      // kartu admin akan menampilkan "Gagal" dan antrean berputar sia-sia
      // selama MAX_ATTEMPTS karena gateway akan terus menjawab 409.
      //
      // DUA KASUS (fix 2026-10-26):
      //
      // 1) duplicate + messageId → ada bukti job yang mengirimkannya.
      //
      // 2) duplicate TANPA messageId → `messageId` null karena gateway
      //    menemukan hash di `recentHashes` (dedup 60 detik in-memory) tapi job
      //    yang dicocokkan sudah tidak ada di durable store. Ini yang terjadi
      //    untuk kunci LAMA berbasis isi pesan. Gateway tetap menjawab 409,
      //    artinya gateway MEMILIKI job itu (atau baru saja mengirimnya) —
      //    ia menolak karena pesan identik. Menolak = "sudah ada", bukan
      //    "gagal kirim".
      //
      //    gladly memakai 409 ini sebagai penanda "tidak perlu kirim lagi".
      //    Tanpa itu, notifikasi berputar 3x lalu FAILED padahal pesan sampai
      //    (bukti live: 11 notifikasi FAILED dengan error dedup, 16 Sep–23 Okt;
      //    job gateway `1792951208592-84` SENT untuk isi pesan yang sama).
      //
      //    Karena itu: TANPA messageId, tetapkan SENT dengan messageId null —
      //    kita tak bisa menunjuk job mana, tapi kita BISA membuktikan gateway
      //    menolak sebagai duplikat. Menandainya FAILED berarti data bohong.
      // ---------------------------------------------------------------------
      await prisma.platformNotification.update({
        where: { id: n.id },
        data: {
          status: "SENT",
          sentAt: new Date(),
          gatewayMessageId: res.messageId ?? null,
          error: null,
          sendingAt: null,
          leaseExpiresAt: null,
        },
      }).catch(() => {});
      sent += 1;
    } else {
      // Gagal → kembalikan ke QUEUED untuk retry (sampai MAX_ATTEMPTS), simpan error.
      const willRetry = n.attempts + 1 < MAX_ATTEMPTS;
      await prisma.platformNotification.update({
        where: { id: n.id },
        data: { status: willRetry ? "QUEUED" : "FAILED", error: res.error ?? "gagal", sendingAt: null, leaseExpiresAt: null },
      }).catch(() => {});
      failed += 1;
      console.error(`[platform-dispatch] gagal ${n.channel} notif=${n.id} tenant=${n.tenantId}: ${res.error}`);
    }
  }
  return { sent, failed, skipped, stale };
}
