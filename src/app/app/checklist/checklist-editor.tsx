"use client";

import { useState, useTransition } from "react";
import { actionSaveChecklist, actionRemoveChecklist } from "./actions";
import { Icon } from "@/components/icons";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

export function ChecklistEditor({
  serviceType, label, initialItems, applied: initialApplied, example,
}: {
  serviceType: string; label: string; initialItems: Item[]; applied: boolean; example: Item[];
}) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [applied, setApplied] = useState(initialApplied);
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
  function loadExample() {
    setItems(example.map((e) => ({ ...e })));
    setMsg({ ok: true, text: "Contoh dimuat — sesuaikan lalu Simpan untuk menerapkan." });
  }
  function save() {
    if (items.length === 0) { setMsg({ ok: false, text: "Tambah minimal 1 langkah, atau nonaktifkan checklist." }); return; }
    start(async () => {
      const res = await actionSaveChecklist(serviceType, items);
      if (res.ok) { setApplied(true); setMsg({ ok: true, text: "Tersimpan & diterapkan" }); }
      else setMsg({ ok: false, text: res.error });
    });
  }
  function deactivate() {
    if (!confirm(`Nonaktifkan checklist "${label}"? Teknisi tak akan diminta checklist untuk jenis servis ini.`)) return;
    start(async () => {
      const res = await actionRemoveChecklist(serviceType);
      if (res.ok) { setItems([]); setApplied(false); setMsg({ ok: true, text: "Dinonaktifkan" }); }
      else setMsg({ ok: false, text: res.error });
    });
  }

  const requiredCount = items.filter((i) => i.required).length;

  return (
    <Card>
      <CardContent className="p-5">
        <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between gap-3 text-left">
          <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
            {label}
            {applied ? (
              <Badge variant="default">Diterapkan · {items.length} langkah{requiredCount > 0 ? ` · ${requiredCount} wajib` : ""}</Badge>
            ) : (
              <Badge variant="secondary">Belum diterapkan</Badge>
            )}
          </span>
          <span className="shrink-0 text-muted-foreground">{open ? "▲" : "▼"}</span>
        </button>

        {open && (
          <div className="mt-4 space-y-2">
            {items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 text-center">
                <p className="text-sm text-muted-foreground">
                  Belum ada checklist untuk <span className="font-medium text-foreground">{label}</span>.
                  Teknisi tidak diminta checklist untuk jenis servis ini.
                </p>
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={add} className="min-h-[38px]">+ Buat dari kosong</Button>
                  {example.length > 0 && (
                    <Button type="button" variant="secondary" size="sm" onClick={loadExample} className="min-h-[38px]">
                      Muat contoh ({example.length} langkah)
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <>
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
                    Simpan &amp; terapkan
                  </SubmitButton>
                  {applied && (
                    <Button type="button" variant="outline" size="sm" onClick={deactivate} disabled={pending} className="min-h-[38px] text-red-600 dark:text-red-400">Nonaktifkan</Button>
                  )}
                  {msg && <span className={`flex items-center gap-1 text-sm ${msg.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>{msg.ok && <Icon.Check className="h-4 w-4" aria-hidden />}{msg.text}</span>}
                </div>
              </>
            )}
            {items.length === 0 && msg && (
              <p className={`text-sm ${msg.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>{msg.text}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
