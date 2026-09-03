import { listTenants } from "@/lib/services/platform-service";
import {
  getPlatformNotifSummary, listPlatformNotifs, platformTemplateOptions,
} from "@/lib/services/platform-notification-admin";
import { NotifPanel } from "./notif-panel";

export const dynamic = "force-dynamic";

export default async function AdminNotifikasiPage() {
  const [summary, rows, tenants] = await Promise.all([
    getPlatformNotifSummary(),
    listPlatformNotifs(50),
    listTenants({ limit: 50 }),
  ]);
  const templates = platformTemplateOptions();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Notifikasi Platform</h1>
        <p className="text-sm text-muted-foreground">
          Pesan otomatis Lumite → tenant (tagihan langganan, masa coba, WhatsApp terputus, sambutan).
          Terkirim via WhatsApp (nomor Lumite) &amp; email. Idempoten — aman dari kirim ganda.
        </p>
      </div>
      <NotifPanel
        summary={summary}
        rows={rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), sentAt: r.sentAt?.toISOString() ?? null }))}
        tenants={tenants.items.map((t) => ({ id: t.id, name: t.name }))}
        templates={templates}
      />
    </div>
  );
}
