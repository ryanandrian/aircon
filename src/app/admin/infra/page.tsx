import { getInfraConfig } from "@/lib/services/infra-config-service";
import { InfraEditor } from "./infra-editor";

export const dynamic = "force-dynamic";

export default async function AdminInfraPage() {
  const c = await getInfraConfig();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">Konfigurasi Infra (WhatsApp & MQTT)</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Semua pengaturan gateway WhatsApp (anti-ban) & broker MQTT — dapat diubah kapan saja tanpa developer.
          Perubahan policy berlaku di gateway otomatis (di-pull berkala). Rahasia disimpan terenkripsi.
        </p>
      </div>
      <InfraEditor
        initial={{
          waGatewayUrl: c.waGatewayUrl,
          hasKey: Boolean(c.waGatewayKeyEnc),
          hasCallbackSecret: Boolean(c.waCallbackSecretEnc),
          waMinGapMs: c.waMinGapMs, waMaxGapMs: c.waMaxGapMs, waMaxPerMin: c.waMaxPerMin, waMaxPerDay: c.waMaxPerDay,
          waWarmupEnabled: c.waWarmupEnabled, waWarmupDays: c.waWarmupDays, waWarmupDay1Cap: c.waWarmupDay1Cap,
          waQuietStartHour: c.waQuietStartHour, waQuietEndHour: c.waQuietEndHour, waTzOffset: c.waTzOffset,
          waMaxLiveSessions: c.waMaxLiveSessions, waIdleEvictMs: c.waIdleEvictMs,
          mqttBrokerHost: c.mqttBrokerHost, mqttBrokerPort: c.mqttBrokerPort,
          mqttTlsEnabled: c.mqttTlsEnabled, mqttTopicPrefix: c.mqttTopicPrefix,
          iotOvercurrentA: c.iotOvercurrentA, iotNoCoolTempC: c.iotNoCoolTempC, iotOfflineMinutes: c.iotOfflineMinutes,
          updatedAt: c.updatedAt.toISOString(),
        }}
      />
    </div>
  );
}
