"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { startPayment, previewCheckout } from "./actions";
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

const rp = (n: number) => "Rp" + n.toLocaleString("id-ID");

export function PlanCards({
  plans,
  currentPlan,
  canPay,
}: {
  plans: PlanView[];
  currentPlan: TenantPlan;
  canPay: boolean;
}) {
  const [months, setMonths] = useState(1);
  // Paket yang dipilih untuk checkout (null = belum pilih). Kupon di-scope ke paket ini.
  const [selected, setSelected] = useState<PlanView | null>(null);

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
                <Button
                  type="button"
                  disabled={!canPay || p.isFree}
                  onClick={() => setSelected(p)}
                  className="mt-5 min-h-[44px]"
                >
                  {p.isFree ? "Paket Coba" : isCurrent ? "Perpanjang" : "Pilih Paket"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Ringkasan checkout untuk paket yang dipilih — kupon di-scope ke paket + durasi ini. */}
      {selected && (
        <CheckoutSheet
          plan={selected}
          months={months}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function CheckoutSheet({
  plan,
  months,
  onClose,
}: {
  plan: PlanView;
  months: number;
  onClose: () => void;
}) {
  const [coupon, setCoupon] = useState("");
  // Rincian harga LENGKAP dari server (satu sumber kebenaran). null = sedang memuat.
  const [bd, setBd] = useState<
    | { base: number; discount: number; subtotal: number; taxPercent: number; taxAmount: number; total: number;
        couponCode: string | null; recurring: boolean; recurringMonths: number | null; couponError: string | null }
    | null
  >(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [loading, startLoad] = useTransition();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  // Ambil rincian harga dari server. code opsional (kupon manual).
  const load = useCallback((code?: string) => {
    setLoadErr(null);
    startLoad(async () => {
      const res = await previewCheckout(plan.id, months, code);
      if (!res.ok) { setLoadErr(res.error); setBd(null); return; }
      setBd({
        base: res.base, discount: res.discount, subtotal: res.subtotal, taxPercent: res.taxPercent,
        taxAmount: res.taxAmount, total: res.total, couponCode: res.couponCode,
        recurring: res.recurring, recurringMonths: res.recurringMonths, couponError: res.couponError,
      });
    });
  }, [plan.id, months]);

  // Muat rincian saat sheet dibuka / durasi berubah (tanpa kode → termasuk diskon recurring melekat).
  useEffect(() => { load(); }, [load]);

  function applyCoupon() {
    const code = coupon.trim();
    if (!code) return;
    load(code);
  }

  function pay() {
    setMsg(null);
    start(async () => {
      const res = await startPayment(plan.id, months, coupon.trim() || undefined);
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

  const recurText = bd?.recurring
    ? bd.recurringMonths == null
      ? " · berlaku untuk semua perpanjangan"
      : ` · berlaku ${bd.recurringMonths} periode`
    : "";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <Card className="w-full max-w-md rounded-b-none rounded-t-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <CardContent className="space-y-4 p-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold text-foreground">Langganan {plan.name}</h2>
              <p className="text-sm text-muted-foreground">Durasi {months} bulan</p>
            </div>
            <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-muted" aria-label="Tutup">
              <Icon.Close className="h-5 w-5" />
            </button>
          </div>

          {/* Kupon diskon (opsional) — untuk paket ini */}
          <div>
            <label htmlFor="coupon" className="mb-1.5 block text-sm text-muted-foreground">Punya kode diskon?</label>
            <div className="flex gap-2">
              <input
                id="coupon"
                value={coupon}
                onChange={(e) => setCoupon(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") applyCoupon(); }}
                placeholder="Masukkan kode"
                className="min-h-[44px] flex-1 rounded-xl border bg-background px-3 text-sm uppercase placeholder:normal-case"
              />
              <Button type="button" variant="outline" onClick={applyCoupon} disabled={loading || !coupon.trim()} className="min-h-[44px]">
                {loading ? "Memeriksa…" : "Pakai"}
              </Button>
            </div>
            {bd?.couponError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{bd.couponError}</p>}
            {bd && !bd.couponError && bd.discount > 0 && bd.couponCode && (
              <p className="mt-2 text-sm text-emerald-600 dark:text-emerald-400">Kupon {bd.couponCode} aktif{recurText}</p>
            )}
          </div>

          {/* Rincian harga — SEMUA dari server (satu sumber kebenaran). */}
          <div className="space-y-1.5 rounded-xl border bg-muted/40 p-4 text-sm">
            {loadErr ? (
              <p className="text-red-600 dark:text-red-400">{loadErr}</p>
            ) : !bd ? (
              <p className="text-muted-foreground">Memuat rincian…</p>
            ) : (
              <>
                <div className="flex justify-between text-muted-foreground">
                  <span>Harga {plan.name} ({months} bln)</span>
                  <span>{rp(bd.base)}</span>
                </div>
                {bd.discount > 0 && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                    <span>Diskon{bd.couponCode ? ` (${bd.couponCode})` : ""}</span>
                    <span>− {rp(bd.discount)}</span>
                  </div>
                )}
                {bd.taxAmount > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Pajak {bd.taxPercent}%</span>
                    <span>{rp(bd.taxAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-2 text-base font-bold text-foreground">
                  <span>Total</span>
                  <span>{rp(bd.total)}</span>
                </div>
              </>
            )}
          </div>

          {msg && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-400">{msg}</p>}

          <SubmitButton
            type="button"
            pending={pending}
            pendingLabel="Memproses…"
            onClick={pay}
            disabled={!bd || loading}
            className="w-full min-h-[48px]"
          >
            Lanjutkan Pembayaran{bd ? ` — ${rp(bd.total)}` : ""}
          </SubmitButton>
        </CardContent>
      </Card>
    </div>
  );
}
