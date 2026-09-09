"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { actionWaInit, actionWaStatus, actionWaLogout } from "./actions";

type Phase = "loading" | "connected" | "disconnected" | "connecting" | "error";

/** Format nomor WA dari gateway (mis. "628123456789") → "+62 812-3456-789" agar mudah dibaca. */
function formatWaPhone(raw: string): string {
  const d = String(raw).replace(/[^0-9]/g, "");
  if (!d) return raw;
  // Kelompokkan: kode negara (62) + sisa per 3-4 digit.
  const cc = d.startsWith("62") ? "62" : "";
  const rest = cc ? d.slice(2) : d;
  const groups = rest.match(/.{1,4}/g) ?? [rest];
  return `+${cc ? cc + " " : ""}${groups.join("-")}`;
}

/**
 * Hubungkan WhatsApp — tautkan nomor WA usaha ke gateway (scan QR sekali).
 * Alur: cek status → bila belum tersambung, tombol "Hubungkan" → init (QR) → poll tiap 3 dtk → "Tersambung".
 * Kunci gateway TIDAK pernah ke browser: semua via server action (externalId = tenantId dari sesi login).
 */
export function WaConnect() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [qr, setQr] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [error, setError] = useState<string>("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPoll = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  // Cek status awal saat komponen dibuka.
  const refreshStatus = useCallback(async () => {
    const r = await actionWaStatus();
    if (!r.ok) { setPhase("error"); setError(r.error ?? "Gagal memeriksa status"); return; }
    if (r.ready) { setPhase("connected"); setQr(null); setPhone(r.phone ?? null); stopPoll(); }
    else if (phase !== "connecting") { setPhase("disconnected"); }
  }, [phase, stopPoll]);

  useEffect(() => {
    void refreshStatus();
    return () => stopPoll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mulai proses tautkan: init → tampil QR → poll sampai ready.
  const handleConnect = useCallback(async () => {
    setPhase("connecting"); setError(""); setQr(null);
    const r = await actionWaInit();
    if (!r.ok) { setPhase("error"); setError(r.error ?? "Gagal memulai"); return; }
    if (r.ready) { setPhase("connected"); return; }
    if (r.qr) setQr(r.qr);
    stopPoll();
    pollRef.current = setInterval(async () => {
      const s = await actionWaStatus();
      if (!s.ok) return; // best-effort; jangan hentikan polling karena 1 gagal
      if (s.ready) { setPhase("connected"); setQr(null); setPhone(s.phone ?? null); stopPoll(); }
      else if (s.qr) setQr(s.qr); // QR di-refresh gateway ~tiap 60 dtk
    }, 3000);
  }, [stopPoll]);

  const handleLogout = useCallback(async () => {
    if (!confirm("Putuskan WhatsApp? Pesan otomatis berhenti sampai Anda menautkan ulang.")) return;
    const r = await actionWaLogout();
    if (!r.ok) { setError(r.error ?? "Gagal memutuskan"); return; }
    setPhase("disconnected"); setQr(null); setPhone(null);
  }, []);

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Hubungkan WhatsApp</h2>
            <p className="text-sm text-muted-foreground">
              Tautkan nomor WhatsApp usaha agar pengingat servis & notifikasi terkirim otomatis ke pelanggan.
            </p>
          </div>
          {phase === "connected" && <Badge className="shrink-0 bg-emerald-600 hover:bg-emerald-600">Tersambung</Badge>}
          {(phase === "disconnected" || phase === "connecting") && <Badge variant="secondary" className="shrink-0">Belum tersambung</Badge>}
        </div>

        {phase === "loading" && <p className="text-sm text-muted-foreground">Memeriksa status…</p>}

        {phase === "connected" && (
          <div className="space-y-3">
            <p className="text-sm text-emerald-700 dark:text-emerald-400">
              WhatsApp usaha Anda aktif. Pesan otomatis siap terkirim.
            </p>
            {phone && (
              <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Nomor tertaut:</span>
                <span className="font-semibold text-foreground">{formatWaPhone(phone)}</span>
              </div>
            )}
            <Button variant="outline" size="sm" onClick={handleLogout}>Putuskan</Button>
          </div>
        )}

        {phase === "disconnected" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Belum ada nomor WhatsApp tertaut.</p>
            <Button size="sm" onClick={handleConnect}>Hubungkan WhatsApp</Button>
          </div>
        )}

        {phase === "connecting" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-700 dark:border-sky-900/40 dark:bg-sky-950/30 dark:text-sky-300">
              <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" aria-hidden />
              <span>{qr ? "Menunggu Anda memindai kode di HP…" : "Menyiapkan kode QR…"}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Buka WhatsApp di HP nomor usaha → <b>Perangkat Tertaut</b> → <b>Tautkan Perangkat</b> → pindai kode di bawah.
            </p>
            {qr ? (
              <div className="inline-block rounded-xl border bg-white p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} alt="QR WhatsApp" width={264} height={264} />
              </div>
            ) : (
              <div className="flex h-[288px] w-[288px] items-center justify-center rounded-xl border border-dashed bg-muted/30">
                <span className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/40 border-t-transparent" aria-hidden />
              </div>
            )}
            <p className="text-xs text-muted-foreground">Kode menyegar otomatis. Halaman akan berubah jadi “Tersambung” begitu berhasil.</p>
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
