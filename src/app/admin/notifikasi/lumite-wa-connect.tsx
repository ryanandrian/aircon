"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { actionLumiteWaInit, actionLumiteWaStatus, actionLumiteWaLogout } from "./actions";

type Phase = "loading" | "connected" | "disconnected" | "connecting" | "error";

function formatWaPhone(raw: string): string {
  const d = raw.replace(/[^0-9]/g, "");
  if (!d) return raw;
  const rest = d.startsWith("62") ? d.slice(2) : d;
  return `+62 ${[rest.slice(0, 3), rest.slice(3, 7), rest.slice(7)].filter(Boolean).join("-")}`;
}

/** Platform connection UI. externalId remains server-owned: lumite-platform. */
export function LumiteWaConnect() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [qr, setQr] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [authenticating, setAuthenticating] = useState(false);
  const [error, setError] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPoll = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const r = await actionLumiteWaStatus();
      if (cancelled) return;
      if (!r.ok) { setPhase("error"); setError(r.error ?? "Gagal memeriksa status"); return; }
      setPhone(r.phone ?? null);
      if (r.ready) { setPhase("connected"); setQr(null); setAuthenticating(false); stopPoll(); }
      else if (r.authenticating) { setPhase("connecting"); setQr(null); setAuthenticating(true); }
      else if (r.qr) { setPhase("connecting"); setQr(r.qr); setAuthenticating(false); }
      else setPhase("disconnected");
    };
    queueMicrotask(() => { void check(); });
    return () => { cancelled = true; stopPoll(); };
  }, [stopPoll]);

  const handleConnect = useCallback(async () => {
    setPhase("connecting"); setError(""); setQr(null); setAuthenticating(false);
    const r = await actionLumiteWaInit();
    if (!r.ok) { setPhase("error"); setError(r.error ?? "Gagal memulai"); return; }
    if (r.ready) { setPhase("connected"); return; }
    if (r.qr) setQr(r.qr);
    stopPoll();
    pollRef.current = setInterval(async () => {
      const s = await actionLumiteWaStatus();
      if (!s.ok) return;
      setPhone(s.phone ?? null);
      if (s.ready) { setPhase("connected"); setQr(null); setAuthenticating(false); stopPoll(); }
      else if (s.authenticating) { setPhase("connecting"); setQr(null); setAuthenticating(true); }
      else if (s.qr) { setPhase("connecting"); setQr(s.qr); setAuthenticating(false); }
    }, 3000);
  }, [stopPoll]);

  const handleLogout = useCallback(async () => {
    if (!confirm("Putuskan WhatsApp Lumite? Notifikasi platform via WA berhenti sampai ditautkan ulang.")) return;
    const r = await actionLumiteWaLogout();
    if (!r.ok) { setError(r.error ?? "Gagal memutuskan"); return; }
    stopPoll(); setPhase("disconnected"); setQr(null); setPhone(null); setAuthenticating(false);
  }, [stopPoll]);

  return (
    <Card><CardContent className="space-y-4 p-5">
      <div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">WhatsApp Lumite (Nomor Platform)</h2><p className="text-sm text-muted-foreground">Satu nomor Lumite untuk mengirim notifikasi ke semua tenant. Terpisah dari nomor WhatsApp usaha.</p></div>{phase === "connected" && <Badge className="shrink-0 bg-emerald-600 hover:bg-emerald-600">Tersambung</Badge>}{(phase === "disconnected" || phase === "connecting") && <Badge variant="secondary" className="shrink-0">{authenticating ? "Menyiapkan sesi…" : "Belum tersambung"}</Badge>}</div>
      {phase === "loading" && <p className="text-sm text-muted-foreground">Memeriksa status…</p>}
      {phase === "connected" && <div className="space-y-3"><p className="text-sm text-emerald-700 dark:text-emerald-400">Nomor Lumite aktif dan siap mengirim notifikasi.</p>{phone && <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm"><span className="text-muted-foreground">Nomor tertaut: </span><b>{formatWaPhone(phone)}</b></div>}<Button variant="outline" size="sm" onClick={handleLogout}>Putuskan</Button></div>}
      {phase === "disconnected" && <div className="space-y-3"><p className="text-sm text-muted-foreground">Belum ada nomor Lumite tertaut.</p><Button size="sm" onClick={handleConnect}>Hubungkan WhatsApp Lumite</Button></div>}
      {phase === "connecting" && <div className="space-y-3"><p className="text-sm text-muted-foreground">{authenticating ? "Berhasil dipindai — menyiapkan sesi WhatsApp…" : "Buka WhatsApp → Perangkat Tertaut → Tautkan Perangkat → pindai kode."}</p>{qr ? <div className="inline-block rounded-xl border bg-white p-3">
   {/* eslint-disable-next-line @next/next/no-img-element -- QR data URL harus ditampilkan langsung dari gateway */}
   <img src={qr} alt="QR WhatsApp Lumite" width={264} height={264} />
 </div> : <p className="text-sm text-muted-foreground">{authenticating ? "Tunggu beberapa detik, status akan berubah otomatis." : "Menyiapkan kode QR…"}</p>}<Button variant="ghost" size="sm" onClick={() => { stopPoll(); setPhase("disconnected"); setQr(null); }}>Batal</Button></div>}
      {phase === "error" && <div className="space-y-3"><p className="text-sm text-destructive">{error || "Terjadi kesalahan."}</p><Button size="sm" onClick={handleConnect}>Coba lagi</Button></div>}
    </CardContent></Card>
  );
}
