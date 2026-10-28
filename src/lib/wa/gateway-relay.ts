/**
 * Relay ke shared Messaging Gateway (VPS-INFRA). Konfigurasi DB-FIRST (InfraConfig,
 * editable admin), fallback ENV. App kirim WA lewat gateway bersama.
 * externalId = tenantId (1 sesi WA per tenant).
 */
import "server-only";
import { getInfraConfig, getInfraSecrets, isWaSendEnabled } from "@/lib/services/infra-config-service";
import { blockedSendReason } from "@/lib/wa/gateway";

/**
 * externalId sesi platform (Aircon -> owner). Semua externalId lain = sesi
 * tenant (tenant -> pelanggan). Dipakai untuk memisahkan dua kill switch.
 */
export const PLATFORM_WA_SESSION = "lumite-platform";

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

/** Kirim pesan WA via gateway. externalId = tenantId (jalur tenant → pelanggan, TAK BERUBAH). */
export async function gatewaySend(tenantId: string, toPhone: string, message: string, opts: { idempotencyKey?: string | null } = {}): Promise<GatewaySendResult> {
  return gatewaySendAs(tenantId, toPhone, message, opts);
}

/**
 * Kirim WA dengan externalId eksplisit (sesi mana). Dipakai gatewaySend (tenant) DAN
 * jalur platform (externalId="lumite-platform"). Guard anti-spam berlaku untuk SEMUA.
 */
export type GatewaySendResult = {
  ok: boolean;
  messageId?: string;
  error?: string;
  /**
   * true bila gateway menolak sebagai DUPLIKAT (HTTP 409). Artinya pesan identik
   * sudah pernah dikirim — BUKAN kegagalan. Pemanggil wajib menanganinya
   * terpisah dari `ok:false` biasa (lihat platform-notification-dispatch).
   * Dibawa bersama `messageId` = job yang sudah mengirimkannya.
   */
  duplicate?: boolean;
  /** true = retryable transport/capacity condition; caller must keep queued */
  deferred?: boolean;
};

export async function gatewaySendAs(
  externalId: string,
  toPhone: string,
  message: string,
  opts: { idempotencyKey?: string | null } = {},
): Promise<GatewaySendResult> {
  const cfg = await resolve();
  if (!cfg) return { ok: false, error: "Gateway WA belum dikonfigurasi (admin panel)" };

  // KILL SWITCH WA TENANT -> PELANGGAN (G30): saat dimatikan, SEMUA WA dari
  // sesi tenant ditahan. Antrean (MessageLog) tak berubah — pemanggil melihat
  // `deferred` sehingga pesan tetap waiting dan dikirim saat switch dinyalakan.
  // Sesi platform (Aircon -> owner) TIDAK kena switch ini; ia punya switch
  // sendiri (`notifySendEnabled`).
  if (externalId !== PLATFORM_WA_SESSION && !(await isWaSendEnabled())) {
    console.warn(`[gateway-relay] KILL SWITCH WA tenant aktif: kirim ke ${toPhone} (sesi ${externalId}) ditahan`);
    return { ok: false, deferred: true, error: "KILL SWITCH WA tenant aktif: pengiriman ditahan" };
  }

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
      // KUNCI IDEMPOTENSI DIMILIKI PEMANGGIL, bukan ditebak dari isi pesan.
      //
      // Tanpa ini gateway menurunkan kuncinya sendiri
      // (gateway-engine delivery-contract.js:54):
      //   legacy:<externalId>:<toPhone>:<message>
      // sehingga DUA notifikasi berbeda yang kebetulan berteks sama dianggap
      // duplikat — yang kedua ditekan (409) dan penerimanya TIDAK PERNAH
      // menerimanya. Dengan mengirim `dedupeKey` milik row, idempotensi jadi
      // per-EVENT (semantik yang benar), bukan per-teks.
      body: JSON.stringify({
        externalId, toPhone, message,
        ...(opts.idempotencyKey ? { idempotencyKey: opts.idempotencyKey } : {}),
      }),
    });
    const data = (await r.json().catch(() => ({}))) as {
      messageId?: string; error?: string; duplicate?: boolean;
    };
    if (!r.ok) {
      // 409 dedup: kontrak gateway menyertakan `duplicate:true` + `messageId`
      // (job yang SUDAH mengirim). Meneruskan keduanya adalah syarat supaya
      // dispatcher bisa membedakan "sudah terkirim" dari "benar-benar gagal".
      if (data.duplicate) {
        return { ok: false, duplicate: true, messageId: data.messageId, error: data.error ?? `gateway ${r.status}` };
      }
      const error = data.error ?? `gateway ${r.status}`;
      // Retryable / kapasitas sementara bukan kegagalan kirim permanen:
      // jaga MessageLog tetap antre agar dikirim lagi ketika slot/sesi pulih.
      // Format error berasal dari _initSession (SESSION_CAPACITY) dan
      // memoryProbe/backpressure (tekanan memori); jangan menelan error
      // permanen seperti kredensial/nomor invalid.
      if (/batas sesi aktif tercapai|tekanan memori|sesi dikarantina sampai/i.test(error)) {
        return { ok: false, deferred: true, error };
      }
      return { ok: false, error };
    }
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

