/**
 * WA Gateway — abstraksi pengiriman WhatsApp.
 * v1.0: driver tunggal WEB (whatsapp-web.js). META disiapkan untuk fase enterprise.
 * App menulis MessageLog(status=QUEUED); apps/wa-worker mengirim & meng-update status.
 * Lihat docs/WhatsApp_Strategy_Gateway.md
 */

export type WaDriver = "WEB" | "META";

export interface WaSendRequest {
  tenantId: string;
  toPhone: string; // E.164 tanpa '+', mis. "62812xxxx"
  templateKey: string;
  vars: Record<string, string>;
  customerId?: string;
  jobId?: string;
}

export interface WaSendResult {
  status: "QUEUED";
  messageLogId?: string;
}

/** Render "Halo {{customer}}" + vars → string final. */
export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
}

/** Normalisasi nomor ke format wa (digits only, prefix 62). */
export function normalizePhone(raw: string): string {
  let p = raw.replace(/[^0-9]/g, "");
  if (p.startsWith("0")) p = "62" + p.slice(1);
  if (p.startsWith("620")) p = "62" + p.slice(3);
  return p;
}

/**
 * GUARD ANTI-SPAM (rem darurat autopilot). Mengembalikan alasan blokir, atau null bila boleh kirim.
 * PURE (zero import) supaya bisa dites & dipakai di mana saja.
 *
 * Mode:
 *  - WA_SEND_ALLOWLIST (comma-separated nomor) → HANYA nomor ini yang boleh (paling ketat).
 *  - WA_SAFE_MODE=1 → blokir semua KECUALI keluarga nomor demo aman (62899000...) + allowlist.
 *  - default (produksi tanpa flag) → izinkan (autopilot penuh), tapi tetap tolak nomor jelas-invalid.
 *
 * Ini mencegah otomatisasi menyapa nomor asing (pelajaran insiden data dummy 62812).
 */
export function blockedSendReason(
  rawPhone: string,
  env: { safeMode?: boolean; allowlist?: string } = {},
): string | null {
  const p = normalizePhone(rawPhone);
  if (p.length < 10 || !p.startsWith("62")) return `nomor tak valid (${p})`;

  const allow = (env.allowlist ?? "")
    .split(/[,\s]+/).map((x) => normalizePhone(x)).filter(Boolean);
  if (allow.length > 0) {
    return allow.includes(p) ? null : `di luar allowlist (${p})`;
  }
  if (env.safeMode) {
    // Keluarga demo aman: 62899000xxxx (mustahil jadi WA asli) → satu-satunya yang boleh saat safe mode.
    return p.startsWith("62899000") ? null : `SAFE_MODE: hanya nomor demo 62899000xxx (${p})`;
  }
  return null;
}
