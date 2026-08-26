"use client";

import { useState, useTransition } from "react";
import { actionSaveTemplate, actionResetTemplate } from "./actions";
import { Icon } from "@/components/icons";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";

interface Tpl { key: string; label: string; desc: string; body: string }

export function TemplateEditor({ tpl }: { tpl: Tpl }) {
  const [body, setBody] = useState(tpl.body);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function save(fd: FormData) {
    start(async () => {
      const res = await actionSaveTemplate(tpl.key, fd);
      setMsg(res.ok ? { ok: true, text: "Tersimpan" } : { ok: false, text: res.error });
    });
  }
  function reset() {
    if (!confirm("Kembalikan ke teks bawaan?")) return;
    start(async () => {
      const res = await actionResetTemplate(tpl.key);
      if (res.ok && res.body != null) { setBody(res.body); setMsg({ ok: true, text: "Dikembalikan ke bawaan" }); }
      else if (!res.ok) setMsg({ ok: false, text: res.error });
    });
  }

  return (
    <Card>
      <CardContent className="p-5">
        <form action={save}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">{tpl.label}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">{tpl.desc}</p>
            </div>
          </div>
          <Textarea
            name="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            className="mt-3 text-sm"
          />
          <div className="mt-2 flex items-center gap-3">
            <SubmitButton pending={pending} pendingLabel="Menyimpan…" className="min-h-[40px]">
              Simpan
            </SubmitButton>
            <Button type="button" variant="outline" onClick={reset} disabled={pending} className="min-h-[40px]">
              Kembalikan bawaan
            </Button>
            {msg && <span className={`flex items-center gap-1 text-sm ${msg.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>{msg.ok && <Icon.Check className="h-4 w-4" aria-hidden />}{msg.text}</span>}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
