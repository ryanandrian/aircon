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

const PLATFORM_WA_SESSION = "lumite-platform";
const MAX_ATTEMPTS = 3;

export async function dispatchPlatformNotifications(limit = 100): Promise<{ sent: number; failed: number; skipped: number }> {
  const waOn = await isGatewayConfigured();
  const emailOn = isEmailConfigured();

  const queued = await prisma.platformNotification.findMany({
    where: { status: "QUEUED", attempts: { lt: MAX_ATTEMPTS } },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  let sent = 0, failed = 0, skipped = 0;
  for (const n of queued) {
    // Channel belum siap → biarkan QUEUED (kirim nanti saat dikonfigurasi).
    if (n.channel === "WA" && !waOn) { skipped += 1; continue; }
    if (n.channel === "EMAIL" && !emailOn) { skipped += 1; continue; }

    // Klaim (QUEUED → SENDING) atomik: cegah dobel kirim.
    const claim = await prisma.platformNotification.updateMany({
      where: { id: n.id, status: "QUEUED" },
      data: { status: "SENDING", attempts: { increment: 1 } },
    });
    if (claim.count === 0) { skipped += 1; continue; }

    const res = n.channel === "WA"
      ? await gatewaySendAs(PLATFORM_WA_SESSION, n.toAddress, n.body)
      : await sendEmail(n.toAddress, n.subject ?? "Pemberitahuan Lumite", n.body);

    if (res.ok) {
      await prisma.platformNotification.update({
        where: { id: n.id },
        data: { status: "SENT", sentAt: new Date(), gatewayMessageId: res.messageId ?? null, error: null },
      }).catch(() => {});
      sent += 1;
    } else {
      // Gagal → kembalikan ke QUEUED untuk retry (sampai MAX_ATTEMPTS), simpan error.
      const willRetry = n.attempts + 1 < MAX_ATTEMPTS;
      await prisma.platformNotification.update({
        where: { id: n.id },
        data: { status: willRetry ? "QUEUED" : "FAILED", error: res.error ?? "gagal" },
      }).catch(() => {});
      failed += 1;
      console.error(`[platform-dispatch] gagal ${n.channel} notif=${n.id} tenant=${n.tenantId}: ${res.error}`);
    }
  }
  return { sent, failed, skipped };
}
