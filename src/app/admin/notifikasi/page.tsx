import { listTenants } from "@/lib/services/platform-service";
import {
  getPlatformNotifSummary, listPlatformNotifs, platformTemplateOptions,
  getPlatformNotifHealth, type PlatformNotifHealth,
} from "@/lib/services/platform-notification-admin";
import { listActiveTemplates, listTemplateRevisions } from "@/lib/services/platform-template-service";
import { isNotifySendEnabled, isWaSendEnabled } from "@/lib/services/infra-config-service";
import { PLATFORM_TEMPLATES, knownVariables, PARTNER_TEMPLATE_KEYS, type PlatformTemplateKey } from "@/lib/domain/platform-templates";
import { NotifPanel } from "./notif-panel";
import { LumiteWaConnect } from "./lumite-wa-connect";
import { TemplateEditor, type TemplateView, type RevisionView } from "./template-editor";

export const dynamic = "force-dynamic";

const EVENT_ONLY = new Set<string>(["subscription_activated", "payment_failed", "payment_expired", "booking_inapp"]);

export default async function AdminNotifikasiPage() {
  const [summary, rows, tenants, active, health, sendEnabled, waSendEnabled, revisionLists] = await Promise.all([
    getPlatformNotifSummary(),
    listPlatformNotifs(50),
    listTenants({ limit: 50 }),
    listActiveTemplates(),
    getPlatformNotifHealth(),
    isNotifySendEnabled(),
    isWaSendEnabled(),
    Promise.all(
      (Object.keys(PLATFORM_TEMPLATES) as PlatformTemplateKey[]).map((k) => listTemplateRevisions(k, 5)),
    ),
  ]);
  const templates = platformTemplateOptions();
  const revisionsByKey = new Map<string, RevisionView[]>();
  (Object.keys(PLATFORM_TEMPLATES) as PlatformTemplateKey[]).forEach((k, i) => {
    revisionsByKey.set(k, (revisionLists[i] ?? []).map((r) => ({
      version: r.version, actor: r.actor, createdAt: r.createdAt.toISOString(),
    })));
  });
  const views: TemplateView[] = active.map((a) => {
    const key = a.key as PlatformTemplateKey;
    const def = PLATFORM_TEMPLATES[key];
    return {
      key,
      label: def.label,
      subject: a.subject,
      body: a.body,
      hasSubject: def.subject !== "",
      requiredVars: [...def.requiredVars],
      knownVars: knownVariables(key),
      version: a.version,
      isDefault: a.isDefault,
      eventOnly: EVENT_ONLY.has(key),
      revisions: revisionsByKey.get(key) ?? [],
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Notifikasi Platform</h1>
        <p className="text-sm text-muted-foreground">
          Pesan platform Aircon ke tenant: sambutan sesuai paket, tagihan langganan, dan koneksi WhatsApp yang terputus.
          Terkirim via WhatsApp (nomor platform) &amp; email. Status delivery mengikuti bukti callback yang tersedia.
        </p>
      </div>
      <LumiteWaConnect />
      <TemplateEditor templates={views} />
      <NotifPanel
        summary={summary}
        rows={rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), sentAt: r.sentAt?.toISOString() ?? null }))}
        tenants={tenants.items.map((t) => ({ id: t.id, name: t.name }))}
        templates={templates}
        health={health}
        sendEnabled={sendEnabled}
        waSendEnabled={waSendEnabled}
      />
    </div>
  );
}
