"use client";

import { useState, useTransition } from "react";
import { actionSaveChecklist, actionResetChecklist } from "./actions";
import { Icon } from "@/components/icons";

type Item = { key: string; label: string; type: "bool" | "number" | "text" | "photo"; required: boolean };
const TYPE_LABEL: Record<Item["type"], string> = { bool: "Centang", number: "Angka", text: "Teks", photo: "Foto" };

export function ChecklistEditor({ serviceType, label, initialItems }: { serviceType: string; label: string; initialItems: Item[] }) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function update(i: number, patch: Partial<Item>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  function add() {
    setItems((prev) => [...prev, { key: `item_${Date.now().toString(36)}`, label: "", type: "bool", required: false }]);
  }
  function remove(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }
  function save() {
    start(async () => {
      const res = await actionSaveChecklist(serviceType, items);
      setMsg(res.ok ? { ok: true, text: "Tersimpan" } : { ok: false, text: res.error });
    });
  }
  function reset() {
    if (!confirm("Kembalikan checklist ini ke bawaan?")) return;
    start(async () => {
      const res = await actionResetChecklist(serviceType);
      if (res.ok && res.items) { setItems(res.items as Item[]); setMsg({ ok: true, text: "Dikembalikan ke bawaan" }); }
      else if (!res.ok) setMsg({ ok: false, text: res.error });
    });
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between text-left">
        <span className="text-sm font-semibold text-slate-900">{label} <span className="text-slate-400">({items.length} item)</span></span>
        <span className="text-slate-400">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-2">
          {items.map((it, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 p-2">
              <input value={it.label} onChange={(e) => update(i, { label: e.target.value })} placeholder="Nama langkah…"
                className="min-h-[38px] flex-1 rounded-lg border border-slate-300 px-3 text-sm" />
              <select value={it.type} onChange={(e) => update(i, { type: e.target.value as Item["type"] })}
                className="min-h-[38px] rounded-lg border border-slate-300 px-2 text-sm">
                {Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <label className="flex items-center gap-1 text-xs text-slate-600">
                <input type="checkbox" checked={it.required} onChange={(e) => update(i, { required: e.target.checked })} className="h-4 w-4" />
                Wajib
              </label>
              <button onClick={() => remove(i)} aria-label="Hapus langkah" className="rounded-lg px-2 py-1 text-red-500 hover:bg-red-50"><Icon.Close className="h-4 w-4" aria-hidden /></button>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button onClick={add} className="min-h-[38px] rounded-lg border border-slate-300 px-3 text-sm text-slate-600 hover:bg-slate-50">+ Tambah langkah</button>
            <button onClick={save} disabled={pending} className="min-h-[38px] rounded-lg bg-sky-500 px-4 text-sm font-semibold text-white hover:bg-sky-600 disabled:opacity-50">
              {pending ? "Menyimpan…" : "Simpan"}
            </button>
            <button onClick={reset} disabled={pending} className="min-h-[38px] rounded-lg border border-slate-300 px-3 text-sm text-slate-600 hover:bg-slate-50">Bawaan</button>
            {msg && <span className={`flex items-center gap-1 text-sm ${msg.ok ? "text-emerald-600" : "text-red-600"}`}>{msg.ok && <Icon.Check className="h-4 w-4" aria-hidden />}{msg.text}</span>}
          </div>
        </div>
      )}
    </section>
  );
}
