"use client";

import { useState, useTransition } from "react";
import { startPayment } from "./actions";
import type { TenantPlan } from "@prisma/client";

interface PlanView {
  id: TenantPlan;
  name: string;
  price: string;
  tagline: string;
  highlights: string[];
}

// Muat Snap.js dari Midtrans saat dibutuhkan (client-key publik).
function loadSnap(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject();
    const w = window as unknown as { snap?: unknown };
    if (w.snap) return resolve();
    const clientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY;
    const isProd = process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === "true";
    const src = isProd
      ? "https://app.midtrans.com/snap/snap.js"
      : "https://app.sandbox.midtrans.com/snap/snap.js";
    const s = document.createElement("script");
    s.src = src;
    s.setAttribute("data-client-key", clientKey ?? "");
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Gagal memuat pembayaran"));
    document.head.appendChild(s);
  });
}

export function PlanCards({
  plans,
  currentPlan,
  canPay,
}: {
  plans: PlanView[];
  currentPlan: TenantPlan;
  canPay: boolean;
}) {
  const [pending, start] = useTransition();
  const [months, setMonths] = useState(1);
  const [msg, setMsg] = useState<string | null>(null);

  function subscribe(plan: TenantPlan) {
    setMsg(null);
    start(async () => {
      const res = await startPayment(plan, months);
      if (!res.ok) {
        setMsg(res.error);
        return;
      }
      try {
        await loadSnap();
        const w = window as unknown as {
          snap?: { pay: (token: string, opts: Record<string, unknown>) => void };
        };
        w.snap?.pay(res.snapToken, {
          onSuccess: () => (window.location.href = "/app/langganan?status=sukses"),
          onPending: () => (window.location.href = "/app/langganan?status=pending"),
          onError: () => setMsg("Pembayaran gagal. Coba lagi."),
          onClose: () => setMsg("Pembayaran dibatalkan."),
        });
      } catch {
        // fallback: redirect ke halaman pembayaran Midtrans
        window.location.href = res.redirectUrl;
      }
    });
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2 text-sm">
        <span className="text-slate-600">Durasi:</span>
        {[1, 3, 12].map((m) => (
          <button
            key={m}
            onClick={() => setMonths(m)}
            className={`rounded-lg px-3 py-1.5 font-medium ${months === m ? "bg-sky-500 text-white" : "border border-slate-300 text-slate-600"}`}
          >
            {m} bulan
          </button>
        ))}
      </div>

      {msg && <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{msg}</p>}

      <div className="grid gap-4 sm:grid-cols-3">
        {plans.map((p) => {
          const isCurrent = p.id === currentPlan;
          return (
            <div key={p.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900">{p.name}</h3>
              <p className="mt-1 text-sm text-slate-500">{p.tagline}</p>
              <div className="mt-3 text-2xl font-extrabold text-slate-900">
                {p.price}
                <span className="text-sm font-normal text-slate-500">/bln</span>
              </div>
              <ul className="mt-4 flex-1 space-y-2 text-sm text-slate-600">
                {p.highlights.map((h) => (
                  <li key={h} className="flex gap-2">
                    <span className="text-emerald-500">✓</span> {h}
                  </li>
                ))}
              </ul>
              <button
                disabled={!canPay || pending}
                onClick={() => subscribe(p.id)}
                className="mt-5 min-h-[44px] rounded-xl bg-sky-500 px-4 py-2.5 font-semibold text-white hover:bg-sky-600 disabled:opacity-50"
              >
                {isCurrent ? "Perpanjang" : "Pilih Paket"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
