"use client";
import { useEffect } from "react";

/** Beacon kunjungan — kirim 1x saat landing dibuka. Best-effort, tak menghalangi UI. */
export function VisitBeacon() {
  useEffect(() => {
    // sessionStorage → hindari kirim berulang saat navigasi klien dalam sesi yang sama.
    try {
      if (sessionStorage.getItem("aircon_visited")) return;
      sessionStorage.setItem("aircon_visited", "1");
    } catch {
      // storage bisa diblokir; tetap lanjut kirim (server tetap idempoten per IP/hari)
    }
    const path = typeof window !== "undefined" ? window.location.pathname : "/";
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
      keepalive: true,
    }).catch(() => {});
  }, []);
  return null;
}
