"use client";

import { useActionState } from "react";
import Image from "next/image";
import { actionRegisterReseller, type PortalResult } from "@/app/agen/actions";
import { Icon } from "@/components/icons";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/submit-button";
import { ThemeToggle } from "@/components/theme-toggle";

export function RegisterForm({ joinCode, agentName }: { joinCode: string; agentName: string }) {
  const bound = actionRegisterReseller.bind(null, joinCode);
  const [state, formAction] = useActionState<PortalResult | { ok: null }, FormData>(bound, { ok: null });
  const ok = state && "ok" in state && state.ok === true;
  const err = state && "ok" in state && state.ok === false ? state.error : null;

  if (ok) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/40 p-6">
        <Card className="w-full max-w-sm rounded-3xl border-emerald-200 text-center shadow-lg">
          <CardContent className="p-8">
            <div className="flex justify-center text-emerald-500"><Icon.Success className="h-10 w-10" aria-hidden /></div>
            <h1 className="mt-3 text-xl font-bold text-foreground">Pendaftaran Terkirim</h1>
            <p className="mt-2 text-sm text-muted-foreground">Menunggu persetujuan <b>{agentName}</b>. Setelah disetujui, Anda dapat tautan untuk membuat PIN &amp; masuk portal reseller.</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-6">
      <div className="absolute right-4 top-4"><ThemeToggle /></div>
      <Card className="w-full max-w-md rounded-3xl shadow-lg">
        <CardContent className="p-8">
          <div className="flex flex-col items-center text-center">
            <Image src="/brand/aircon-logo.png" alt="Aircon" width={48} height={48} className="h-12 w-12 object-contain" priority />
            <h1 className="mt-3 text-xl font-bold text-foreground">Daftar Reseller</h1>
            <p className="mt-1 text-sm text-muted-foreground">Bergabung dengan <b>{agentName}</b> untuk menjual Aircon &amp; dapat komisi.</p>
          </div>
          {err && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-400">{err}</p>}
          <form action={formAction} className="mt-6 space-y-3">
            <div className="space-y-1.5"><Label htmlFor="name">Nama Lengkap*</Label><Input id="name" name="name" required className="min-h-[46px]" /></div>
            <div className="space-y-1.5"><Label htmlFor="email">Email*</Label><Input id="email" name="email" type="email" required className="min-h-[46px]" /></div>
            <div className="space-y-1.5"><Label htmlFor="phone">No. WhatsApp</Label><Input id="phone" name="phone" className="min-h-[46px]" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label htmlFor="bankName">Nama Bank</Label><Input id="bankName" name="bankName" placeholder="BCA" className="min-h-[46px]" /></div>
              <div className="space-y-1.5"><Label htmlFor="bankAccount">No. Rekening</Label><Input id="bankAccount" name="bankAccount" className="min-h-[46px]" /></div>
            </div>
            <div className="space-y-1.5"><Label htmlFor="bankHolder">Atas Nama</Label><Input id="bankHolder" name="bankHolder" className="min-h-[46px]" /></div>
            <p className="text-xs text-muted-foreground">Rekening dipakai agen Anda untuk transfer komisi. Disimpan terenkripsi.</p>
            <SubmitButton pendingLabel="Mengirim…" className="min-h-[48px] w-full">Daftar Jadi Reseller</SubmitButton>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
