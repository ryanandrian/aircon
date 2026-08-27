"use client";

import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { extractCode } from "@/lib/unit-code/code";

/**
 * Scanner QR in-app (kamera HP via browser). Pakai BarcodeDetector bila tersedia.
 * Saat terdeteksi kode valid milik pola kita → callback onCode(code).
 * Fallback: bila BarcodeDetector tak ada, tampilkan input manual kode.
 */
export function QrScanner({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [manual, setManual] = useState("");
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const AnyWin = window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> } };
    const hasDetector = typeof AnyWin.BarcodeDetector === "function";
    setSupported(hasDetector);
    if (!hasDetector) { setStarting(false); return; }

    const detector = new AnyWin.BarcodeDetector!({ formats: ["qr_code"] });

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setStarting(false);
        scan();
      } catch {
        setStarting(false);
        toast.error("Tidak bisa mengakses kamera. Pakai input manual di bawah.");
        setSupported(false);
      }
    }

    async function scan() {
      if (cancelled || !videoRef.current) return;
      try {
        const codes = await detector.detect(videoRef.current);
        for (const c of codes) {
          const code = extractCode(c.rawValue);
          if (code) { stop(); onCode(code); return; }
        }
      } catch { /* frame gagal, lanjut */ }
      rafRef.current = requestAnimationFrame(scan);
    }

    function stop() {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    }

    start();
    return () => { stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function submitManual() {
    const code = extractCode(manual);
    if (!code) { toast.error("Kode tidak dikenal"); return; }
    onCode(code);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90 p-4">
      <div className="flex justify-end">
        <Button type="button" variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/10" aria-label="Tutup">
          <X className="h-5 w-5" />
        </Button>
      </div>

      {supported !== false && (
        <div className="relative mx-auto mt-4 aspect-square w-full max-w-sm overflow-hidden rounded-2xl bg-black">
          <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
          {starting && (
            <div className="absolute inset-0 flex items-center justify-center text-white">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}
          <div className="pointer-events-none absolute inset-8 rounded-xl border-2 border-white/70" />
        </div>
      )}

      <div className="mx-auto mt-6 w-full max-w-sm space-y-2 text-center">
        <p className="flex items-center justify-center gap-2 text-sm text-white/80">
          <Camera className="h-4 w-4" /> {supported === false ? "Ketik kode dari sticker" : "Arahkan kamera ke QR sticker"}
        </p>
        <div className="flex gap-2">
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value.toUpperCase())}
            placeholder="mis. 7F3K9M2"
            className="min-h-[44px] flex-1 rounded-xl border border-white/20 bg-white/10 px-3 font-mono uppercase text-white placeholder:text-white/40"
          />
          <Button type="button" onClick={submitManual}>Buka</Button>
        </div>
      </div>
    </div>
  );
}
