"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { actionListNotifications, actionMarkNotificationRead } from "./tenant-notification-actions";

type NotificationRow = { id: string; title: string; body: string; entityId: string | null; createdAt: string };

export function TenantNotificationBell() {
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [open, setOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => typeof window !== "undefined" && window.localStorage.getItem("aircon-notification-sound") === "1");
  const [browserEnabled, setBrowserEnabled] = useState(() => typeof window !== "undefined" && window.localStorage.getItem("aircon-notification-browser") === "1");
  const [pending, startTransition] = useTransition();
  const known = useRef(new Set<string>());
  const first = useRef(true);

  useEffect(() => {
    let stopped = false;
    const load = async () => {
      const result = await actionListNotifications(true);
      if (stopped || !result.ok) return;
      const fresh = result.rows.filter((row: NotificationRow) => !known.current.has(row.id));
      result.rows.forEach((row: NotificationRow) => known.current.add(row.id));
      setRows(result.rows);
      if (!first.current && fresh.length && soundEnabled) {
        const audio = new AudioContext(); const oscillator = audio.createOscillator(); const gain = audio.createGain();
        oscillator.frequency.value = 880; gain.gain.value = 0.04; oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(); oscillator.stop(audio.currentTime + 0.12);
      }
      if (!first.current && fresh.length && browserEnabled && "Notification" in window && Notification.permission === "granted") new Notification(fresh[0].title, { body: fresh[0].body });
      first.current = false;
    };
    void load();
    const timer = window.setInterval(() => { void load(); }, 15000);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [browserEnabled, soundEnabled]);

  function enableSound() {
    const audio = new AudioContext();
    void audio.resume().then(() => { audio.close(); window.localStorage.setItem("aircon-notification-sound", "1"); setSoundEnabled(true); });
  }

  async function enableBrowser() {
    if (!("Notification" in window)) return;
    const permission = await Notification.requestPermission();
    const enabled = permission === "granted";
    window.localStorage.setItem("aircon-notification-browser", enabled ? "1" : "0"); setBrowserEnabled(enabled);
  }

  function markRead(id: string) { startTransition(async () => { await actionMarkNotificationRead(id); setRows((current) => current.filter((row) => row.id !== id)); }); }

  return <div className="relative">
    <Button type="button" variant="ghost" size="icon" aria-label={`Notifikasi${rows.length ? `, ${rows.length} belum dibaca` : ""}`} onClick={() => setOpen((value) => !value)}>
      <Bell className="h-5 w-5" aria-hidden />
      {rows.length > 0 && <span className="absolute -right-0.5 -top-0.5 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{rows.length > 9 ? "9+" : rows.length}</span>}
    </Button>
    {open && <div className="fixed right-2 top-16 z-50 w-[calc(100vw-1rem)] max-w-sm rounded-xl border bg-card p-3 shadow-xl">
      <div className="mb-2 flex items-center justify-between"><b className="text-sm">Notifikasi</b><span className="text-xs text-muted-foreground">{rows.length} baru</span></div>
      <div className="mb-3 flex flex-wrap gap-2 border-b pb-3">{!soundEnabled && <Button type="button" size="sm" variant="outline" onClick={enableSound}>Aktifkan suara</Button>}{!browserEnabled && <Button type="button" size="sm" variant="outline" onClick={() => void enableBrowser()}>Aktifkan notifikasi browser</Button>}</div>
      {rows.length === 0 ? <p className="p-4 text-center text-sm text-muted-foreground">Tidak ada booking baru.</p> : <div className="max-h-80 space-y-2 overflow-auto">{rows.map((row) => <button key={row.id} type="button" disabled={pending} onClick={() => markRead(row.id)} className="block w-full rounded-lg border p-3 text-left hover:bg-muted"><p className="text-sm font-semibold">{row.title}</p><p className="mt-1 text-xs text-muted-foreground">{row.body}</p><p className="mt-1 text-[11px] text-muted-foreground">{new Date(row.createdAt).toLocaleString("id-ID")}</p></button>)}</div>}
    </div>}
  </div>;
}
