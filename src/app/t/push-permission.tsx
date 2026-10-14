"use client";

/**
 * Ijin notifikasi push untuk perangkat teknisi (PWA /t).
 *
 * FASE 1 (keputusan pemilik 2026-10-14): notifikasi PENUGASAN.
 * Logika murni dipisah ke src/lib/push-client.ts (diuji); komponen ini hanya
 * wiring browser API + server action (jalur /t yang sudah ada).
 *
 * UX jujur (sesuai pola TenantNotificationBell + standar "bukan aplikasi
 * asal jadi"): TIDAK memaksa otomatis — teknisi TEKAN tombol sekali; setelah
 * itu tiap kali membuka /t, otomatis aktif (klik browser meminta izin).
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getOrCreateDeviceId,
  pushStatusLabel,
  subscriptionToInput,
  urlBase64ToUint8Array,
  type PushStatusLabel,
} from "@/lib/push-client";
import { techEnablePush, techPushVapidKey } from "./actions";

const SW_PATH = "/sw.js";
const LABEL: Record<PushStatusLabel, string> = {
  checking: "Memeriksa notifikasi…",
  "not-supported": "Perangkat ini belum mendukung notifikasi",
  "permission-denied": "Notifikasi diblokir — aktifkan lewat pengaturan browser",
  "server-disabled": "Notifikasi disiapkan sistem (belum aktif)",
  inactive: "Aktifkan notifikasi tugas",
  active: "Notifikasi tugas aktif",
};

export function PushPermission() {
  const [status, setStatus] = useState<PushStatusLabel>("checking");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  // Klik notifikasi dari tab lain/SW: fokus + MUAT ULANG data halaman ini —
  // teknisi tak boleh refresh manual (world-class: state selalu segar
  // saat dibuka dari notificationclick; sw.js mengirim {aircon:open-url}).
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const d = event.data as { type?: string; url?: string } | null;
      if (d?.type === "aircon:open-url" && typeof d.url === "string") {
        router.push(d.url);
        // refresh: tarik data terbaru (job list) tanpa reload penuh.
        router.refresh();
      }
    };
    navigator.serviceWorker?.addEventListener("message", onMessage);
    return () => navigator.serviceWorker?.removeEventListener("message", onMessage);
  }, [router]);

  // Pola TenantNotificationBell (sudah lulus eslint): isi effect dipanggil via
  // void load() (fungsi async lokal), bukan useCallback eksternal.
  useEffect(() => {
    let stopped = false;
    const load = async () => {
      if (typeof window === "undefined" || !("Notification" in window)) {
        setStatus("not-supported");
        return;
      }
      const res = await techPushVapidKey();
      if (stopped) return;
      if (!res.ok || !res.vapidPublicKey) {
        setStatus(res.ok ? "server-disabled" : "permission-denied");
        return;
      }
      // Pastikan SW terdaftar utk bisa mengecek subscription aktif.
      if ("serviceWorker" in navigator) {
        try { await navigator.serviceWorker.register(SW_PATH, { scope: "/" }); } catch { /* biarkan */ }
      }
      const reg = await navigator.serviceWorker.ready.catch(() => null);
      const sub = reg?.pushManager?.getSubscription ? await reg.pushManager.getSubscription() : null;
      if (stopped) return;
      setStatus(
        pushStatusLabel({
          notificationSupported: true,
          permission: Notification.permission,
          subscriptionActive: Boolean(sub),
          serverVapidAvailable: true,
        }),
      );
    };
    void load();
    return () => { stopped = true; };
  }, []);

  async function enable() {
    if (busy) return;
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "permission-denied" : "inactive");
        return;
      }
      const res = await techPushVapidKey();
      if (!res.ok || !res.vapidPublicKey) {
        setStatus("server-disabled");
        return;
      }
      if (!("serviceWorker" in navigator)) { setStatus("not-supported"); return; }
      const reg = await navigator.serviceWorker.register(SW_PATH, { scope: "/" });
      // applicationServerKey butuh ArrayBuffer (bukan Uint8Array generik).
      const key = urlBase64ToUint8Array(res.vapidPublicKey);
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key.buffer.slice(key.byteOffset, key.byteOffset + key.byteLength) as ArrayBuffer,
      });
      const json = sub.toJSON();
      // PushSubscriptionJSON.endpoint bertipe string|undefined — validasi eksplisit.
      if (typeof json.endpoint !== "string") { setStatus("inactive"); return; }
      const input = subscriptionToInput({ endpoint: json.endpoint, keys: json.keys ?? null });
      if (!input) { setStatus("inactive"); return; }
      const saved = await techEnablePush({
        deviceId: getOrCreateDeviceId(),
        subscription: input,
        userAgent: navigator.userAgent,
      });
      if (!saved.ok) { setStatus("permission-denied"); return; }
      setStatus("active");
    } catch {
      setStatus("inactive");
    } finally { setBusy(false); }
  }

  if (status === "checking") return null;

  if (status === "active") {
    // World-class: setelah aktif TIDAK ada tindakan tersisa di header →
    // cukup indikator ringkas (icon saja), teks panjang hanya muncul bila
    // BUTUH TINDAKAN (belum aktif) — header tak lagi penuh sesak.
    return (
      <span
        className="flex items-center text-emerald-600"
        role="status"
        aria-label={LABEL.active}
        title={LABEL.active}
      >
        <BellRing className="h-5 w-5" aria-hidden />
      </span>
    );
  }

  if (status === "not-supported" || status === "permission-denied" || status === "server-disabled") {
    return (
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <BellOff className="h-3.5 w-3.5" aria-hidden /> {LABEL[status]}
      </p>
    );
  }

  return (
    <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void enable()}>
      <BellRing className="mr-2 h-3.5 w-3.5" aria-hidden />
      {LABEL.inactive}
    </Button>
  );
}
