/**
 * Kode booking (G13) — bukti fisik untuk pemesan.
 *
 * Diturunkan DETERMINISTIK dari `Lead.id` (bukan acak, bukan kolom baru):
 *  - Idempoten: submit ulang dengan token sama → lead sama → kode sama
 *    (tak ada kode ganda untuk satu booking).
 *  - Bukan token keamanan: hanya rujukan bacaan manusia saat menghubungi
 *    layanan. Tidak membuka data apa pun.
 */
export function bookingReference(leadId: string): string {
  const cleaned = leadId.replace(/[^a-zA-Z0-9]/g, "");
  return cleaned.slice(-6).toUpperCase();
}

/** Pesan konfirmasi WA untuk pemesan (tenant -> pemesan via sesi WA tenant). */
export function bookingConfirmationMessage(params: {
  tenantName: string;
  bookerName: string;
  reference: string;
  serviceName?: string | null;
  preferredDate?: string | null;
}): string {
  const lines: string[] = [
    `Halo ${params.bookerName}, booking Anda di ${params.tenantName} sudah diterima.`,
    `Kode booking: ${params.reference}`,
  ];
  if (params.serviceName) lines.push(`Layanan: ${params.serviceName}`);
  if (params.preferredDate) lines.push(`Tanggal preferensi: ${params.preferredDate}`);
  lines.push("Sebutkan kode booking saat dihubungi. Tim kami akan menghubungi Anda via WhatsApp.");
  return lines.join("\n");
}
