"use client";

import { useState, useTransition } from "react";
import { actionUpdateIotProduct, actionUpdateIotOrderStatus } from "../config-actions";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import type { IotOrderStatus } from "@prisma/client";

const ORDER_STATUSES: IotOrderStatus[] = [
  "PENDING_PAYMENT", "PAID", "PROCESSING", "SHIPPED", "DELIVERED", "INSTALLED", "CANCELLED",
];

export function ProductEditor({
  id, sku, initial,
}: {
  id: string;
  sku: string;
  initial: { name: string; description: string; priceUnit: number; warrantyDays: number; active: boolean };
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await actionUpdateIotProduct(id, fd);
      setMsg(res.ok ? { ok: true, text: "Tersimpan" } : { ok: false, text: res.error });
    });
  }

  return (
    <form onSubmit={onSubmit} className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-muted-foreground">{sku}</span>
        <label className="flex items-center gap-1 text-xs text-foreground"><input type="checkbox" name="active" defaultChecked={initial.active} /> Aktif</label>
      </div>
      <Label htmlFor={`name-${id}`} className="mt-2 text-xs text-muted-foreground">Nama</Label>
      <Input id={`name-${id}`} name="name" defaultValue={initial.name} className="mt-1" required />
      <Label htmlFor={`description-${id}`} className="mt-2 text-xs text-muted-foreground">Deskripsi</Label>
      <Input id={`description-${id}`} name="description" defaultValue={initial.description} className="mt-1" />
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor={`priceUnit-${id}`} className="text-xs text-muted-foreground">Harga (Rp)</Label>
          <Input id={`priceUnit-${id}`} type="number" name="priceUnit" defaultValue={initial.priceUnit} className="mt-1" min={0} />
        </div>
        <div>
          <Label htmlFor={`warrantyDays-${id}`} className="text-xs text-muted-foreground">Garansi (hari)</Label>
          <Input id={`warrantyDays-${id}`} type="number" name="warrantyDays" defaultValue={initial.warrantyDays} className="mt-1" min={0} />
        </div>
      </div>
      {msg && <p className={`mt-2 text-sm ${msg.ok ? "text-emerald-600" : "text-red-600"}`}>{msg.text}</p>}
      <Button type="submit" disabled={pending} className="mt-3 w-full bg-sky-500 text-white hover:bg-sky-600">
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {pending ? "Menyimpan…" : "Simpan"}
      </Button>
    </form>
  );
}

export function OrderRow({
  id, orderNo, qty, total, status, trackingNote,
}: {
  id: string; orderNo: string; qty: number; total: string; status: IotOrderStatus; trackingNote: string;
}) {
  const [pending, start] = useTransition();
  const [st, setSt] = useState<IotOrderStatus>(status);
  const [note, setNote] = useState(trackingNote);
  const [saved, setSaved] = useState(false);

  function save() {
    setSaved(false);
    start(async () => {
      const res = await actionUpdateIotOrderStatus(id, st, note);
      setSaved(res.ok);
    });
  }

  return (
    <tr>
      <td className="px-4 py-3 font-mono text-xs text-foreground">{orderNo}</td>
      <td className="px-4 py-3 text-foreground">{qty}</td>
      <td className="px-4 py-3 text-foreground">{total}</td>
      <td className="px-4 py-3">
        <select value={st} onChange={(e) => setSt(e.target.value as IotOrderStatus)} className="rounded-lg border border-input bg-transparent px-2 py-1 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30">
          {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Catatan/resi" className="h-7 w-32 text-xs" />
          <Button type="button" onClick={save} disabled={pending} variant="secondary" size="sm">
            {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
            {pending ? "…" : "Simpan"}
          </Button>
          {saved && <Icon.Check className="h-4 w-4 text-emerald-600" aria-hidden />}
        </div>
      </td>
    </tr>
  );
}
