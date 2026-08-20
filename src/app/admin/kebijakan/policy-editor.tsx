"use client";

import { useState, useTransition } from "react";
import { actionUpdatePolicy } from "../config-actions";

interface Initial {
  taxPercent: number;
  trialDays: number;
  graceDaysBeforeSuspend: number;
  daysBeforeDelete: number;
  dunningReminderDays: string;
  deleteWarningDay: number;
  dunningReminderTemplate: string;
  dunningWarningTemplate: string;
}

export function PolicyEditor({ initial, updatedBy }: { initial: Initial; updatedBy: string | null }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await actionUpdatePolicy(fd);
      setMsg(res.ok ? { ok: true, text: "Tersimpan" } : { ok: false, text: res.error });
    });
  }

  const field = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";
  const label = "block text-sm font-medium text-slate-700";

  return (
    <form onSubmit={onSubmit} className="max-w-lg space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={label}>Pajak (%)</label>
          <input type="number" step="0.1" name="taxPercent" defaultValue={initial.taxPercent} className={field} />
        </div>
        <div>
          <label className={label}>Masa trial (hari)</label>
          <input type="number" name="trialDays" defaultValue={initial.trialDays} className={field} />
        </div>
        <div>
          <label className={label}>Tenggang suspend (hari)</label>
          <input type="number" name="graceDaysBeforeSuspend" defaultValue={initial.graceDaysBeforeSuspend} className={field} />
          <p className="mt-1 text-xs text-slate-400">Telat lebih dari ini → tak bisa login.</p>
        </div>
        <div>
          <label className={label}>Tenggang hapus (hari)</label>
          <input type="number" name="daysBeforeDelete" defaultValue={initial.daysBeforeDelete} className={field} />
          <p className="mt-1 text-xs text-slate-400">Telat lebih dari ini → data dihapus.</p>
        </div>
        <div>
          <label className={label}>Hari peringatan hapus</label>
          <input type="number" name="deleteWarningDay" defaultValue={initial.deleteWarningDay} className={field} />
        </div>
        <div>
          <label className={label}>Jadwal pengingat (hari)</label>
          <input name="dunningReminderDays" defaultValue={initial.dunningReminderDays} className={field} placeholder="0,1,3" />
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-medium text-slate-700">Template Pesan Penagihan (WhatsApp ke owner tenant)</p>
        <p className="text-xs text-slate-500">Placeholder: {"{nama}"} = nama usaha, {"{telat}"} = hari menunggak, {"{sisa}"} = sisa hari sebelum data dihapus.</p>
        <div>
          <label className={label}>Pengingat biasa</label>
          <textarea name="dunningReminderTemplate" defaultValue={initial.dunningReminderTemplate} rows={2} className={field} />
        </div>
        <div>
          <label className={label}>Peringatan hapus data (mendekati batas)</label>
          <textarea name="dunningWarningTemplate" defaultValue={initial.dunningWarningTemplate} rows={2} className={field} />
        </div>
      </div>

      {msg && <p className={`text-sm ${msg.ok ? "text-emerald-600" : "text-red-600"}`}>{msg.text}</p>}
      {updatedBy && <p className="text-xs text-slate-400">Terakhir diubah oleh {updatedBy}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-sky-500 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-600 disabled:opacity-50"
      >
        {pending ? "Menyimpan…" : "Simpan Kebijakan"}
      </button>
    </form>
  );
}
