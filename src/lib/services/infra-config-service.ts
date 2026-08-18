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
