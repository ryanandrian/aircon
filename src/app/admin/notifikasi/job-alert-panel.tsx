"use client";

"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { actionSelfTestJobAlert } from "./actions";

/**
 * Panel jejak alert job (F3).
 *
 * Read-only. Menampilkan baris `JOB_FAILURE_ALERT` / `STALE_NOTIFICATION_QUEUE_ALERT`
 * dari `PlatformAuditLog` supaya operator melihat alert cron gagal di panel yang
 * dia pakai setiap hari — sebelumnya jejak itu hanya bisa dibaca lewat psql,
 * padahal komentar service & Runbook mengklaim sudah terlihat di Admin.
 *
 * Kolom "Email" membedakan dua keadaan yang berbeda: jejak alert sudah ada
 * (kegagalan tercatat) vs email alert benar-benar diterima SMTP. Jejak ada
 * tapi email belum sampai = operator wajib tahu dan menunggu percobaan ulang.
 */

export type AlertRow = {
  id: string;
  action: string;
  target: string;
  job: string | null;
  stage: string | null;
  error: string | null;
  emailDelivered: boolean;
  createdAt: string;
};

const ACTION_LABEL: Record<string, string> = {
  JOB_FAILURE_ALERT: "Job gagal",
  STALE_NOTIFICATION_QUEUE_ALERT: "Antrean stale",
};

function fmt(s: string): string {
  return new Date(s).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" });
}

export function JobAlertPanel({ rows }: { rows: AlertRow[] }) {
  const [pending, start] = useTransition();
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Jejak Alert Cron</h2>
            <p className="text-sm text-muted-foreground">
              Catatan kegagalan cron &amp; antrean menua (baca-saja). Alert email hanya
              dikirim satu kali per job per hari; bila email belum sampai, percobaan
              berikutnya mengirim ulang.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await actionSelfTestJobAlert();
                if (r.ok) toast.success(r.info ?? "Self-test terkirim");
                else toast.error(r.error ?? "Gagal");
              })
            }
          >
            Uji Alert Email
          </Button>
        </div>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada alert kegagalan tercatat.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li
                key={r.id}
                className="rounded-lg border border-border p-3 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="destructive">{ACTION_LABEL[r.action] ?? r.action}</Badge>
                  <span className="font-medium">
                    {r.job ?? r.target}
                    {r.stage ? ` · ${r.stage}` : ""}
                  </span>
                  <span className="text-xs text-muted-foreground">{fmt(r.createdAt)}</span>
                  <span className="ml-auto text-xs">
                    {r.emailDelivered ? (
                      <span className="text-emerald-700 dark:text-emerald-400">Email terkirim</span>
                    ) : (
                      <span className="text-amber-700 dark:text-amber-400">
                        Jejak tersimpan — email belum terkonfirmasi
                      </span>
                    )}
                  </span>
                </div>
                {r.error ? (
                  <p className="mt-1 break-words text-xs text-muted-foreground">{r.error}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
