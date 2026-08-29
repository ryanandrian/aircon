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
  inactivitySweepEnabled: boolean;
  inactivityDryRun: boolean;
  inactivityReminder1Days: number;
  inactivityReminder2Days: number;
  inactivityDeleteDays: number;
  inactivityMinCustomers: number;
  inactivityMinJobs: number;
  inactivityExemptPaid: boolean;
  inactivityReminder1Template: string;
  inactivityReminder2Template: string;
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

      <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
        <p className="text-sm font-semibold text-foreground">Sweeper Akun Tidak Aktif (tenant gratis/telantar)</p>
        <p className="text-xs text-muted-foreground">
          Hapus otomatis akun yang benar-benar telantar (mis. coba-coba lalu ditinggal). Berbasis aktivitas NYATA
          (pekerjaan/invoice/pelanggan/login). Aktivitas kembali → batal hapus. Semua ambang di bawah bisa diubah.
        </p>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="inactivitySweepEnabled" defaultChecked={initial.inactivitySweepEnabled} className="h-4 w-4 accent-sky-500" />
            Aktifkan sweeper
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="inactivityDryRun" defaultChecked={initial.inactivityDryRun} className="h-4 w-4 accent-amber-500" />
            Mode simulasi (dry-run: hanya catat, TIDAK menghapus)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="inactivityExemptPaid" defaultChecked={initial.inactivityExemptPaid} className="h-4 w-4 accent-sky-500" />
            Kecualikan tenant yang pernah bayar
          </label>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="inactivityReminder1Days">Reminder #1 (hari tak aktif)</Label>
            <Input id="inactivityReminder1Days" type="number" name="inactivityReminder1Days" defaultValue={initial.inactivityReminder1Days} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="inactivityReminder2Days">Reminder #2 (hari tak aktif)</Label>
            <Input id="inactivityReminder2Days" type="number" name="inactivityReminder2Days" defaultValue={initial.inactivityReminder2Days} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="inactivityDeleteDays">Hapus permanen (hari tak aktif)</Label>
            <Input id="inactivityDeleteDays" type="number" name="inactivityDeleteDays" defaultValue={initial.inactivityDeleteDays} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="inactivityMinCustomers">Kecualikan bila ≥ pelanggan</Label>
            <Input id="inactivityMinCustomers" type="number" name="inactivityMinCustomers" defaultValue={initial.inactivityMinCustomers} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="inactivityMinJobs">Kecualikan bila ≥ pekerjaan</Label>
            <Input id="inactivityMinJobs" type="number" name="inactivityMinJobs" defaultValue={initial.inactivityMinJobs} className="mt-1" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Placeholder template: {"{nama}"} = nama usaha, {"{hari}"} = hari tak aktif, {"{sisa}"} = sisa hari sebelum dihapus.</p>
        <div>
          <Label htmlFor="inactivityReminder1Template">Template reminder #1</Label>
          <Textarea id="inactivityReminder1Template" name="inactivityReminder1Template" defaultValue={initial.inactivityReminder1Template} rows={2} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="inactivityReminder2Template">Template reminder #2 (peringatan hapus)</Label>
          <Textarea id="inactivityReminder2Template" name="inactivityReminder2Template" defaultValue={initial.inactivityReminder2Template} rows={2} className="mt-1" />
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
