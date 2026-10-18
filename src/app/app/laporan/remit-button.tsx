"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Icon } from "@/components/icons";
import { actionMarkCashRemitted, actionUploadRemitProof } from "./actions";

/**
 * Tombol "Tandai Sudah Disetor" untuk kumpulan kas satu pemegang uang (K17 + M9).
 *
 * L2 / K5 (2026-10-17): setoran kini MENINGGALKAN JEJAK — dialog unggah foto bukti
 * (diunggah lewat server → S3, scope yang sama dengan bukti bayar) + admin penerima
 * diisi otomatis dari sesi perekam. Setoran tanpa bukti TIDAK BISA dicatat.
 * Mengganti confirm() bawaan browser → memakai Dialog dari pustaka UI yang ada.
 *
 * M9 (2026-10-18): pemegang uang BUKAN selalu teknisi (bisa pemilik) — prop pemilik
 * lama diganti `holderName` (aturan 12: nama yang menyesatkan diganti bersih, bukan
 * dibiarkan).
 *
 * K14 (2026-10-18, izin pemilik): `mode = "legacy"` mengubah label & mode panggilan
 * untuk MELENGKAPI JEJAK setoran lama (baris "Disetor — Belum Ada Bukti") — memakai
 * dialog, unggah S3, dan action yang sudah ada; tidak ada komponen atau action baru.
 */
export function RemitButton({ holderName, invoiceIds, mode = "held" }: { holderName: string; invoiceIds: string[]; mode?: "held" | "legacy" }) {
  const legacy = mode === "legacy";
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [proofUrl, setProofUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      // Unggah LEWAT SERVER (hindari CORS browser→S3) — pola sama dengan PaymentPanel.
      const fd = new FormData();
      fd.set("file", file);
      const res = await actionUploadRemitProof(fd);
      if (!res.ok) { toast.error(res.error); return; }
      setProofUrl(res.data!.publicUrl);
      toast.success("Bukti setoran terunggah");
    } catch {
      toast.error("Upload gagal");
    } finally {
      setUploading(false);
    }
  }

  function submit() {
    start(async () => {
      const res = await actionMarkCashRemitted(invoiceIds, proofUrl, mode);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(legacy
        ? `Bukti setoran lama tercatat (${res.data!.count} transaksi)`
        : `Setoran ${holderName} dicatat (${res.data!.count} transaksi)`);
      setDone(true);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={done}
        className="bg-emerald-600 text-white hover:bg-emerald-700"
      >
        {done ? "Tercatat" : legacy ? "Lengkapi Bukti" : "Tandai Disetor"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{legacy ? "Lengkapi Bukti Setoran" : "Catat Setoran Kas"}</DialogTitle>
            <DialogDescription>
              {legacy
                ? `Setoran lama tanpa jejak — ${holderName} (${invoiceIds.length} transaksi).`
                : `Setoran dari ${holderName} (${invoiceIds.length} transaksi).`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <label htmlFor="remit-proof" className="text-xs font-medium text-muted-foreground">
              Foto bukti setoran <span className="text-red-500">*</span>
            </label>
            <input
              id="remit-proof"
              type="file"
              accept="image/*"
              onChange={onFile}
              disabled={uploading}
              aria-required="true"
              className="block w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-2 file:text-sm"
            />
            {proofUrl ? (
              <p className="text-xs text-emerald-600">✓ Bukti siap diunggah</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Wajib — bukti setoran disimpan agar bisa ditelusuri kembali.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Batal
            </Button>
            <Button
              type="button"
              onClick={submit}
              disabled={pending || uploading || !proofUrl}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              <Icon.Success className="h-4 w-4" aria-hidden /> {legacy ? "Simpan Bukti" : "Catat Setoran"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
