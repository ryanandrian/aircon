"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  actionSendPlatformNotif, actionRunPlatformNotifyNow, actionDispatchPlatformNow,
  actionReplayPlatformNotification, actionSetNotifySendEnabled, actionSetWaSendEnabled,
  actionReconcileNotifications,
} from "./actions";

type Summary = { queued: number; sent: number; failed: number; sending: number; unknown: number; suppressed: number };
type Health = {
  accepted: number; delivered: number; read: number; unknown: number; failed: number;
  queued: number; sending: number; suppressed: number;
  queuedTooOld: number; sendingWithoutLease: number;
  needsAttention: boolean;
};
type Row = {
  id: string; tenantName: string | null; channel: string; templateKey: string;
  toAddress: string; status: string; error: string | null;
  /** Alasan ditahan (G28) — bila status SUPPRESSED. */
  suppressedReason: string | null;
  createdAt: string; sentAt: string | null;
};
type Tenant = { id: string; name: string };
type Template = { key: string; label: string; manualAllowed: boolean };

/** Label manusiawi untuk status (SUPPRESSED lebih jelas daripada istilah teknis). */
function statusLabel(status: string): string | null {
  if (status === "SUPPRESSED") return "Ditahan (penerima kosong)";
  if (status === "DELIVERED") return "Sampai";
  if (status === "READ_CONFIRMED" || status === "READ_UNOBSERVED") return "Dibaca";
  if (status === "SENT") return "Dikirim";
  if (status === "QUEUED") return "Antre";
  if (status === "SENDING") return "Proses";
  if (status === "FAILED") return "Gagal";
  if (status === "UNKNOWN") return "Tak Pasti";
  return null;
}

const statusColor: Record<string, string> = {
  SENT: "bg-emerald-600 hover:bg-emerald-600",
  QUEUED: "bg-amber-500 hover:bg-amber-500",
  SENDING: "bg-sky-500 hover:bg-sky-500",
  FAILED: "bg-destructive hover:bg-destructive",
  // Hasil kirim tidak dapat dipastikan (lease kedaluwarsa) — TIDAK dikirim ulang.
  UNKNOWN: "bg-purple-600 hover:bg-purple-600",
  // Ditahan karena penerima kosong (G28) — bukan gagal; perbaiki data kontak.
  SUPPRESSED: "bg-zinc-500 hover:bg-zinc-500",
  DELIVERED: "bg-teal-600 hover:bg-teal-600",
  READ_CONFIRMED: "bg-teal-700 hover:bg-teal-700",
  READ_UNOBSERVED: "bg-teal-700 hover:bg-teal-700",
};

