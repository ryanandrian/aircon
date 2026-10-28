/**
 * Infra Config Service — konfigurasi WhatsApp Gateway + MQTT, EDITABLE ADMIN (no hardcode).
 * Singleton. Secret (gateway key, callback secret) TERENKRIPSI at-rest (vault AES-256-GCM).
 * Perubahan admin berlaku: koneksi WA (relay baca DB) + policy anti-ban (di-pull gateway).
 */
import { prisma } from "@/lib/prisma";
import { encryptSecret, decryptSecret } from "@/lib/partner/vault-crypto";
import type { InfraConfig } from "@prisma/client";

/** Ambil config (singleton, auto-create default). */
export async function getInfraConfig(): Promise<InfraConfig> {
  const existing = await prisma.infraConfig.findUnique({ where: { id: "singleton" } });
  if (existing) return existing;
  return prisma.infraConfig.create({ data: { id: "singleton" } });
}

/** Dekripsi gateway key + callback secret (server-only; jangan kirim ke klien). */
export async function getInfraSecrets(): Promise<{ gatewayKey: string | null; callbackSecret: string | null }> {
  const c = await getInfraConfig();
  const safe = (enc: string | null) => { try { return enc ? decryptSecret(enc) : null; } catch { return null; } };
  return { gatewayKey: safe(c.waGatewayKeyEnc), callbackSecret: safe(c.waCallbackSecretEnc) };
}

export interface InfraConfigInput {
  waGatewayUrl: string;
  waGatewayKey?: string;       // plaintext dari form → dienkripsi (kosong = jangan ubah)
  waCallbackSecret?: string;   // idem
  waMinGapMs: number; waMaxGapMs: number; waMaxPerMin: number; waMaxPerDay: number;
  waWarmupEnabled: boolean; waWarmupDays: number; waWarmupDay1Cap: number;
  waQuietStartHour: number; waQuietEndHour: number; waTzOffset: number;
  waMaxLiveSessions: number; waIdleEvictMs: number;
  mqttBrokerHost: string; mqttBrokerPort: number; mqttTlsEnabled: boolean; mqttTopicPrefix: string;
  iotOvercurrentA: number; iotNoCoolTempC: number; iotOfflineMinutes: number;
}

/** PLATFORM-ADMIN-ONLY. Perbarui config. Secret hanya ditimpa bila diisi. */
export async function updateInfraConfig(input: InfraConfigInput, adminEmail: string): Promise<InfraConfig> {
  const data: Record<string, unknown> = {
    waGatewayUrl: input.waGatewayUrl.trim(),
    waMinGapMs: input.waMinGapMs, waMaxGapMs: input.waMaxGapMs, waMaxPerMin: input.waMaxPerMin,
    waMaxPerDay: input.waMaxPerDay, waWarmupEnabled: input.waWarmupEnabled, waWarmupDays: input.waWarmupDays,
    waWarmupDay1Cap: input.waWarmupDay1Cap, waQuietStartHour: input.waQuietStartHour,
    waQuietEndHour: input.waQuietEndHour, waTzOffset: input.waTzOffset,
    waMaxLiveSessions: input.waMaxLiveSessions, waIdleEvictMs: input.waIdleEvictMs,
    mqttBrokerHost: input.mqttBrokerHost.trim(), mqttBrokerPort: input.mqttBrokerPort,
    mqttTlsEnabled: input.mqttTlsEnabled, mqttTopicPrefix: input.mqttTopicPrefix.trim(),
    iotOvercurrentA: input.iotOvercurrentA, iotNoCoolTempC: input.iotNoCoolTempC, iotOfflineMinutes: input.iotOfflineMinutes,
    updatedBy: adminEmail,
  };
  if (input.waGatewayKey && input.waGatewayKey.trim()) data.waGatewayKeyEnc = encryptSecret(input.waGatewayKey.trim());
  if (input.waCallbackSecret && input.waCallbackSecret.trim()) data.waCallbackSecretEnc = encryptSecret(input.waCallbackSecret.trim());
  return prisma.infraConfig.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...data } as never,
    update: data,
  });
}

/** View policy anti-ban untuk di-PULL gateway (tanpa secret). */
export async function getPolicyView() {
  const c = await getInfraConfig();
  return {
    minGapMs: c.waMinGapMs, maxGapMs: c.waMaxGapMs, maxPerMin: c.waMaxPerMin, maxPerDay: c.waMaxPerDay,
    warmupEnabled: c.waWarmupEnabled, warmupDays: c.waWarmupDays, warmupDay1Cap: c.waWarmupDay1Cap,
    quietStartHour: c.waQuietStartHour, quietEndHour: c.waQuietEndHour, quietTzOffset: c.waTzOffset,
    maxLiveSessions: c.waMaxLiveSessions, idleEvictMs: c.waIdleEvictMs,
    updatedAt: c.updatedAt,
  };
}

/**
 * KILL SWITCH (G30): true = boleh kirim; false = dispatcher platform MENAH.
 * Query ringan (singleton) — dibaca sekali per run dispatcher, bukan per pesan.
 */
export async function isNotifySendEnabled(): Promise<boolean> {
  try {
    const c = await prisma.infraConfig.findUnique({
      where: { id: "singleton" },
      select: { notifySendEnabled: true },
    });
    // Baris belum ada = default aman (kirim). Tak ada config = tak ada insiden.
    return c?.notifySendEnabled !== false;
  } catch (e) {
    // FAIL-OPEN dengan log: bila konfigurasi tak terbaca, notifikasi tagihan
    // tak boleh berhenti total. Kill switch yang AKTIF selalu terbaca (DB
    // sehat saat adminToggle), jadi risikonya kecil dan tercatat di log.
    console.error("[infra-config] gagal membaca notifySendEnabled, diasumsikan aktif:", e);
    return true;
  }
}

/** Set kill switch (PLATFORM-ADMIN-ONLY). Dicatat di audit log. */
export async function setNotifySendEnabled(enabled: boolean, adminEmail: string): Promise<void> {
  await prisma.infraConfig.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", notifySendEnabled: enabled, updatedBy: adminEmail },
    update: { notifySendEnabled: enabled, updatedBy: adminEmail },
  });
  await prisma.platformAuditLog.create({
    data: {
      actor: adminEmail,
      action: enabled ? "NOTIFY_SEND_ENABLE" : "NOTIFY_SEND_DISABLE",
      target: "infra-config:notifySendEnabled",
      metadata: { enabled },
    },
  });
}
