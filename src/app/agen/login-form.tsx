"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Image from "next/image";
import { actionAgentLogin, actionResellerLogin, type PortalResult } from "./actions";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}
      className="min-h-[48px] w-full rounded-2xl bg-sky-500 px-6 text-base font-semibold text-white shadow-lg shadow-sky-200 transition hover:bg-sky-600 disabled:opacity-60">
      {pending ? "Memproses…" : label}
    </button>
  );
}

export function PartnerLoginForm({ kind, title, subtitle, registerHint }: {
  kind: "agent" | "reseller"; title: string; subtitle: string; registerHint: React.ReactNode;
}) {
  const action = kind === "agent" ? actionAgentLogin : actionResellerLogin;
  const [state, formAction] = useActionState<PortalResult | { ok: null }, FormData>(action, { ok: null });
  const err = state && "ok" in state && state.ok === false ? state.error : null;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 p-6">
      <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-sky-200/40 blur-3xl" />
      <div className="relative w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-8 shadow-lg shadow-slate-200/50">
        <div className="flex flex-col items-center text-center">
          <Image src="/brand/aircon-logo.png" alt="Aircon" width={48} height={48} className="h-12 w-12 object-contain" priority />
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
        {err && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{err}</p>}
        <form action={formAction} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">Email</label>
            <input id="email" name="email" type="email" required autoComplete="email"
              className="min-h-[48px] w-full rounded-2xl border border-slate-300 px-4 text-base outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200" />
          </div>
          <div>
            <label htmlFor="pin" className="mb-1 block text-sm font-medium text-slate-700">PIN (6 angka)</label>
            <input id="pin" name="pin" inputMode="numeric" pattern="\d{6}" maxLength={6} required autoComplete="current-password"
              className="min-h-[48px] w-full rounded-2xl border border-slate-300 px-4 text-center text-lg tracking-[0.4em] outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200" />
          </div>
          <Submit label="Masuk" />
        </form>
        {registerHint && <div className="mt-5 text-center text-sm text-slate-500">{registerHint}</div>}
      </div>
    </main>
  );
}
