/**
 * Relay ke shared Messaging Gateway (VPS-INFRA). Dipakai app untuk mengirim WA
 * lewat gateway bersama, alih-alih memuat whatsapp-web.js sendiri.
 *
 * externalId = tenantId (1 sesi WA per tenant). Konfigurasi via ENV:
 *   WA_GATEWAY_URL   (mis. https://gateway.domain)
 *   WA_GATEWAY_KEY   (API key app aircon di gateway)
 * Bila ENV kosong → dianggap belum aktif (caller boleh fallback ke worker DB lama).
 */
import "server-only";

export function isGatewayConfigured(): boolean {
  return Boolean(process.env.WA_GATEWAY_URL && process.env.WA_GATEWAY_KEY);
}

function base(): { url: string; key: string } {
  const url = process.env.WA_GATEWAY_URL;
  const key = process.env.WA_GATEWAY_KEY;
  if (!url || !key) throw new Error("WA_GATEWAY_URL/WA_GATEWAY_KEY belum diset");
  return { url: url.replace(/\/+$/, ""), key };
}

/** Kirim pesan WA via gateway. externalId = tenantId. */
export async function gatewaySend(tenantId: string, toPhone: string, message: string): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const { url, key } = base();
  try {
    const r = await fetch(`${url}/v1/wa/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": key },
      body: JSON.stringify({ externalId: tenantId, toPhone, message }),
    });
    const data = (await r.json().catch(() => ({}))) as { messageId?: string; error?: string };
    if (!r.ok) return { ok: false, error: data.error ?? `gateway ${r.status}` };
    return { ok: true, messageId: data.messageId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "gateway error" };
  }
}

/** Minta sesi WA (QR) untuk tenant. */
export async function gatewayInitSession(tenantId: string): Promise<{ ok: boolean; qr?: string | null; ready?: boolean; error?: string }> {
  const { url, key } = base();
  try {
    const r = await fetch(`${url}/v1/wa/sessions/${encodeURIComponent(tenantId)}/init`, {
      method: "POST",
      headers: { "X-Api-Key": key },
    });
    const data = (await r.json().catch(() => ({}))) as { qr?: string | null; ready?: boolean; error?: string };
    if (!r.ok) return { ok: false, error: data.error ?? `gateway ${r.status}` };
    return { ok: true, qr: data.qr ?? null, ready: data.ready };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "gateway error" };
  }
}
