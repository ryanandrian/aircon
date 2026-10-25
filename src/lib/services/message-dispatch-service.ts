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

export async function flushQueuedMessages(limit = 100): Promise<{ configured: boolean; sent: number; failed: number; skipped: number; deferred: number }> {
  if (!(await isGatewayConfigured())) {
    // Gateway belum dikonfigurasi → jangan sentuh antrean (biarkan QUEUED untuk dikirim nanti).
    return { configured: false, sent: 0, failed: 0, skipped: 0, deferred: 0 };
  }

  const queued = await prisma.messageLog.findMany({
    where: { direction: "OUTBOUND", status: "QUEUED", channel: "WA" },
    orderBy: { at: "asc" },
    take: limit,
  });

  let sent = 0, failed = 0, skipped = 0, deferred = 0;
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

    // IDENTITAS PER-PESAN, BUKAN ISI PESAN (fix 2026-10-25).
    //
    // Tanpa `idempotencyKey`, gateway menurunkan kunci dari ISI pesan
    // (`legacy:<externalId>:<toPhone>:<message>`) dan menyimpannya PERMANEN di
    // durable queue. Akibatnya pengingat dengan teks yang sama (mis. unit AC
    // sama, siklus perawatan berikutnya) ditolak 409 selamanya — pengingat
    // TIDAK PERNAH terkirim dua kali. Bukti live: job SENT 2 Okt 2026
    // (`1790968107708-174`) masih memblokir pesan identik pada 25 Okt.
    //
    // `m.id` = id baris MessageLog = identitas EVENT, unik per pengiriman.
    // Dengan begitu: (a) retry pesan yang sama tetap idempoten, (b) pengingat
    // untuk siklus berikutnya (baris MessageLog baru) tetap terkirim.
    const res = await gatewaySend(m.tenantId, m.toPhone, m.body, { idempotencyKey: `aircon:${m.id}` });
    if (res.ok) {
      await prisma.messageLog.update({
        where: { id: m.id },
        data: { status: "SENT", gatewayMessageId: res.messageId ?? null },
      }).catch(() => {});
      sent += 1;
    } else if (res.deferred) {
      // TRANSIENT (kapasitas sesi penuh / tekanan memori / karantina sementara):
      // kembalikan ke antrean. Menandainya FAILED = pesan hilang permanen dan
      // pengingat tenant hilang tanpa jejak — bug 2026-10-25.
      await prisma.messageLog.update({ where: { id: m.id }, data: { status: "QUEUED" } }).catch(() => {});
      deferred += 1;
      console.warn(`[dispatch] tahan message=${m.id} tenant=${m.tenantId} (${res.error}); menunggu slot`);
    } else {
      await prisma.messageLog.update({ where: { id: m.id }, data: { status: "FAILED" } }).catch(() => {});
      failed += 1;
      console.error(`[dispatch] gagal kirim message=${m.id} tenant=${m.tenantId}: ${res.error}`);
    }
  }
  return { configured: true, sent, failed, skipped, deferred };
}
