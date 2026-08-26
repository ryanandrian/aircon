"use client";

import { useState, useTransition } from "react";
import { actionSendReminder, actionCreateRepeatJob, actionCompleteJob } from "./actions";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export function ReminderActions({ reminderId }: { reminderId: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <Button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await actionSendReminder(reminderId);
              setMsg(r.error ? `Gagal: ${r.error}` : "WA diantre ke worker");
            })
          }
          className="bg-green-500 text-white hover:bg-green-600"
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          Kirim WA
        </Button>
        <Button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await actionCreateRepeatJob(reminderId);
              setMsg(r.error ? `Gagal: ${r.error}` : "Job ulang dibuat (DRAFT)");
            })
          }
          className="bg-sky-500 text-white hover:bg-sky-600"
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          Buat Job Ulang
        </Button>
      </div>
      {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
    </div>
  );
}

export function CompleteJobButton({ jobId }: { jobId: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-end">
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await actionCompleteJob(jobId);
            setMsg(r.error ? `Gagal: ${r.error}` : "Selesai → pengingat dibuat");
          })
        }
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        Selesaikan
      </Button>
      {msg && <span className="mt-1 text-xs text-muted-foreground">{msg}</span>}
    </div>
  );
}
