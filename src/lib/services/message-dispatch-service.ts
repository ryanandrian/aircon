/**
 * Message Dispatch — FLUSHER antrean WA: ambil MessageLog OUTBOUND status QUEUED,
 * kirim via shared gateway (gatewaySend), tandai SENT/FAILED + simpan gatewayMessageId.
 *
 * KENAPA pola ini: MessageLog = antrean durable (tahan crash, audit, retry). Baik reminder
 * (money loop) maupun dunning menulis MessageLog QUEUED; flusher tunggal ini mengirim
 * SEMUANYA lewat gateway. Idempoten: hanya proses QUEUED, langsung tandai hasil.
 * Aman-gagal per item: satu kegagalan tak menghentikan yang lain.
 */
import { prisma } from "@/lib/prisma";
import { gatewaySend, isGatewayConfigured } from "@/lib/wa/gateway-relay";

export async function flushQueuedMessages(limit = 100): Promise<{ configured: boolean; sent: number; failed: number; skipped: number }> {
  if (!(await isGatewayConfigured())) {
    // Gateway belum dikonfigurasi → jangan sentuh antrean (biarkan QUEUED untuk dikirim nanti).
    return { configured: false, sent: 0, failed: 0, skipped: 0 };
  }

  const queued = await prisma.messageLog.findMany({
    where: { direction: "OUTBOUND", status: "QUEUED", channel: "WA" },
    orderBy: { at: "asc" },
    take: limit,
  });

  let sent = 0, failed = 0, skipped = 0;
  for (const m of queued) {
    if (!m.toPhone || !m.body) {
      await prisma.messageLog.update({ where: { id: m.id }, data: { status: "FAILED" } }).catch(() => {});
      failed += 1;
      continue;
    }
    // Tandai SENDING dulu (cegah dobel kirim bila flusher tumpang tindih).
    const claim = await prisma.messageLog.updateMany({
      where: { id: m.id, status: "QUEUED" },
      data: { status: "SENDING" },
    });
    if (claim.count === 0) { skipped += 1; continue; } // sudah diklaim proses lain

    const res = await gatewaySend(m.tenantId, m.toPhone, m.body);
    if (res.ok) {
      await prisma.messageLog.update({
        where: { id: m.id },
        data: { status: "SENT", gatewayMessageId: res.messageId ?? null },
      }).catch(() => {});
      sent += 1;
    } else {
      await prisma.messageLog.update({ where: { id: m.id }, data: { status: "FAILED" } }).catch(() => {});
      failed += 1;
      console.error(`[dispatch] gagal kirim message=${m.id} tenant=${m.tenantId}: ${res.error}`);
    }
  }
  return { configured: true, sent, failed, skipped };
}
