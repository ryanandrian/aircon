"use client";

import { useState, useTransition } from "react";
import { actionUpdatePolicy } from "../config-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

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

  return (
    <form onSubmit={onSubmit} className="max-w-lg space-y-4 rounded-xl bg-card p-6 ring-1 ring-foreground/10">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="taxPercent">Pajak (%)</Label>
          <Input id="taxPercent" type="number" step="0.1" name="taxPercent" defaultValue={initial.taxPercent} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="trialDays">Masa trial (hari)</Label>
          <Input id="trialDays" type="number" name="trialDays" defaultValue={initial.trialDays} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="graceDaysBeforeSuspend">Tenggang suspend (hari)</Label>
          <Input id="graceDaysBeforeSuspend" type="number" name="graceDaysBeforeSuspend" defaultValue={initial.graceDaysBeforeSuspend} className="mt-1" />
          <p className="mt-1 text-xs text-muted-foreground">Telat lebih dari ini → tak bisa login.</p>
        </div>
        <div>
          <Label htmlFor="daysBeforeDelete">Tenggang hapus (hari)</Label>
          <Input id="daysBeforeDelete" type="number" name="daysBeforeDelete" defaultValue={initial.daysBeforeDelete} className="mt-1" />
          <p className="mt-1 text-xs text-muted-foreground">Telat lebih dari ini → data dihapus.</p>
        </div>
        <div>
          <Label htmlFor="deleteWarningDay">Hari peringatan hapus</Label>
          <Input id="deleteWarningDay" type="number" name="deleteWarningDay" defaultValue={initial.deleteWarningDay} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="dunningReminderDays">Jadwal pengingat (hari)</Label>
          <Input id="dunningReminderDays" name="dunningReminderDays" defaultValue={initial.dunningReminderDays} className="mt-1" placeholder="0,1,3" />
        </div>
      </div>

      <div className="space-y-3 rounded-xl border bg-muted/40 p-4">
        <p className="text-sm font-medium text-foreground">Template Pesan Penagihan (WhatsApp ke owner tenant)</p>
        <p className="text-xs text-muted-foreground">Placeholder: {"{nama}"} = nama usaha, {"{telat}"} = hari menunggak, {"{sisa}"} = sisa hari sebelum data dihapus.</p>
        <div>
          <Label htmlFor="dunningReminderTemplate">Pengingat biasa</Label>
          <Textarea id="dunningReminderTemplate" name="dunningReminderTemplate" defaultValue={initial.dunningReminderTemplate} rows={2} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="dunningWarningTemplate">Peringatan hapus data (mendekati batas)</Label>
          <Textarea id="dunningWarningTemplate" name="dunningWarningTemplate" defaultValue={initial.dunningWarningTemplate} rows={2} className="mt-1" />
        </div>
      </div>

      {msg && <p className={`text-sm ${msg.ok ? "text-emerald-600" : "text-red-600"}`}>{msg.text}</p>}
      {updatedBy && <p className="text-xs text-muted-foreground">Terakhir diubah oleh {updatedBy}</p>}

      <Button
        type="submit"
        disabled={pending}
        className="bg-sky-500 text-white hover:bg-sky-600"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {pending ? "Menyimpan…" : "Simpan Kebijakan"}
      </Button>
    </form>
  );
}
