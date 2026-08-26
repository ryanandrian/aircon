"use client";

import { useState, useTransition } from "react";
import { actionUpdatePlan } from "../config-actions";
import type { TenantPlan } from "@prisma/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/submit-button";

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

  return (
    <Card>
      <CardContent className="p-5">
        <form onSubmit={onSubmit}>
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-foreground">{plan}</h2>
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              <input type="checkbox" name="active" defaultChecked={initial.active} className="accent-sky-500" /> Aktif
            </label>
          </div>

          <div className="mt-3 space-y-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Nama tampilan</Label>
              <Input name="displayName" defaultValue={initial.displayName} required />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Tagline</Label>
              <Input name="tagline" defaultValue={initial.tagline} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Harga/bulan (Rp)</Label>
                <Input type="number" name="priceMonthly" defaultValue={initial.priceMonthly} min={0} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Urutan</Label>
                <Input type="number" name="sortOrder" defaultValue={initial.sortOrder} min={0} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" name="taxable" defaultChecked={initial.taxable} className="accent-sky-500" /> Kena pajak
            </label>

            <p className="pt-2 text-xs font-semibold text-muted-foreground">Kuota (kosong = tanpa batas)</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Maks admin</Label>
                <Input type="number" name="maxAdmins" defaultValue={initial.maxAdmins ?? ""} min={0} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Maks teknisi</Label>
                <Input type="number" name="maxTechnicians" defaultValue={initial.maxTechnicians ?? ""} min={0} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Maks pelanggan</Label>
                <Input type="number" name="maxCustomers" defaultValue={initial.maxCustomers ?? ""} min={0} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Maks unit AC</Label>
                <Input type="number" name="maxAcUnits" defaultValue={initial.maxAcUnits ?? ""} min={0} />
              </div>
            </div>
          </div>

          {msg && (
            <p className={`mt-3 text-sm ${msg.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>{msg.text}</p>
          )}
          <SubmitButton
            pending={pending}
            pendingLabel="Menyimpan…"
            className="mt-4 w-full bg-sky-500 text-white hover:bg-sky-600"
          >
            Simpan
          </SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
