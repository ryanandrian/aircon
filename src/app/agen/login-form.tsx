"use client";

import { useActionState } from "react";
import Image from "next/image";
import { actionAgentLogin, actionResellerLogin, type PortalResult } from "./actions";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/submit-button";
import { ThemeToggle } from "@/components/theme-toggle";

export function PartnerLoginForm({ kind, title, subtitle, registerHint }: {
  kind: "agent" | "reseller"; title: string; subtitle: string; registerHint: React.ReactNode;
}) {
  const action = kind === "agent" ? actionAgentLogin : actionResellerLogin;
  const [state, formAction] = useActionState<PortalResult | { ok: null }, FormData>(action, { ok: null });
  const err = state && "ok" in state && state.ok === false ? state.error : null;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-muted/40 p-6">
      <div className="absolute right-4 top-4"><ThemeToggle /></div>
      <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-sky-200/40 blur-3xl" />
      <Card className="relative w-full max-w-sm rounded-3xl shadow-lg">
        <CardContent className="p-8">
          <div className="flex flex-col items-center text-center">
            <Image src="/brand/aircon-logo.png" alt="Aircon" width={48} height={48} className="h-12 w-12 object-contain" priority />
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-foreground">{title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          </div>
          {err && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-400">{err}</p>}
          <form action={formAction} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required autoComplete="email" className="min-h-[48px] text-base" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pin">PIN (6 angka)</Label>
              <Input id="pin" name="pin" inputMode="numeric" pattern="\d{6}" maxLength={6} required autoComplete="current-password"
                className="min-h-[48px] text-center text-lg tracking-[0.4em]" />
            </div>
            <SubmitButton pendingLabel="Memproses…" className="min-h-[48px] w-full shadow-lg shadow-sky-200">Masuk</SubmitButton>
          </form>
          {registerHint && <div className="mt-5 text-center text-sm text-muted-foreground">{registerHint}</div>}
        </CardContent>
      </Card>
    </main>
  );
}
