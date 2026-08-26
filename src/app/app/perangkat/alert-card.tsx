"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { alertToJob, dismissAlert } from "./alert-actions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import type { AlertType, AlertSeverity } from "@prisma/client";

const TYPE_LABEL: Record<AlertType, string> = {
  OVERCURRENT: "Arus Berlebih",
  NO_COOLING: "Kurang Dingin",
  OFFLINE: "Perangkat Terputus",
  SENSOR_FAULT: "Sensor Bermasalah",
};

const SEV_STYLE: Record<AlertSeverity, string> = {
  CRITICAL: "border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30",
  WARNING: "border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30",
  INFO: "border border-sky-200 bg-sky-50 dark:border-sky-900/50 dark:bg-sky-950/30",
};

export function AlertCard({
  id, type, severity, message, hasJob, jobId, at,
}: {
  id: string; type: AlertType; severity: AlertSeverity; message: string;
  hasJob: boolean; jobId: string | null; at: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function createJob() {
    setMsg(null);
    start(async () => {
      const res = await alertToJob(id);
      if (!res.ok) { setMsg(res.error); return; }
      if (res.jobId) router.push(`/app/pekerjaan/${res.jobId}`);
      else router.refresh();
    });
  }

  function dismiss() {
    start(async () => {
      await dismissAlert(id, "DISMISSED");
      router.refresh();
    });
  }

  return (
    <Card className={`ring-0 ${SEV_STYLE[severity]}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">{TYPE_LABEL[type]}</span>
              {severity === "CRITICAL" && (
                <Badge variant="destructive" className="bg-red-500 text-white dark:bg-red-500">Penting</Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-foreground/80">{message}</p>
            <p className="mt-1 text-xs text-muted-foreground">{new Date(at).toLocaleString("id-ID")}</p>
          </div>
        </div>

        {msg && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{msg}</p>}

        <div className="mt-3 flex gap-2">
          {hasJob && jobId ? (
            <Link href={`/app/pekerjaan/${jobId}`}
              className={buttonVariants({ variant: "secondary", className: "min-h-[44px] flex-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400" })}>
              Pekerjaan sudah dibuat →
            </Link>
          ) : (
            <SubmitButton type="button" onClick={createJob} pending={pending} pendingLabel="Memproses…" className="min-h-[44px] flex-1">
              Buat Pekerjaan
            </SubmitButton>
          )}
          <Button type="button" variant="outline" onClick={dismiss} disabled={pending} className="min-h-[44px]">
            Abaikan
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
