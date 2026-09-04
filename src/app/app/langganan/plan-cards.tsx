"use client";

import { useState, useTransition } from "react";
import { startPayment } from "./actions";
import { Icon } from "@/components/icons";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import type { TenantPlan } from "@prisma/client";

interface PlanView {
  id: TenantPlan;
  name: string;
  price: string;
  priceWithTax: string;
  taxNote: string;
  tagline: string;
  quotas: string[];
  isFree: boolean;
}

// Muat Snap.js dari config yang DIBERIKAN SERVER (env yang sama dgn pencetak token).
// TIDAK memutuskan env sendiri → mustahil melenceng dari token.
function loadSnap(snapUrl: string, clientKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject();
    const w = window as unknown as { snap?: unknown };
    if (w.snap) return resolve();
    const s = document.createElement("script");
    s.src = snapUrl;
    s.setAttribute("data-client-key", clientKey);
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
        await loadSnap(res.client.snapUrl, res.client.clientKey);
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
        window.location.href = res.redirectUrl;
      }
    });
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Durasi:</span>
        {[1, 3, 12].map((m) => (
          <Button
            key={m}
            type="button"
            variant={months === m ? "default" : "outline"}
            size="sm"
            onClick={() => setMonths(m)}
          >
            {m} bulan
          </Button>
        ))}
      </div>

      {msg && <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-400">{msg}</p>}

      <div className="grid gap-4 sm:grid-cols-3">
        {plans.map((p) => {
          const isCurrent = p.id === currentPlan;
          return (
            <Card key={p.id} className="flex flex-col">
              <CardContent className="flex flex-1 flex-col p-5">
                <h3 className="text-lg font-bold text-foreground">{p.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{p.tagline}</p>
                <div className="mt-3 text-2xl font-extrabold text-foreground">
                  {p.price}
                  {!p.isFree && <span className="text-sm font-normal text-muted-foreground">/bln</span>}
                </div>
                {p.taxNote && <p className="text-xs text-muted-foreground">{p.taxNote} · {p.priceWithTax}/bln</p>}
                <ul className="mt-4 flex-1 space-y-2 text-sm text-muted-foreground">
                  {p.quotas.map((q) => (
                    <li key={q} className="flex gap-2">
                      <Icon.Check className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden /> {q}
                    </li>
                  ))}
                  <li className="flex gap-2">
                    <Icon.Check className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden /> Semua fitur
                  </li>
                </ul>
                <SubmitButton
                  type="button"
                  disabled={!canPay || p.isFree}
                  pending={pending}
                  pendingLabel="Memproses…"
                  onClick={() => subscribe(p.id)}
                  className="mt-5 min-h-[44px]"
                >
                  {p.isFree ? "Paket Coba" : isCurrent ? "Perpanjang" : "Pilih Paket"}
                </SubmitButton>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
