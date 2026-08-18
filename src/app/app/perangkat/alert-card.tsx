"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { alertToJob, dismissAlert } from "./alert-actions";
import type { AlertType, AlertSeverity } from "@prisma/client";

const TYPE_LABEL: Record<AlertType, string> = {
  OVERCURRENT: "Arus Berlebih",
  NO_COOLING: "Kurang Dingin",
  OFFLINE: "Perangkat Terputus",
  SENSOR_FAULT: "Sensor Bermasalah",
};

const SEV_STYLE: Record<AlertSeverity, string> = {
  CRITICAL: "border-red-200 bg-red-50",
  WARNING: "border-amber-200 bg-amber-50",
  INFO: "border-sky-200 bg-sky-50",
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
    <div className={`rounded-2xl border p-4 ${SEV_STYLE[severity]}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-900">{TYPE_LABEL[type]}</span>
            {severity === "CRITICAL" && (
              <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-medium text-white">Penting</span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-700">{message}</p>
          <p className="mt-1 text-xs text-slate-400">{new Date(at).toLocaleString("id-ID")}</p>
        </div>
      </div>

      {msg && <p className="mt-2 text-sm text-red-600">{msg}</p>}

      <div className="mt-3 flex gap-2">
        {hasJob && jobId ? (
          <Link href={`/app/pekerjaan/${jobId}`}
            className="min-h-[44px] flex-1 rounded-xl bg-emerald-100 px-4 py-2 text-center text-sm font-medium text-emerald-700">
            Pekerjaan sudah dibuat →
          </Link>
        ) : (
          <button onClick={createJob} disabled={pending}
            className="min-h-[44px] flex-1 rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600 disabled:opacity-50">
            {pending ? "Memproses…" : "Buat Pekerjaan"}
          </button>
        )}
        <button onClick={dismiss} disabled={pending}
          className="min-h-[44px] rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50">
          Abaikan
        </button>
      </div>
    </div>
  );
}
