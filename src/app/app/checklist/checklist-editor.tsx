"use client";

import { useState, useTransition } from "react";
import { actionSaveChecklist, actionResetChecklist } from "./actions";
import { Icon } from "@/components/icons";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
    <Card>
      <CardContent className="p-5">
        <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between text-left">
          <span className="text-sm font-semibold text-foreground">{label} <span className="text-muted-foreground">({items.length} item)</span></span>
          <span className="text-muted-foreground">{open ? "▲" : "▼"}</span>
        </button>

        {open && (
          <div className="mt-4 space-y-2">
            {items.map((it, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/50 p-2">
                <Input value={it.label} onChange={(e) => update(i, { label: e.target.value })} placeholder="Nama langkah…"
                  className="min-h-[38px] flex-1" />
                <Select value={it.type} onValueChange={(v) => update(i, { type: (v ?? "bool") as Item["type"] })}>
                  <SelectTrigger size="sm" className="min-h-[38px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
                <label className="flex items-center gap-1 text-xs text-muted-foreground">
                  <input type="checkbox" checked={it.required} onChange={(e) => update(i, { required: e.target.checked })} className="h-4 w-4" />
                  Wajib
                </label>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => remove(i)} aria-label="Hapus langkah" className="text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50"><Icon.Close className="h-4 w-4" aria-hidden /></Button>
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" onClick={add} className="min-h-[38px]">+ Tambah langkah</Button>
              <SubmitButton type="button" onClick={save} pending={pending} pendingLabel="Menyimpan…" size="sm" className="min-h-[38px]">
                Simpan
              </SubmitButton>
              <Button type="button" variant="outline" size="sm" onClick={reset} disabled={pending} className="min-h-[38px]">Bawaan</Button>
              {msg && <span className={`flex items-center gap-1 text-sm ${msg.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>{msg.ok && <Icon.Check className="h-4 w-4" aria-hidden />}{msg.text}</span>}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
