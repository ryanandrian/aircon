"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icons";
import { actionMarkPaid, actionUploadPaymentProof } from "@/app/t/faktur/actions";

type PayMethod = "CASH" | "TRANSFER" | "QRIS";

/**
 * Panel penandaan lunas (K1 cash lapangan): pilih metode + unggah bukti → PAID.
 *
 * Latar (terbaca urut, supaya tak tertukar sesi berikut):
 *  - Panel ini dipakai SAMA oleh halaman teknisi & admin (F-05).
 *  - Dulu unggah bukti diguard OWNER/ADMIN (F-06) → teknisi melihat kolom, memilih
 *    foto, upload DITOLAK senyap, tombol LUNAS membeku tanpa indikator (laporan
 *    pemilik 2026-10-18). K10 lalu menyembunyikan kolom dari teknisi.
 *  - KEPUTUSAN PEMILIK 2026-10-18 (K12) MEMBATALKAN pembatasan itu: teknisi
 *    DIPERBOLEHKAN (diwajibkan) mengunggah bukti — tunai/transfer/QRIS — khususnya
 *    pelanggan TOP CASH. Guard server dibuka utk SEMUA peran; kolom bukti tampil
 *    di semua peran; indikator "Mengunggah…" tetap ada (tombol tak senyap).
 *  - prop `role` yang sempat ditambahkan K10 sudah DIHAPUS bersih (anti-fosil).
 *
 * K17 (keputusan pemilik 2026-10-18 — audit INV/2026/0034): penandaan lunas
 * TRANSFER/QRIS oleh TEKNISI TIDAK BISA tanpa foto. Dipakai lewat `requireProof`
 * (boolean semantik — BUKAN prop peran, konsisten anti-fosil K12): halaman teknisi
 * mengirim `requireProof`, halaman admin tidak (opsional, K4/K17).
 * Kewajiban berlaku pada metode NON-TUNAI saja; CASH tetap opsional (K3).
 */
export function PaymentPanel({ invoiceId, tenantHasQris, requireProof = false }: {
  invoiceId: string; tenantHasQris: boolean; requireProof?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [method, setMethod] = useState<PayMethod>("CASH");
  const [proofUrl, setProofUrl] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  // K17: bukti wajib bila diminta pemanggil DAN metodenya non-tunai.
  const needsProof = requireProof && method !== "CASH";

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      // Upload LEWAT SERVER (hindari CORS browser→S3).
      const fd = new FormData();
      fd.set("file", file);
      const res = await actionUploadPaymentProof(fd);
      if (!res.ok) { toast.error(res.error); return; }
      setProofUrl(res.data!.publicUrl);
      toast.success("Bukti terunggah");
    } catch {
      toast.error("Upload gagal");
    } finally {
      setUploading(false);
    }
  }

  function markPaid() {
    start(async () => {
      const res = await actionMarkPaid(invoiceId, method, proofUrl || undefined);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Ditandai LUNAS");
      router.refresh();
    });
  }

  const methods: { v: PayMethod; label: string }[] = [
    { v: "CASH", label: "Tunai" },
    { v: "TRANSFER", label: "Transfer" },
    ...(tenantHasQris ? [{ v: "QRIS" as PayMethod, label: "QRIS" }] : []),
  ];

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <h2 className="text-sm font-semibold text-foreground">Tandai Pembayaran</h2>
        <div className="flex gap-2">
          {methods.map((m) => (
            <button key={m.v} type="button" onClick={() => setMethod(m.v)}
              className={`min-h-[40px] flex-1 rounded-xl border text-sm font-medium ${method === m.v ? "border-sky-500 bg-sky-500 text-white" : "bg-background text-muted-foreground"}`}>
              {m.label}
            </button>
          ))}
        </div>
        {/* KEPUTUSAN PEMILIK 2026-10-18 (K12): teknisi DIPERBOLEHKAN (bahkan diwajibkan)
            mengunggah bukti — terima uang tunai / transfer / QRIS — khususnya pelanggan
            TOP CASH. Kolom bukti tampil untuk SEMUA peran (membalikkan keputusan K10).
            K17: label ikut kewajiban — teknisi non-tunai TIDAK dibiarkan mengira opsional. */}
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Bukti bayar ({needsProof ? "wajib" : "opsional"})</label>
          <input type="file" accept="image/*" onChange={onFile} disabled={uploading}
            className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-2 file:text-sm" />
          {uploading && <p className="text-xs text-sky-600">Mengunggah… tunggu sebentar</p>}
          {proofUrl && !uploading && <p className="text-xs text-emerald-600">✓ Bukti siap</p>}
          {needsProof && !proofUrl && !uploading && (
            <p className="text-xs text-amber-600">
              Transfer/QRIS wajib menyertakan foto bukti — minta dari pelanggan, atau pilih Tunai bila uang diterima langsung.
            </p>
          )}
        </div>
        {/* K17: tombol terkunci saat bukti wajib belum ada — guard service tetap jadi
            penegak utama (layar hanya memperjelas, bukan satu-satunya pengaman). */}
        <Button type="button" onClick={markPaid} disabled={pending || uploading || needsProof}
          className="w-full min-h-[44px] bg-emerald-600 text-white hover:bg-emerald-700">
          <Icon.Success className="h-4 w-4" aria-hidden /> {uploading ? "Mengunggah…" : "Tandai LUNAS"}
        </Button>
        <p className="text-xs text-muted-foreground">Setelah lunas, tombol kirim kwitansi WhatsApp muncul di halaman ini.</p>
      </CardContent>
    </Card>
  );
}
