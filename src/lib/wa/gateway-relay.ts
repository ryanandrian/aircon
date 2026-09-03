/**
 * Relay ke shared Messaging Gateway (VPS-INFRA). Konfigurasi DB-FIRST (InfraConfig,
 * editable admin), fallback ENV. App kirim WA lewat gateway bersama.
 * externalId = tenantId (1 sesi WA per tenant).
 */
import "server-only";
import { getInfraConfig, getInfraSecrets } from "@/lib/services/infra-config-service";
import { blockedSendReason } from "@/lib/wa/gateway";

async function resolve(): Promise<{ url: string; key: string } | null> {
  // DB dulu (admin panel), lalu ENV sebagai fallback.
  const cfg = await getInfraConfig();
  const secrets = await getInfraSecrets();
  const url = (cfg.waGatewayUrl || process.env.WA_GATEWAY_URL || "").replace(/\/+$/, "");
  const key = secrets.gatewayKey || process.env.WA_GATEWAY_KEY || "";
  if (!url || !key) return null;
  return { url, key };
}

export async function isGatewayConfigured(): Promise<boolean> {
  return (await resolve()) !== null;
}

/** Kirim pesan WA via gateway. externalId = tenantId. */
export async function gatewaySend(tenantId: string, toPhone: string, message: string): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const cfg = await resolve();
  if (!cfg) return { ok: false, error: "Gateway WA belum dikonfigurasi (admin panel)" };

  // GUARD ANTI-SPAM (rem darurat autopilot): cegah kirim ke nomor asing/invalid.
  // WA_SAFE_MODE=1 → hanya nomor demo 62899000xxx; WA_SEND_ALLOWLIST → hanya nomor tsb.
  const reason = blockedSendReason(toPhone, {
    safeMode: process.env.WA_SAFE_MODE === "1",
    allowlist: process.env.WA_SEND_ALLOWLIST,
  });
  if (reason) {
    console.warn(`[gateway-relay] BLOKIR kirim ke ${toPhone}: ${reason}`);
    return { ok: false, error: `diblokir guard: ${reason}` };
  }

  try {
    const r = await fetch(`${cfg.url}/v1/wa/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": cfg.key },
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
  const cfg = await resolve();
  if (!cfg) return { ok: false, error: "Gateway WA belum dikonfigurasi (admin panel)" };
  try {
    const r = await fetch(`${cfg.url}/v1/wa/sessions/${encodeURIComponent(tenantId)}/init`, {
      method: "POST", headers: { "X-Api-Key": cfg.key },
    });
    const data = (await r.json().catch(() => ({}))) as { qr?: string | null; ready?: boolean; error?: string };
    if (!r.ok) return { ok: false, error: data.error ?? `gateway ${r.status}` };
    return { ok: true, qr: data.qr ?? null, ready: data.ready };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "gateway error" };
  }
}

/** Status sesi WA tenant (untuk polling di UI tautkan): {exists, ready, qr}. */
export async function gatewaySessionStatus(tenantId: string): Promise<{ ok: boolean; exists?: boolean; ready?: boolean; qr?: string | null; error?: string }> {
  const cfg = await resolve();
  if (!cfg) return { ok: false, error: "Gateway WA belum dikonfigurasi (admin panel)" };
  try {
    const r = await fetch(`${cfg.url}/v1/wa/sessions/${encodeURIComponent(tenantId)}`, {
      method: "GET", headers: { "X-Api-Key": cfg.key },
    });
    const data = (await r.json().catch(() => ({}))) as { exists?: boolean; ready?: boolean; qr?: string | null; error?: string };
    if (!r.ok) return { ok: false, error: data.error ?? `gateway ${r.status}` };
    return { ok: true, exists: data.exists, ready: data.ready, qr: data.qr ?? null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "gateway error" };
  }
}

/** Putuskan (logout) sesi WA tenant. */
export async function gatewayLogoutSession(tenantId: string): Promise<{ ok: boolean; error?: string }> {
  const cfg = await resolve();
  if (!cfg) return { ok: false, error: "Gateway WA belum dikonfigurasi (admin panel)" };
  try {
    const r = await fetch(`${cfg.url}/v1/wa/sessions/${encodeURIComponent(tenantId)}`, {
      method: "DELETE", headers: { "X-Api-Key": cfg.key },
    });
    const data = (await r.json().catch(() => ({}))) as { error?: string };
    if (!r.ok) return { ok: false, error: data.error ?? `gateway ${r.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "gateway error" };
  }
}
