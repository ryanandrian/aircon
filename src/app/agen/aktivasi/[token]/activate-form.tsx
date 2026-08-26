"use client";

import { useActionState } from "react";
import Image from "next/image";
import { actionActivate, type PortalResult } from "@/app/agen/actions";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { ThemeToggle } from "@/components/theme-toggle";

export function ActivateForm({ kind, token, title }: { kind: "agent" | "reseller"; token: string; title: string }) {
  const bound = actionActivate.bind(null, kind, token);
  const [state, formAction] = useActionState<PortalResult | { ok: null }, FormData>(bound, { ok: null });
  const err = state && "ok" in state && state.ok === false ? state.error : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-6">
      <div className="absolute right-4 top-4"><ThemeToggle /></div>
      <Card className="w-full max-w-sm rounded-3xl shadow-lg">
        <CardContent className="p-8">
          <div className="flex flex-col items-center text-center">
            <Image src="/brand/aircon-logo.png" alt="Aircon" width={48} height={48} className="h-12 w-12 object-contain" priority />
            <h1 className="mt-3 text-xl font-bold text-foreground">{title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">Buat PIN 6 angka untuk masuk portal.</p>
          </div>
          {err && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-400">{err}</p>}
          <form action={formAction} className="mt-6 space-y-4">
            <Input name="pin" inputMode="numeric" pattern="\d{6}" maxLength={6} required placeholder="PIN baru"
              className="min-h-[48px] text-center text-lg tracking-[0.4em]" />
            <Input name="pin2" inputMode="numeric" pattern="\d{6}" maxLength={6} required placeholder="Ulangi PIN"
              className="min-h-[48px] text-center text-lg tracking-[0.4em]" />
            <SubmitButton pendingLabel="Menyimpan…" className="min-h-[48px] w-full">Aktifkan &amp; Masuk</SubmitButton>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
