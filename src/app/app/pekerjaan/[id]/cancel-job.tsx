"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actionCancelJob } from "../actions";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * Aksi "Batalkan pekerjaan" — DIRENDER DI LUAR kartu "Jadwal & Tim" (di bawah,
 * dipisah garis putus-putus) agar tidak terbaca sebagai bagian dari alur
 * Tugaskan Tim / Simpan Penugasan (temuan UX user 2026-10-05).
 *
 * Perilaku & guard TIDAK berubah: sama seperti saat tombol masih sebaris —
 * panel konfirmasi 2 langkah (alasan + "Ya, batalkan pekerjaan"), action
 * `actionCancelJob` (guard OWNER/ADMIN di server, transisi FSM CANCELLED
 * terminal via transitionJob), pesan sukses/gagal di panel ini.
 */
export function CancelJobPanel({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [showCancel, setShowCancel] = useState(false);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  function submitCancel() {
    setMsg(null);
    start(async () => {
      const res = await actionCancelJob(jobId, reason);
      if (!res.ok) { setMsg({ kind: "err", text: res.error }); return; }
      setMsg({ kind: "ok", text: "Pekerjaan dibatalkan." });
      setShowCancel(false);
      router.refresh();
    });
  }

  return (
    <section aria-label="Batalkan pekerjaan" className="mt-5 border-t border-dashed border-border pt-4">
      <p className="text-xs text-muted-foreground">
        Pekerjaan tidak jadi dikerjakan? Pembatalan bersifat{" "}
        <span className="font-medium text-foreground">permanen</span> dan tidak bisa dibatalkan kembali.
      </p>

      {msg && (
        <p role={msg.kind === "err" ? "alert" : "status"}
          className={`mt-3 rounded-xl border px-4 py-3 text-sm ${msg.kind === "err"
            ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-400"
            : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/50 dark:text-emerald-400"}`}>
          {msg.text}
        </p>
      )}

      {!showCancel ? (
        <Button type="button" variant="outline" onClick={() => { setShowCancel(true); setMsg(null); }}
          className="mt-3 min-h-[44px] border-red-300 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/40">
          Batalkan pekerjaan
        </Button>
      ) : (
        <div className="mt-3 space-y-3 rounded-2xl bg-muted/40 p-4">
          <div className="space-y-1.5">
            <Label htmlFor="cancel-reason">Alasan pembatalan</Label>
            <Textarea id="cancel-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="Contoh: pelanggan menunda, alamat tidak ditemukan…" className="rounded-2xl text-base" />
          </div>
          <div className="flex flex-wrap gap-2">
            <SubmitButton type="button" onClick={submitCancel} pending={pending} pendingLabel="Memproses…" size="lg"
              className="min-h-[48px] flex-1 rounded-2xl bg-red-500 px-6 text-white hover:bg-red-600">
              Ya, batalkan pekerjaan
            </SubmitButton>
            <Button type="button" variant="outline" onClick={() => { setShowCancel(false); setMsg(null); }}
              disabled={pending} size="lg" className="min-h-[48px] rounded-2xl">
              Kembali
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
