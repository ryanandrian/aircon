"use client";

import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, Camera, X } from "lucide-react";
import jsQR from "jsqr";
import { Button } from "@/components/ui/button";
import { extractCode } from "@/lib/unit-code/code";

/**
 * Scanner QR in-app (kamera HP via browser).
 * Mesin decode: jsQR (canvas, jalan di SEMUA browser termasuk iOS Safari) — TIDAK bergantung
 * BarcodeDetector yang absen di banyak HP. Bila QR terbaca tapi BUKAN format kode unit Aircon,
 * beri PESAN jelas (tak diam). Input manual tetap tersedia sebagai cadangan.
 */
export function QrScanner({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const doneRef = useRef(false);
  const lastWarnRef = useRef(0);
  const [manual, setManual] = useState("");
  const [starting, setStarting] = useState(true);
  const [camError, setCamError] = useState<string | null>(null);

  useEffect(() => {
    doneRef.current = false;
    const canvas = document.createElement("canvas");
    canvasRef.current = canvas;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStarting(false);
        setCamError("Browser ini tak mendukung kamera. Ketik kode manual di bawah.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (doneRef.current) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          v.setAttribute("playsinline", "true");
          await v.play();
        }
        setStarting(false);
        rafRef.current = requestAnimationFrame(scan);
      } catch (e) {
        setStarting(false);
        const name = (e as Error)?.name ?? "";
        setCamError(
          name === "NotAllowedError"
            ? "Izin kamera ditolak. Aktifkan izin kamera atau ketik kode manual."
            : "Tidak bisa membuka kamera. Ketik kode manual di bawah.",
        );
      }
    }

    function scan() {
      if (doneRef.current) return;
      const v = videoRef.current;
      const canvas = canvasRef.current;
      if (v && canvas && v.readyState >= v.HAVE_ENOUGH_DATA && v.videoWidth > 0) {
        const w = v.videoWidth, h = v.videoHeight;
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(v, 0, 0, w, h);
          try {
            const img = ctx.getImageData(0, 0, w, h);
            const result = jsQR(img.data, w, h, { inversionAttempts: "attemptBoth" });
            if (result && result.data) {
              const code = extractCode(result.data);
              if (code) {
                doneRef.current = true;
                stopCamera();
                onCode(code);
                return;
              }
              // QR TERBACA tapi bukan format kita — beri tahu (throttle 2.5s), jangan diam.
              const now = Date.now();
              if (now - lastWarnRef.current > 2500) {
                lastWarnRef.current = now;
                const preview = result.data.length > 40 ? result.data.slice(0, 40) + "…" : result.data;
                toast.error(`QR terbaca tapi bukan kode unit Aircon: ${preview}`);
              }
            }
          } catch { /* frame gagal, lanjut ke frame berikutnya */ }
        }
      }
      rafRef.current = requestAnimationFrame(scan);
    }

    function stopCamera() {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    }

    start();
    return () => { doneRef.current = true; stopCamera(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function submitManual() {
    const code = extractCode(manual);
    if (!code) { toast.error("Kode tidak dikenal. Contoh format: 7F3K9M2"); return; }
    doneRef.current = true;
    onCode(code);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90 p-4">
      <div className="flex justify-end">
        <Button type="button" variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/10" aria-label="Tutup">
          <X className="h-5 w-5" />
        </Button>
      </div>

      {!camError && (
        <div className="relative mx-auto mt-4 aspect-square w-full max-w-sm overflow-hidden rounded-2xl bg-black">
          <video ref={videoRef} className="h-full w-full object-cover" playsInline muted autoPlay />
          {starting && (
            <div className="absolute inset-0 flex items-center justify-center text-white">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}
          <div className="pointer-events-none absolute inset-8 rounded-xl border-2 border-white/70" />
        </div>
      )}

      {camError && (
        <div className="mx-auto mt-6 max-w-sm rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-200">
          {camError}
        </div>
      )}

      <div className="mx-auto mt-6 w-full max-w-sm space-y-2 text-center">
        <p className="flex items-center justify-center gap-2 text-sm text-white/80">
          <Camera className="h-4 w-4" /> {camError ? "Ketik kode dari sticker" : "Arahkan kamera ke QR sticker"}
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
