"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { actionLumiteWaInit, actionLumiteWaStatus, actionLumiteWaLogout } from "./actions";

type Phase = "loading" | "connected" | "disconnected" | "connecting" | "error";

/**
 * Hubungkan WhatsApp LUMITE (sesi lumite-platform) — 1 nomor untuk notif platform → tenant.
 * Pola sama dengan halaman tenant: init → QR → poll tiap 3 dtk → Tersambung. Kunci gateway server-side.
 */
export function LumiteWaConnect() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPoll = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  const refreshStatus = useCallback(async () => {
    const r = await actionLumiteWaStatus();
    if (!r.ok) { setPhase("error"); setError(r.error ?? "Gagal memeriksa status"); return; }
    if (r.ready) { setPhase("connected"); setQr(null); stopPoll(); }
    else setPhase((p) => (p === "connecting" ? p : "disconnected"));
  }, [stopPoll]);

  useEffect(() => {
    void refreshStatus();
    return () => stopPoll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConnect = useCallback(async () => {
    setPhase("connecting"); setError(""); setQr(null);
    const r = await actionLumiteWaInit();
    if (!r.ok) { setPhase("error"); setError(r.error ?? "Gagal memulai"); return; }
    if (r.ready) { setPhase("connected"); return; }
    if (r.qr) setQr(r.qr);
    stopPoll();
    pollRef.current = setInterval(async () => {
      const s = await actionLumiteWaStatus();
      if (!s.ok) return;
      if (s.ready) { setPhase("connected"); setQr(null); stopPoll(); }
      else if (s.qr) setQr(s.qr);
    }, 3000);
  }, [stopPoll]);

  const handleLogout = useCallback(async () => {
    if (!confirm("Putuskan WhatsApp Lumite? Notifikasi platform via WA berhenti sampai ditautkan ulang.")) return;
    const r = await actionLumiteWaLogout();
    if (!r.ok) { setError(r.error ?? "Gagal memutuskan"); return; }
    setPhase("disconnected"); setQr(null);
  }, []);

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">WhatsApp Lumite (Nomor Platform)</h2>
            <p className="text-sm text-muted-foreground">
              Satu nomor Lumite untuk mengirim notifikasi ke semua tenant (tagihan, sambutan, peringatan).
              Terpisah dari nomor WhatsApp masing-masing usaha.
            </p>
          </div>
          {phase === "connected" && <Badge className="shrink-0 bg-emerald-600 hover:bg-emerald-600">Tersambung</Badge>}
          {(phase === "disconnected" || phase === "connecting") && <Badge variant="secondary" className="shrink-0">Belum tersambung</Badge>}
        </div>

        {phase === "loading" && <p className="text-sm text-muted-foreground">Memeriksa status…</p>}

        {phase === "connected" && (
          <div className="space-y-3">
            <p className="text-sm text-emerald-700 dark:text-emerald-400">Nomor Lumite aktif. Notifikasi platform via WhatsApp siap terkirim.</p>
            <Button variant="outline" size="sm" onClick={handleLogout}>Putuskan</Button>
          </div>
        )}

        {phase === "disconnected" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Belum ada nomor Lumite tertaut.</p>
            <Button size="sm" onClick={handleConnect}>Hubungkan WhatsApp Lumite</Button>
          </div>
        )}

        {phase === "connecting" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Buka WhatsApp di HP nomor Lumite → <b>Perangkat Tertaut</b> → <b>Tautkan Perangkat</b> → pindai kode.
            </p>
            {qr ? (
              <div className="inline-block rounded-xl border bg-white p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} alt="QR WhatsApp Lumite" width={264} height={264} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Menyiapkan kode QR…</p>
            )}
            <p className="text-xs text-muted-foreground">Kode menyegar otomatis. Berubah jadi “Tersambung” begitu berhasil.</p>
            <div>
              <Button variant="ghost" size="sm" onClick={() => { stopPoll(); setPhase("disconnected"); setQr(null); }}>Batal</Button>
            </div>
          </div>
        )}

        {phase === "error" && (
          <div className="space-y-3">
            <p className="text-sm text-destructive">{error || "Terjadi kesalahan."}</p>
            <Button size="sm" onClick={handleConnect}>Coba lagi</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
