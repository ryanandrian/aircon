"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Image from "next/image";
import { actionRegisterReseller, type PortalResult } from "@/app/agen/actions";

function Submit() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="min-h-[48px] w-full rounded-2xl bg-sky-500 px-6 text-base font-semibold text-white disabled:opacity-60">{pending ? "Mengirim…" : "Daftar Jadi Reseller"}</button>;
}

export function RegisterForm({ joinCode, agentName }: { joinCode: string; agentName: string }) {
  const bound = actionRegisterReseller.bind(null, joinCode);
  const [state, formAction] = useActionState<PortalResult | { ok: null }, FormData>(bound, { ok: null });
  const ok = state && "ok" in state && state.ok === true;
  const err = state && "ok" in state && state.ok === false ? state.error : null;
  const field = "mt-1 min-h-[46px] w-full rounded-xl border border-slate-300 px-4 text-base outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200";

  if (ok) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-sm rounded-3xl border border-emerald-200 bg-white p-8 text-center shadow-lg">
          <div className="text-4xl">✅</div>
          <h1 className="mt-3 text-xl font-bold text-slate-900">Pendaftaran Terkirim</h1>
          <p className="mt-2 text-sm text-slate-600">Menunggu persetujuan <b>{agentName}</b>. Setelah disetujui, Anda dapat tautan untuk membuat PIN & masuk portal reseller.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-lg">
        <div className="flex flex-col items-center text-center">
          <Image src="/brand/aircon-logo.png" alt="Aircon" width={48} height={48} className="h-12 w-12 object-contain" priority />
          <h1 className="mt-3 text-xl font-bold text-slate-900">Daftar Reseller</h1>
          <p className="mt-1 text-sm text-slate-500">Bergabung dengan <b>{agentName}</b> untuk menjual Aircon & dapat komisi.</p>
        </div>
        {err && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{err}</p>}
        <form action={formAction} className="mt-6 space-y-3">
          <label className="block text-sm">Nama Lengkap*<input name="name" required className={field} /></label>
          <label className="block text-sm">Email*<input name="email" type="email" required className={field} /></label>
          <label className="block text-sm">No. WhatsApp<input name="phone" className={field} /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">Nama Bank<input name="bankName" className={field} placeholder="BCA" /></label>
            <label className="block text-sm">No. Rekening<input name="bankAccount" className={field} /></label>
          </div>
          <label className="block text-sm">Atas Nama<input name="bankHolder" className={field} /></label>
          <p className="text-xs text-slate-400">Rekening dipakai agen Anda untuk transfer komisi. Disimpan terenkripsi.</p>
          <Submit />
        </form>
      </div>
    </main>
  );
}
