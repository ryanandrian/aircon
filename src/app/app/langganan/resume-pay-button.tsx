"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { resumePayment } from "./actions";

/** Muat Snap.js dari config server (env sama dgn token) — sama dgn plan-cards. */
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

/**
 * Tombol "Bayar Sekarang" (PENDING) / "Ulangi" (FAILED/EXPIRED) untuk transaksi belum lunas.
 * Memanggil resumePayment → reuse token bila hidup / transaksi baru bila mati (best-practice Midtrans).
 */
export function ResumePayButton({ orderId, label }: { orderId: string; label: string }) {
  const [pending, start] = useTransition();

  function onClick() {
    start(async () => {
      const res = await resumePayment(orderId);
      if (!res.ok) { alert(res.error); return; }
      if (res.kind === "paid") {
        // Sudah lunas (ternyata sudah dibayar) → segarkan halaman menampilkan status terbaru.
        window.location.href = "/app/langganan?status=sukses";
        return;
      }
      try {
        await loadSnap(res.client.snapUrl, res.client.clientKey);
        const w = window as unknown as { snap?: { pay: (t: string, o: Record<string, unknown>) => void } };
        w.snap?.pay(res.snapToken, {
          onSuccess: () => (window.location.href = "/app/langganan?status=sukses"),
          onPending: () => (window.location.href = "/app/langganan?status=pending"),
          onError: () => alert("Pembayaran gagal. Coba lagi."),
          onClose: () => { /* biarkan; transaksi tetap tertunda & bisa dilanjutkan lagi */ },
        });
      } catch {
        window.location.href = res.redirectUrl;
      }
    });
  }

  return (
    <Button type="button" size="xs" variant="default" disabled={pending} onClick={onClick}
      className="bg-sky-600 text-white hover:bg-sky-700">
      {pending ? "Memproses…" : label}
    </Button>
  );
}
