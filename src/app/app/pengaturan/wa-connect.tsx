"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { actionWaInit, actionWaPair, actionWaPairCancel, actionWaStatus, actionWaLogout } from "./actions";

type Phase = "loading" | "connected" | "disconnected" | "connecting" | "error";

/** Format nomor WA dari gateway (mis. "6281319150260") → "+62 813-1915-0260" agar mudah dibaca. */
function formatWaPhone(raw: string): string {
  const d = String(raw).replace(/[^0-9]/g, "");
  if (!d) return raw;
  if (!d.startsWith("62")) return `+${d}`;
  const rest = d.slice(2); // tanpa kode negara
  // Kelompokkan gaya nomor HP Indonesia: 3 - 4 - sisa (mis. 813 1915 0260).
  const a = rest.slice(0, 3);
  const b = rest.slice(3, 7);
  const c = rest.slice(7);
  return `+62 ${[a, b, c].filter(Boolean).join("-")}`;
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
  const [authenticating, setAuthenticating] = useState(false);
  const [error, setError] = useState<string>("");
  const [connectionMode, setConnectionMode] = useState<"qr" | "pairing">("qr");
  const [pairing, setPairing] = useState(false);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [pairingPhone, setPairingPhone] = useState("");
  const [pairingBusy, setPairingBusy] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPoll = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const r = await actionWaStatus();
        if (cancelled) return;
        if (!r.ok) { setPhase("error"); setError(r.error ?? "Gagal memeriksa status"); return; }
        if (r.ready) { setPhase("connected"); setQr(null); setPhone(r.phone ?? null); setPairing(false); setPairingCode(null); stopPoll(); }
        else { setPairing(Boolean(r.pairing)); setPairingCode(r.pairingCode ?? null); setPhase((p) => (p === "connecting" ? p : "disconnected")); }
      } catch {
        if (!cancelled) { setPhase("error"); setError("Gagal memeriksa status"); }
      }
    };
    void check();
    return () => { cancelled = true; stopPoll(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mulai proses tautkan: init → tampil QR → poll sampai ready.
  const handleConnect = useCallback(async () => {
    setConnectionMode("qr");
    setPhase("connecting"); setError(""); setQr(null); setAuthenticating(false); setPairing(false); setPairingCode(null);
    const r = await actionWaInit();
    if (!r.ok) { setPhase("error"); setError(r.error ?? "Gagal memulai"); return; }
    if (r.ready) { setPhase("connected"); return; }
    if (r.qr) setQr(r.qr);
    stopPoll();
    pollRef.current = setInterval(async () => {
      const s = await actionWaStatus();
      if (s.conflict) { stopPoll(); setPhase("error"); setError(s.error ?? "Nomor WhatsApp sudah terdaftar."); return; }
      if (!s.ok) return; // best-effort; jangan hentikan polling karena 1 gagal
      if (s.ready) { setPhase("connected"); setQr(null); setPhone(s.phone ?? null); setPairing(false); setPairingCode(null); stopPoll(); }
      else if (s.pairing) { setPairing(true); setPairingCode(s.pairingCode ?? null); setQr(null); }
      else if (s.authenticating) { setAuthenticating(true); setQr(null); } // dipindai → menyiapkan sesi
      else if (s.qr) { setPairing(false); setPairingCode(null); setQr(s.qr); setAuthenticating(false); } // QR di-refresh gateway ~tiap 60 dtk
    }, 3000);
  }, [stopPoll]);

  const handlePair = useCallback(async () => {
    setConnectionMode("pairing");
    setPairingBusy(true); setError(""); setPhase("connecting"); setPairing(true); setQr(null); setAuthenticating(false);
    const r = await actionWaPair(pairingPhone);
    setPairingBusy(false);
    if (!r.ok) { setPairing(false); setPhase("error"); setError(r.error ?? "Gagal meminta kode tautan"); return; }
    setPairingCode(r.pairingCode ?? null);
    if (r.ready) { setPhase("connected"); setPhone(r.phone ?? null); setPairing(false); stopPoll(); return; }
    stopPoll();
    pollRef.current = setInterval(async () => {
      const s = await actionWaStatus();
      if (s.conflict) { stopPoll(); setPhase("error"); setPairing(false); setError(s.error ?? "Nomor WhatsApp sudah terdaftar."); return; }
      if (!s.ok) return;
      if (s.ready) { setPhase("connected"); setPhone(s.phone ?? null); setPairing(false); setPairingCode(null); stopPoll(); }
      else if (s.pairing) { setPairingCode(s.pairingCode ?? null); }
    }, 3000);
  }, [pairingPhone, stopPoll]);
  const handlePairCancel = useCallback(async () => {
    stopPoll();
    const r = await actionWaPairCancel();
    if (!r.ok) { setError(r.error ?? "Gagal membatalkan pairing"); return; }
    setPhase("disconnected"); setPairing(false); setPairingCode(null);
  }, [stopPoll]);

  const handleLogout = useCallback(async () => {
    if (!confirm("Putuskan WhatsApp? Pesan otomatis berhenti sampai Anda menautkan ulang.")) return;
    const r = await actionWaLogout();
    if (!r.ok) { setError(r.error ?? "Gagal memutuskan"); return; }
    stopPoll(); setPhase("disconnected"); setQr(null); setPhone(null); setAuthenticating(false); setPairing(false); setPairingCode(null);
  }, [stopPoll]);

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
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Belum ada nomor WhatsApp tertaut.</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={handleConnect}>Hubungkan dengan QR</Button>
              <Button variant="outline" size="sm" onClick={() => { setConnectionMode("pairing"); setPhase("connecting"); setError(""); setQr(null); }}>Gunakan kode tautan (HP saja)</Button>
            </div>
          </div>
        )}

        {phase === "connecting" && connectionMode === "pairing" && !pairing && !authenticating && (
          <div className="space-y-3 rounded-lg border p-3">
            <p className="text-sm font-medium">Hubungkan dari satu HP</p>
            <p className="text-xs text-muted-foreground">Masukkan nomor WhatsApp usaha dalam format internasional, misalnya 6281234567890.</p>
            <div className="flex gap-2">
              <input className="h-9 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm" inputMode="tel" placeholder="6281234567890" value={pairingPhone} onChange={(e) => setPairingPhone(e.target.value)} />
              <Button size="sm" disabled={pairingBusy || !pairingPhone.trim()} onClick={handlePair}>{pairingBusy ? "Menyiapkan…" : "Dapatkan kode"}</Button>
            </div>
            <p className="text-xs text-muted-foreground">Di WhatsApp HP: Perangkat Tertaut → Tautkan Perangkat → Tautkan dengan nomor telepon.</p>
            <Button variant="ghost" size="sm" onClick={() => { stopPoll(); setPhase("disconnected"); }}>Kembali</Button>
          </div>
        )}

        {phase === "connecting" && pairing && (
          <div className="space-y-3 rounded-lg border border-sky-200 bg-sky-50 p-4 dark:border-sky-900/40 dark:bg-sky-950/20">
            <p className="text-sm font-medium">Kode tautan WhatsApp</p>
            {pairingCode ? <p className="rounded-md bg-background px-3 py-3 text-center font-mono text-2xl font-bold tracking-[0.3em]">{pairingCode}</p> : <p className="text-sm text-muted-foreground">Menyiapkan kode…</p>}
            <p className="text-xs text-muted-foreground">Masukkan kode ini di WhatsApp HP nomor usaha. Halaman akan berubah otomatis setelah tersambung.</p>
            <Button variant="ghost" size="sm" onClick={handlePairCancel}>Batal</Button>
          </div>
        )}

        {phase === "connecting" && authenticating && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
              <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" aria-hidden />
              <span>Berhasil dipindai — menyiapkan sesi WhatsApp… (5–10 detik)</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Kode sudah terbaca. Tunggu sebentar, jangan tutup halaman — status berubah jadi “Tersambung” otomatis.
            </p>
            <div className="flex h-[288px] w-[288px] items-center justify-center rounded-xl border border-dashed bg-muted/30">
              <span className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-400/50 border-t-transparent" aria-hidden />
            </div>
          </div>
        )}

        {phase === "connecting" && connectionMode === "qr" && !pairing && !authenticating && (
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
