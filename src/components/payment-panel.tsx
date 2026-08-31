"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icons";
import { actionMarkPaid, actionUploadPaymentProof } from "@/app/t/faktur/actions";

type PayMethod = "CASH" | "TRANSFER" | "QRIS";

/** Panel penandaan lunas (K1 cash lapangan): pilih metode + upload bukti opsional → PAID. */
export function PaymentPanel({ invoiceId, tenantHasQris }: { invoiceId: string; tenantHasQris: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [method, setMethod] = useState<PayMethod>("CASH");
  const [proofUrl, setProofUrl] = useState<string>("");
  const [uploading, setUploading] = useState(false);

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
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Bukti bayar (opsional)</label>
          <input type="file" accept="image/*" onChange={onFile} disabled={uploading}
            className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-2 file:text-sm" />
          {proofUrl && <p className="text-xs text-emerald-600">✓ Bukti siap</p>}
        </div>
        <Button type="button" onClick={markPaid} disabled={pending || uploading}
          className="w-full min-h-[44px] bg-emerald-600 text-white hover:bg-emerald-700">
          <Icon.Success className="h-4 w-4" aria-hidden /> Tandai LUNAS
        </Button>
        <p className="text-xs text-muted-foreground">Kwitansi WA ke pelanggan akan dikirim (fitur WA sedang tahap uji).</p>
      </CardContent>
    </Card>
  );
}
