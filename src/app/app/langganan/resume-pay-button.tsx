"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { resumePayment } from "./actions";

/** Muat Snap.js dari config server (env sama dgn token) — sama dgn plan-cards. */

/**
 * Tombol "Bayar Sekarang" (PENDING) / "Ulangi" (FAILED/EXPIRED) untuk transaksi belum lunas.
 * Semua pembayaran menggunakan redirect iPaymu.
 */
export function ResumePayButton({ orderId, label }: { orderId: string; label: string }) {
  const [pending, start] = useTransition();

  function onClick() {
    start(async () => {
      const res = await resumePayment(orderId);
      if (!res.ok) { alert(res.error); return; }
      if (res.kind === "paid") {
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = "/app/langganan?status=sukses";
        return;
      }
      if (res.kind === "resume" && res.redirectUrl) {
        window.location.href = res.redirectUrl;
        return;
      }
      alert("URL pembayaran iPaymu tidak tersedia.");
    });
  }

  return (
    <Button type="button" size="xs" variant="default" disabled={pending} onClick={onClick}
      className="bg-sky-600 text-white hover:bg-sky-700">
      {pending ? "Memproses…" : label}
    </Button>
  );
}
