"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  actionSendPlatformNotif, actionRunPlatformNotifyNow, actionDispatchPlatformNow,
} from "./actions";

type Summary = { queued: number; sent: number; failed: number; sending: number };
type Row = {
  id: string; tenantName: string; channel: string; templateKey: string;
  toAddress: string; status: string; error: string | null;
  createdAt: string; sentAt: string | null;
};
type Tenant = { id: string; name: string };
type Template = { key: string; label: string };

const statusColor: Record<string, string> = {
  SENT: "bg-emerald-600 hover:bg-emerald-600",
  QUEUED: "bg-amber-500 hover:bg-amber-500",
  SENDING: "bg-sky-500 hover:bg-sky-500",
  FAILED: "bg-destructive hover:bg-destructive",
};

export function NotifPanel({ summary, rows, tenants, templates }: {
  summary: Summary; rows: Row[]; tenants: Tenant[]; templates: Template[];
}) {
  const [tenantId, setTenantId] = useState(tenants[0]?.id ?? "");
  const [templateKey, setTemplateKey] = useState(templates[0]?.key ?? "");
  const [channel, setChannel] = useState<"WA" | "EMAIL">("WA");
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string; info?: string }>) =>
    start(async () => {
      const r = await fn();
      if (r.ok) toast.success(r.info ?? "Berhasil");
      else toast.error(r.error ?? "Gagal");
    });

  const fmt = (s: string | null) => s ? new Date(s).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" }) : "—";

  return (
    <div className="space-y-6">
      {/* Ringkasan status */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([["Antre", summary.queued], ["Terkirim", summary.sent], ["Proses", summary.sending], ["Gagal", summary.failed]] as const).map(
          ([label, n]) => (
            <Card key={label}>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-foreground">{n}</div>
                <div className="text-xs text-muted-foreground">{label}</div>
              </CardContent>
            </Card>
          ),
        )}
      </div>

      {/* Aksi cepat */}
      <Card>
        <CardContent className="space-y-4 p-5">
          <h2 className="text-lg font-semibold">Kirim Manual / Jalankan Sekarang</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-1.5">
              <span className="text-sm font-medium">Tenant</span>
              <select value={tenantId} onChange={(e) => setTenantId(e.target.value)}
                className="w-full rounded-lg border bg-card px-3 py-2 text-sm">
                {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">Template</span>
              <select value={templateKey} onChange={(e) => setTemplateKey(e.target.value)}
                className="w-full rounded-lg border bg-card px-3 py-2 text-sm">
                {templates.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">Saluran</span>
              <select value={channel} onChange={(e) => setChannel(e.target.value as "WA" | "EMAIL")}
                className="w-full rounded-lg border bg-card px-3 py-2 text-sm">
                <option value="WA">WhatsApp</option>
                <option value="EMAIL">Email</option>
              </select>
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={pending || !tenantId}
              onClick={() => run(() => actionSendPlatformNotif(tenantId, templateKey as never, channel))}>
              Kirim ke Tenant Ini
            </Button>
            <Button size="sm" variant="outline" disabled={pending}
              onClick={() => run(() => actionRunPlatformNotifyNow())}>
              Jalankan Siklus Event Sekarang
            </Button>
            <Button size="sm" variant="ghost" disabled={pending}
              onClick={() => run(() => actionDispatchPlatformNow())}>
              Kirim Antrean Tertahan
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            &quot;Siklus Event&quot; mendeteksi tenant jatuh tempo/trial habis lalu mengirim otomatis (sama seperti cron harian).
            Guard anti-spam aktif — nomor tak valid otomatis diblokir.
          </p>
        </CardContent>
      </Card>

      {/* Log */}
      <Card>
        <CardContent className="p-0">
          <div className="border-b px-5 py-3 text-sm font-semibold">Log Notifikasi (50 terbaru)</div>
          {rows.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Belum ada notifikasi platform.</div>
          ) : (
            <div className="divide-y">
              {rows.map((r) => (
                <div key={r.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                  <Badge className={`shrink-0 ${statusColor[r.status] ?? ""}`}>{r.status}</Badge>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium text-foreground">{r.tenantName}</span>
                      <Badge variant="secondary" className="shrink-0">{r.channel}</Badge>
                      <span className="truncate text-xs text-muted-foreground">{r.templateKey}</span>
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {r.toAddress} · {fmt(r.createdAt)}{r.error ? ` · ${r.error}` : ""}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
