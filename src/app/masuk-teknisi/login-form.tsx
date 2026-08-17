"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { techLogin } from "./actions";

export function TechLoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    start(async () => {
      const res = await techLogin(phone, pin);
      if (!res.ok) { setMsg(res.error); return; }
      router.replace(next);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
      {msg && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{msg}</p>}
      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-slate-700">Nomor HP</label>
        <input
          id="phone" type="tel" inputMode="numeric" autoComplete="tel"
          value={phone} onChange={(e) => setPhone(e.target.value)} required
          placeholder="08xxxxxxxxxx"
          className="mt-1 min-h-[48px] w-full rounded-xl border border-slate-300 px-4 py-3 text-base"
        />
      </div>
      <div>
        <label htmlFor="pin" className="block text-sm font-medium text-slate-700">PIN (6 angka)</label>
        <input
          id="pin" type="password" inputMode="numeric" autoComplete="current-password"
          maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} required
          placeholder="••••••"
          className="mt-1 min-h-[48px] w-full rounded-xl border border-slate-300 px-4 py-3 text-center text-2xl tracking-[0.5em]"
        />
      </div>
      <button
        type="submit" disabled={pending || pin.length !== 6}
        className="min-h-[48px] w-full rounded-2xl bg-sky-500 font-semibold text-white active:bg-sky-600 disabled:opacity-50"
      >
        {pending ? "Masuk…" : "Masuk"}
      </button>
    </form>
  );
}
