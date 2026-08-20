"use client";

import { useState, useTransition } from "react";
import { actionSaveTemplate, actionResetTemplate } from "./actions";

interface Tpl { key: string; label: string; desc: string; body: string }

export function TemplateEditor({ tpl }: { tpl: Tpl }) {
  const [body, setBody] = useState(tpl.body);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function save(fd: FormData) {
    start(async () => {
      const res = await actionSaveTemplate(tpl.key, fd);
      setMsg(res.ok ? { ok: true, text: "Tersimpan ✓" } : { ok: false, text: res.error });
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
    <form action={save} className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{tpl.label}</h2>
          <p className="mt-0.5 text-xs text-slate-500">{tpl.desc}</p>
        </div>
      </div>
      <textarea
        name="body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        className="mt-3 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
      />
      <div className="mt-2 flex items-center gap-3">
        <button type="submit" disabled={pending}
          className="min-h-[40px] rounded-xl bg-sky-500 px-4 text-sm font-semibold text-white hover:bg-sky-600 disabled:opacity-50">
          {pending ? "Menyimpan…" : "Simpan"}
        </button>
        <button type="button" onClick={reset} disabled={pending}
          className="min-h-[40px] rounded-xl border border-slate-300 px-4 text-sm text-slate-600 hover:bg-slate-50">
          Kembalikan bawaan
        </button>
        {msg && <span className={`text-sm ${msg.ok ? "text-emerald-600" : "text-red-600"}`}>{msg.text}</span>}
      </div>
    </form>
  );
}