export function NotifPanel({ summary, rows, tenants, templates, health, sendEnabled, waSendEnabled }: {
  summary: Summary; rows: Row[]; tenants: Tenant[]; templates: Template[]; health: Health;
  sendEnabled: boolean; waSendEnabled: boolean;
}) {
  const [tenantId, setTenantId] = useState(tenants[0]?.id ?? "");
  const [templateKey, setTemplateKey] = useState(templates[0]?.key ?? "");
  const [channel, setChannel] = useState<"WA" | "EMAIL">("WA");
  const [pending, start] = useTransition();
  const [reconcile, setReconcile] = useState<{
    findings: { kind: string; tenantName: string; detail: string }[];
    checks: string[];
    stats: {
      messageLog: { queued: number; sending: number; sent: number; delivered: number; read: number; unknown: number; suppressed: number; failed7d: number };
      platformNotification: { queuedOld: number; sent: number; delivered: number; read: number; unknown: number; suppressed: number };
    };
    ok: boolean;
  } | null>(null);
  const selectedTemplate = templates.find((t) => t.key === templateKey);
  const canSendManually = selectedTemplate?.manualAllowed === true;

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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
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

      {/* Tier bukti & tanda perlu perhatian (F3) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {([
          ["Diterima gateway", health.accepted],
          ["Sampai", health.delivered],
          ["Dibaca", health.read],
          ["Tak Pasti", health.unknown],
          ["Gagal", health.failed],
          ["DItahan", health.suppressed],
        ] as const).map(([label, n]) => (
          <Card key={label}>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-foreground">{n}</div>
              <div className="text-xs text-muted-foreground">{label}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      {health.needsAttention && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          <p className="font-semibold">Perlu tindakan operator</p>
          <ul className="mt-1 list-disc pl-5">
            {health.unknown > 0 && <li>{health.unknown} pesan berstatus &quot;tak pasti&quot; (hasil kirim tak dapat dipastikan) — tinjau, lalu Kirim Ulang bila perlu.</li>}
            {health.failed > 0 && <li>{health.failed} pesan gagal terkirim.</li>}
            {health.suppressed > 0 && <li>{health.suppressed} pesan ditahan karena penerima kosong — lengkapi nomor WhatsApp atau email owner, lalu pesan bisa dikirim ulang.</li>}
            {health.queuedTooOld > 0 && <li>{health.queuedTooOld} pesan antre terlalu lama (lebih dari 1 jam) — kanal pengiriman mungkin belum siap.</li>}
            {health.sendingWithoutLease > 0 && <li>{health.sendingWithoutLease} pesan berstatus proses tanpa lease — hasil kirim tak pasti, perlu ditinjau.</li>}
          </ul>
        </div>
      )}

      {/* Kill switch (G30) — dua jalur terpisah, masing-masing punya sakelarnya */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="flex h-full flex-col justify-between gap-3 p-5">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold">Platform ke Owner</h2>
              <p className="text-sm text-muted-foreground">
                Menahan pesan Aircon ke owner tenant (tagihan, WA, email). Antrean
                tetap menunggu, tak ada yang hilang. Jalur tenant ke pelanggan
                tidak terpengaruh.
              </p>
            </div>
            <Button
              size="sm"
              variant={sendEnabled ? "destructive" : "default"}
              disabled={pending}
              onClick={() => run(() => actionSetNotifySendEnabled(!sendEnabled))}
            >
              {sendEnabled ? "Tahan Pengiriman" : "Aktifkan Pengiriman"}
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex h-full flex-col justify-between gap-3 p-5">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold">Tenant ke Pelanggan (WA)</h2>
              <p className="text-sm text-muted-foreground">
                Menahan seluruh pesan WhatsApp dari sesi tenant ke pelanggan
                (pengingat, tagihan, undangan teknisi). Antrean tetap menunggu,
                tak ada yang hilang. Pesan platform ke owner tidak terpengaruh.
              </p>
            </div>
            <Button
              size="sm"
              variant={waSendEnabled ? "destructive" : "default"}
              disabled={pending}
              onClick={() => run(() => actionSetWaSendEnabled(!waSendEnabled))}
            >
              {waSendEnabled ? "Tahan Pengiriman" : "Aktifkan Pengiriman"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Rekonsiliasi antrean (G29) — read-only: cari pesan yang hilang/tak sengaja */}
      <Card>
        <CardContent className="space-y-3 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">Rekonsiliasi Antrean</h2>
              <p className="text-sm text-muted-foreground">
                Pemeriksaan baca-saja: pesan tertahan, hasil kirim tak pasti, antrean
                menua, tenant menunggak tanpa pengingat, dan sesi WA tanpa nomor owner.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await actionReconcileNotifications();
                  if (!r.ok) { toast.error(r.error ?? "Gagal"); return; }
                  setReconcile({
                    findings: r.report?.findings ?? [],
                    checks: r.report?.checks ?? [],
                    stats: r.report?.stats ?? {
                      messageLog: { queued: 0, sending: 0, sent: 0, delivered: 0, read: 0, unknown: 0, suppressed: 0, failed7d: 0 },
                      platformNotification: { queuedOld: 0, sent: 0, delivered: 0, read: 0, unknown: 0, suppressed: 0 },
                    },
                    ok: r.report?.ok ?? true,
                  });
                  toast.success(r.info ?? "Rekonsiliasi selesai");
                })
              }
            >
              Jalankan Rekonsiliasi
            </Button>
          </div>
          {reconcile && (
            <div className="space-y-2">
              {reconcile.ok ? (
                <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
                  Tidak ada temuan — semua antrean sehat.
                </p>
              ) : (
                <ul className="space-y-2">
                  {reconcile.findings.map((f, i) => (
                    <li key={`${f.kind}-${i}`} className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
                      <span className="font-semibold">{f.tenantName}</span> — {f.detail}
                      <span className="ml-1 text-xs opacity-70">({f.kind})</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border p-3 text-xs">
                  <p className="mb-1 font-semibold">Aircon → tenant/penerima platform</p>
                  <p>Dikirim: {reconcile.stats.platformNotification.sent} · Sampai: {reconcile.stats.platformNotification.delivered} · Dibaca: {reconcile.stats.platformNotification.read} · Tak pasti: {reconcile.stats.platformNotification.unknown} · Ditahan: {reconcile.stats.platformNotification.suppressed} · Antre &gt;1j: {reconcile.stats.platformNotification.queuedOld}</p>
                </div>
                <div className="rounded-xl border p-3 text-xs">
                  <p className="mb-1 font-semibold">Tenant → pelanggan (WA)</p>
                  <p>Dikirim: {reconcile.stats.messageLog.sent} · Sampai: {reconcile.stats.messageLog.delivered} · Dibaca: {reconcile.stats.messageLog.read} · Tak pasti: {reconcile.stats.messageLog.unknown} · Ditahan: {reconcile.stats.messageLog.suppressed} · Antre: {reconcile.stats.messageLog.queued} · Proses: {reconcile.stats.messageLog.sending} · Gagal 7 hari: {reconcile.stats.messageLog.failed7d}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Pemeriksaan: {reconcile.checks.join(", ")}. Dikirim (SENT) berarti provider menerima permintaan; bukan bukti sampai/dibaca.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

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
            <Button size="sm" disabled={pending || !tenantId || !canSendManually}
              onClick={() => run(() => actionSendPlatformNotif(tenantId, templateKey as never, channel))}>
              Kirim ke Tenant Ini
            </Button>
            {!canSendManually && selectedTemplate && <p className="self-center text-xs text-muted-foreground">Template ini tidak bisa dikirim manual: isinya mengikat event transaksi, atau dikirim ke inbox in-app.</p>}
            <Button size="sm" variant="outline" disabled={pending}
              onClick={() => run(() => actionRunPlatformNotifyNow())}>
              Jalankan Siklus Event Sekarang
            </Button>
            <Button size="sm" variant="ghost" disabled={pending}
              onClick={() => run(() => actionDispatchPlatformNow())}>
              Kirim Semua Antrean Tertahan
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            &quot;Siklus Event&quot; memeriksa pengingat tagihan tenant berbayar yang mendekati atau melewati jatuh tempo. Paket Basic gratis selamanya, tidak memiliki masa trial atau tagihan langganan.
            Status Terkirim, Diterima, dan Dibaca dibedakan berdasarkan bukti callback yang tersedia.
            Status &quot;Tak Pasti&quot; berarti pengiriman terputus (lease habis) sehingga hasilnya tidak dapat dipastikan — pesan tidak
            dikirim ulang otomatis; tinjau dan putuskan replay sendiri untuk menghindari pesan ganda.
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
                  <Badge className={`shrink-0 ${statusColor[r.status] ?? ""}`}>
                    {statusLabel(r.status) ?? r.status}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium text-foreground">{r.tenantName}</span>
                      <Badge variant="secondary" className="shrink-0">{r.channel}</Badge>
                      <span className="truncate text-xs text-muted-foreground">{r.templateKey}</span>
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {r.toAddress || "(kosong)"} · {fmt(r.createdAt)}{r.suppressedReason ? ` · ${r.suppressedReason}` : r.error ? ` · ${r.error}` : ""}
                    </div>
                  </div>
                  {(r.status === "UNKNOWN" || r.status === "FAILED") && (
                    <Button
                      size="xs"
                      variant="outline"
                      disabled={pending}
                      onClick={() => {
                        if (r.status === "UNKNOWN") {
                          const confirmed = window.confirm(
                            "Hasil pengiriman ini tidak diketahui. Periksa bukti dari gateway/penerima terlebih dahulu. Replay dapat menyebabkan pesan duplikat. Lanjutkan hanya bila Anda telah memverifikasi pesan belum diterima."
                          );
                          if (!confirmed) return;
                        }
                        run(() => actionReplayPlatformNotification(r.id, r.status === "UNKNOWN"));
                      }}
                    >
                      Kirim Ulang
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
