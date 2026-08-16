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