/** Minta kode pairing WhatsApp untuk tenant yang hanya memiliki satu HP. */
export async function gatewayPairSession(tenantId: string, phone: string): Promise<{ ok: boolean; pairingCode?: string | null; pairing?: boolean; ready?: boolean; phone?: string | null; error?: string }> {
  const cfg = await resolve();
  if (!cfg) return { ok: false, error: "Gateway WA belum dikonfigurasi (admin panel)" };
  try {
    const r = await fetch(`${cfg.url}/v1/wa/sessions/${encodeURIComponent(tenantId)}/pair`, {
      method: "POST", headers: { "Content-Type": "application/json", "X-Api-Key": cfg.key },
      body: JSON.stringify({ phone }),
    });
    const data = (await r.json().catch(() => ({}))) as { pairingCode?: string | null; pairing?: boolean; ready?: boolean; phone?: string | null; error?: string };
    if (!r.ok) return { ok: false, error: data.error ?? `gateway ${r.status}` };
    return { ok: true, pairingCode: data.pairingCode ?? null, pairing: data.pairing, ready: data.ready, phone: data.phone ?? null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "gateway error" };
  }
}

export async function gatewayCancelPairSession(tenantId: string): Promise<{ ok: boolean; error?: string }> {
  const cfg = await resolve();
  if (!cfg) return { ok: false, error: "Gateway WA belum dikonfigurasi (admin panel)" };
  try {
    const r = await fetch(`${cfg.url}/v1/wa/sessions/${encodeURIComponent(tenantId)}/pair/cancel`, {
      method: "POST", headers: { "X-Api-Key": cfg.key },
    });
    const data = (await r.json().catch(() => ({}))) as { error?: string };
    if (!r.ok) return { ok: false, error: data.error ?? `gateway ${r.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "gateway error" };
  }
}

/** Status sesi WA tenant (untuk polling di UI tautkan): {exists, ready, qr, phone, authenticating, pairing}. */
export async function gatewaySessionStatus(tenantId: string): Promise<{ ok: boolean; exists?: boolean; ready?: boolean; qr?: string | null; phone?: string | null; authenticating?: boolean; pairing?: boolean; pairingCode?: string | null; pairingPhone?: string | null; error?: string }> {
  const cfg = await resolve();
  if (!cfg) return { ok: false, error: "Gateway WA belum dikonfigurasi (admin panel)" };
  try {
    const r = await fetch(`${cfg.url}/v1/wa/sessions/${encodeURIComponent(tenantId)}`, {
      method: "GET", headers: { "X-Api-Key": cfg.key }, cache: "no-store",
    });
    const data = (await r.json().catch(() => ({}))) as { exists?: boolean; ready?: boolean; qr?: string | null; phone?: string | null; authenticating?: boolean; pairing?: boolean; pairingCode?: string | null; pairingPhone?: string | null; error?: string };
    if (!r.ok) return { ok: false, error: data.error ?? `gateway ${r.status}` };
    return { ok: true, exists: data.exists, ready: data.ready, qr: data.qr ?? null, phone: data.phone ?? null, authenticating: data.authenticating ?? false, pairing: data.pairing ?? false, pairingCode: data.pairingCode ?? null, pairingPhone: data.pairingPhone ?? null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "gateway error" };
  }
}

export async function getPlatformWaPhone(): Promise<string | null> {
  const status = await gatewaySessionStatus("lumite-platform");
  const phone = status.ok ? status.phone?.replace(/\D/g, "") : "";
  return phone || null;
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
