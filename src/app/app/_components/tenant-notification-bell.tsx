"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { actionListNotifications, actionMarkNotificationRead } from "./tenant-notification-actions";

type NotificationRow = { id: string; title: string; body: string; entityId: string | null; createdAt: string };

export function TenantNotificationBell() {
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [open, setOpen] = useState(false);
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
      if (!first.current && fresh.length) {
        // Browser audio autoplay policy is respected: visual badge/toast is the fallback.
        // Sound is intentionally opt-in in the next notification phase.
      }
      first.current = false;
    };
    void load();
    const timer = window.setInterval(() => { void load(); }, 15000);
    return () => { stopped = true; window.clearInterval(timer); };
  }, []);

  function markRead(id: string) {
    startTransition(async () => {
      await actionMarkNotificationRead(id);
      setRows((current) => current.filter((row) => row.id !== id));
    });
  }

  return (
    <div className="relative">
      <Button type="button" variant="ghost" size="icon" aria-label={`Notifikasi${rows.length ? `, ${rows.length} belum dibaca` : ""}`} onClick={() => setOpen((value) => !value)}>
        <Bell className="h-5 w-5" aria-hidden />
        {rows.length > 0 && <span className="absolute -right-0.5 -top-0.5 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{rows.length > 9 ? "9+" : rows.length}</span>}
      </Button>
      {open && <div className="absolute right-0 top-11 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-xl border bg-card p-3 shadow-xl">
        <div className="mb-2 flex items-center justify-between"><b className="text-sm">Notifikasi</b><span className="text-xs text-muted-foreground">{rows.length} baru</span></div>
        {rows.length === 0 ? <p className="p-4 text-center text-sm text-muted-foreground">Tidak ada booking baru.</p> : <div className="max-h-80 space-y-2 overflow-auto">{rows.map((row) => <button key={row.id} type="button" disabled={pending} onClick={() => markRead(row.id)} className="block w-full rounded-lg border p-3 text-left hover:bg-muted"><p className="text-sm font-semibold">{row.title}</p><p className="mt-1 text-xs text-muted-foreground">{row.body}</p><p className="mt-1 text-[11px] text-muted-foreground">{new Date(row.createdAt).toLocaleString("id-ID")}</p></button>)}</div>}
      </div>}
    </div>
  );
}
