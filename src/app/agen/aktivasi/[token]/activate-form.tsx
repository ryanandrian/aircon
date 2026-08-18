"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Image from "next/image";
import { actionActivate, type PortalResult } from "@/app/agen/actions";

function Submit() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="min-h-[48px] w-full rounded-2xl bg-sky-500 px-6 text-base font-semibold text-white disabled:opacity-60">{pending ? "Menyimpan…" : "Aktifkan & Masuk"}</button>;
}

export function ActivateForm({ kind, token, title }: { kind: "agent" | "reseller"; token: string; title: string }) {
  const bound = actionActivate.bind(null, kind, token);
  const [state, formAction] = useActionState<PortalResult | { ok: null }, FormData>(bound, { ok: null });
  const err = state && "ok" in state && state.ok === false ? state.error : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-8 shadow-lg">
        <div className="flex flex-col items-center text-center">
          <Image src="/brand/aircon-logo.png" alt="Aircon" width={48} height={48} className="h-12 w-12 object-contain" priority />
          <h1 className="mt-3 text-xl font-bold text-slate-900">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">Buat PIN 6 angka untuk masuk portal.</p>
        </div>
        {err && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{err}</p>}
        <form action={formAction} className="mt-6 space-y-4">
          <input name="pin" inputMode="numeric" pattern="\d{6}" maxLength={6} required placeholder="PIN baru"
            className="min-h-[48px] w-full rounded-2xl border border-slate-300 px-4 text-center text-lg tracking-[0.4em] outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200" />
          <input name="pin2" inputMode="numeric" pattern="\d{6}" maxLength={6} required placeholder="Ulangi PIN"
            className="min-h-[48px] w-full rounded-2xl border border-slate-300 px-4 text-center text-lg tracking-[0.4em] outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200" />
          <Submit />
        </form>
      </div>
    </main>
  );
}
