"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { techAcceptInvite } from "@/app/masuk-teknisi/actions";

export function AcceptForm({ token }: { token: string }) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    start(async () => {
      const res = await techAcceptInvite(token, pin, confirm);
      if (!res.ok) { setMsg(res.error); return; }
      router.replace("/t");
      router.refresh();
    });
  }

  const field = "mt-1 min-h-[48px] w-full rounded-xl border border-slate-300 px-4 py-3 text-center text-2xl tracking-[0.5em]";

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {msg && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{msg}</p>}
      <div>
        <label htmlFor="pin" className="block text-sm font-medium text-slate-700">Buat PIN (6 angka)</label>
        <input
          id="pin" type="password" inputMode="numeric" maxLength={6}
          value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} required
          placeholder="••••••" className={field}
        />
      </div>
      <div>
        <label htmlFor="confirm" className="block text-sm font-medium text-slate-700">Ulangi PIN</label>
        <input
          id="confirm" type="password" inputMode="numeric" maxLength={6}
          value={confirm} onChange={(e) => setConfirm(e.target.value.replace(/\D/g, ""))} required
          placeholder="••••••" className={field}
        />
      </div>
      <button
        type="submit" disabled={pending || pin.length !== 6 || confirm.length !== 6}
        className="min-h-[48px] w-full rounded-2xl bg-sky-500 font-semibold text-white active:bg-sky-600 disabled:opacity-50"
      >
        {pending ? "Menyimpan…" : "Simpan PIN & Masuk"}
      </button>
    </form>
  );
}
