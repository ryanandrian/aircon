/**
 * JEJAK PENGIRIMAN DOKUMEN TENANT → PELANGGAN (F5, G28, G30).
 *
 * Punchasan ini menutup residual yang tercatat di SSOT: `sendInvoiceViaWa`,
 * `sendReceiptViaWa` (invoice-service) dan `ownerSendInviteWa` (masuk-teknisi)
 * memanggil `gatewaySend` LANGSUNG, sehingga tak ada `MessageLog` ⇒ tak ada
 * tier bukti di Admin → Notifikasi, tak ada `suppressedReason` (nomor kosong
 * hilang tanpa jejak), dan tak ada `gatewayMessageId` (callback status gateway
 * tak bisa mengaitkan hasil kirim).
 *
 * SEMANTIKA (penting — jangan diubah sembarangan):
 *  - Pemicunya tetap AKSI MANUAL user. Tidak jadi antrean otomatis, tidak ada
 *    cron/dispatcher/worker baru, tidak ada kolom atau tabel baru.
 *  - Baris dicatat dengan status LANGSUNG (SENT/FAILED/SUPPRESSED), BUKAN
 *    `QUEUED`. Kalau `QUEUED`, flusher `/api/cron/dunning` akan mengirim ulang
 *    pesan yang sudah terkirim ⇒ duplikat ke pelanggan.
 *  - `gatewayMessageId` disimpan ⇒ callback `/api/wa/callback` yang sudah ada
 *    bisa menaikkan tier status (SENT → DELIVERED → READ_CONFIRMED).
 *  - `templateKey` memakai key KLASIFIKASI (`invoice_wa`, `receipt_wa`,
 *    `tech_invite_wa`) — bukan key katalog copy, supaya tak ada key orphan di
 *    katalog platform (G23: katalog = satu sumber copy).
 *  - Kegagalan pencatatan TIDAK melempar: pesan sudah terkirim ke pelanggan;
 *    kegagalan menulis bukti tak boleh membuat UI menyatakan "gagal" (yang
 *    mendorong pengguna menekan kirim lagi).
 */
import { prisma } from "@/lib/prisma";

/** Key klasifikasi bukti kiriman manual (bukan key katalog copy platform). */
export const DOCUMENT_SEND_TEMPLATE_KEYS = {
  invoice: "invoice_wa",
  receipt: "receipt_wa",
  techInvite: "tech_invite_wa",
} as const;
export type DocumentSendKind = keyof typeof DOCUMENT_SEND_TEMPLATE_KEYS;

export interface DocumentSendTraceInput {
  tenantId: string;
  kind: DocumentSendKind;
  /** Nomor tujuan (mentah dari sumber). */
  toPhone: string | null;
  /** Body pesan yang benar-benar dikirim. */
  body: string;
  /** Customer terkait, bila ada (untuk korelasi inbox reminder). */
  customerId?: string | null;
}

/**
 * Hasil gateway yang sudah dinormalisasi:
 *  - `sent`    → terkirim (gateway ok, atau 409 duplicate ⇒ pesan identik sudah
 *                terkirim sebelumnya, jadi bukti SENT + messageId gateway).
 *  - `failed`  → gagal mencoba (gateway menolak).
 *  - `held`    → ditahan gateway (kill switch WA / kapasitas sesi): tak ada
 *                pengiriman percobaan ⇒ DITAHAN, bukan "gagal".
 */
export type DocumentSendOutcome = "sent" | "failed" | "held";

export interface DocumentSendTraceResult {
  /** Baris jejak tercatat? */
  traced: boolean;
  /** Id baris MessageLog (kalau ada). */
  messageLogId?: string;
  /** Alasan tak tercatat. */
  reason?: string;
}

/**
 * Catat bukti hasil gateway pada antrean yang sama (`MessageLog` tenant→pelanggan).
 * Tidak pernah melempar error.
 */
export async function traceDocumentSend(
  input: DocumentSendTraceInput,
  outcome: { result: DocumentSendOutcome; gatewayMessageId?: string | null; error?: string },
): Promise<DocumentSendTraceResult> {
  const templateKey = DOCUMENT_SEND_TEMPLATE_KEYS[input.kind];
  const phone = input.toPhone?.trim() || null;

  let status: "SENT" | "FAILED" | "SUPPRESSED";
  let suppressedReason: string | null = null;
  if (!phone) {
    // Nomor tujuan kosong ⇒ DITAHAN & DICATAT (pola G28). Bukan "gagal kirim".
    status = "SUPPRESSED";
    suppressedReason = "nomor WhatsApp tujuan kosong";
  } else if (outcome.result === "sent") {
    status = "SENT";
  } else if (outcome.result === "held") {
    status = "SUPPRESSED";
    suppressedReason = `ditahan gateway: ${outcome.error ?? "kapasitas/kill switch"}`;
  } else {
    status = "FAILED";
  }

  try {
    const row = await prisma.messageLog.create({
      data: {
        tenantId: input.tenantId,
        customerId: input.customerId ?? null,
        channel: "WA",
        templateKey,
        direction: "OUTBOUND",
        status,
        toPhone: phone,
        body: input.body,
        suppressedReason,
        gatewayMessageId: status === "SENT" ? outcome.gatewayMessageId ?? null : null,
      },
      select: { id: true },
    });
    return { traced: true, messageLogId: row.id };
  } catch (e) {
    console.error("[doc-send-trace] gagal catat jejak kirim:", e);
    return { traced: false, reason: e instanceof Error ? e.message : String(e) };
  }
}
