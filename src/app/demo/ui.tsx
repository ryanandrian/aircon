"use client";

import { useState, useTransition } from "react";
import { actionSendReminder, actionCreateRepeatJob, actionCompleteJob } from "./actions";

export function ReminderActions({ reminderId }: { reminderId: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await actionSendReminder(reminderId);
              setMsg(r.error ? `Gagal: ${r.error}` : "✓ WA diantre ke worker");
            })
          }
          className="rounded-lg bg-green-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-600 disabled:opacity-50"
        >
          Kirim WA
        </button>
        <button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await actionCreateRepeatJob(reminderId);
              setMsg(r.error ? `Gagal: ${r.error}` : "✓ Job ulang dibuat (DRAFT)");
            })
          }
          className="rounded-lg bg-sky-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-600 disabled:opacity-50"
        >
          Buat Job Ulang
        </button>
      </div>
      {msg && <span className="text-xs text-slate-500">{msg}</span>}
    </div>
  );
}

export function CompleteJobButton({ jobId }: { jobId: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-end">
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await actionCompleteJob(jobId);
            setMsg(r.error ? `Gagal: ${r.error}` : "✓ Selesai → pengingat dibuat");
          })
        }
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        Selesaikan
      </button>
      {msg && <span className="mt-1 text-xs text-slate-500">{msg}</span>}
    </div>
  );
}
