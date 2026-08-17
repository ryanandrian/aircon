"use client";

import { useState, useTransition } from "react";
import { actionUpdateIotProduct, actionUpdateIotOrderStatus } from "../config-actions";
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
  const field = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await actionUpdateIotProduct(id, fd);
      setMsg(res.ok ? { ok: true, text: "Tersimpan" } : { ok: false, text: res.error });
    });
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-slate-400">{sku}</span>
        <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="active" defaultChecked={initial.active} /> Aktif</label>
      </div>
      <label className="mt-2 block text-xs font-medium text-slate-600">Nama</label>
      <input name="name" defaultValue={initial.name} className={field} required />
      <label className="mt-2 block text-xs font-medium text-slate-600">Deskripsi</label>
      <input name="description" defaultValue={initial.description} className={field} />
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-medium text-slate-600">Harga (Rp)</label>
          <input type="number" name="priceUnit" defaultValue={initial.priceUnit} className={field} min={0} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">Garansi (hari)</label>
          <input type="number" name="warrantyDays" defaultValue={initial.warrantyDays} className={field} min={0} />
        </div>
      </div>
      {msg && <p className={`mt-2 text-sm ${msg.ok ? "text-emerald-600" : "text-red-600"}`}>{msg.text}</p>}
      <button type="submit" disabled={pending} className="mt-3 w-full rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600 disabled:opacity-50">
        {pending ? "Menyimpan…" : "Simpan"}
      </button>
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
      <td className="px-4 py-3 font-mono text-xs">{orderNo}</td>
      <td className="px-4 py-3">{qty}</td>
      <td className="px-4 py-3">{total}</td>
      <td className="px-4 py-3">
        <select value={st} onChange={(e) => setSt(e.target.value as IotOrderStatus)} className="rounded-lg border border-slate-300 px-2 py-1 text-xs">
          {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Catatan/resi" className="w-32 rounded-lg border border-slate-300 px-2 py-1 text-xs" />
          <button onClick={save} disabled={pending} className="rounded-lg bg-slate-800 px-3 py-1 text-xs font-medium text-white disabled:opacity-50">
            {pending ? "…" : "Simpan"}
          </button>
          {saved && <span className="text-xs text-emerald-600">✓</span>}
        </div>
      </td>
    </tr>
  );
}
