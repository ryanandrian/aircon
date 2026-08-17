"use client";

import { useState, useTransition } from "react";
import { actionUpdatePlan } from "../config-actions";
import type { TenantPlan } from "@prisma/client";

interface Initial {
  displayName: string;
  priceMonthly: number;
  taxable: boolean;
  active: boolean;
  sortOrder: number;
  tagline: string;
  maxAdmins: number | null;
  maxTechnicians: number | null;
  maxCustomers: number | null;
  maxAcUnits: number | null;
}

export function PlanEditor({ plan, initial }: { plan: TenantPlan; initial: Initial }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await actionUpdatePlan(plan, fd);
      setMsg(res.ok ? { ok: true, text: "Tersimpan" } : { ok: false, text: res.error });
    });
  }

  const field = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";
  const label = "block text-xs font-medium text-slate-600";

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-bold">{plan}</h2>
        <label className="flex items-center gap-1 text-xs text-slate-600">
          <input type="checkbox" name="active" defaultChecked={initial.active} /> Aktif
        </label>
      </div>

      <div className="mt-3 space-y-3">
        <div>
          <label className={label}>Nama tampilan</label>
          <input name="displayName" defaultValue={initial.displayName} className={field} required />
        </div>
        <div>
          <label className={label}>Tagline</label>
          <input name="tagline" defaultValue={initial.tagline} className={field} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={label}>Harga/bulan (Rp)</label>
            <input type="number" name="priceMonthly" defaultValue={initial.priceMonthly} className={field} min={0} />
          </div>
          <div>
            <label className={label}>Urutan</label>
            <input type="number" name="sortOrder" defaultValue={initial.sortOrder} className={field} min={0} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="taxable" defaultChecked={initial.taxable} /> Kena pajak
        </label>

        <p className="pt-2 text-xs font-semibold text-slate-500">Kuota (kosong = tanpa batas)</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={label}>Maks admin</label>
            <input type="number" name="maxAdmins" defaultValue={initial.maxAdmins ?? ""} className={field} min={0} />
          </div>
          <div>
            <label className={label}>Maks teknisi</label>
            <input type="number" name="maxTechnicians" defaultValue={initial.maxTechnicians ?? ""} className={field} min={0} />
          </div>
          <div>
            <label className={label}>Maks pelanggan</label>
            <input type="number" name="maxCustomers" defaultValue={initial.maxCustomers ?? ""} className={field} min={0} />
          </div>
          <div>
            <label className={label}>Maks unit AC</label>
            <input type="number" name="maxAcUnits" defaultValue={initial.maxAcUnits ?? ""} className={field} min={0} />
          </div>
        </div>
      </div>

      {msg && (
        <p className={`mt-3 text-sm ${msg.ok ? "text-emerald-600" : "text-red-600"}`}>{msg.text}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="mt-4 w-full rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600 disabled:opacity-50"
      >
        {pending ? "Menyimpan…" : "Simpan"}
      </button>
    </form>
  );
}
