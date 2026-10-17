"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { actionVerifyPayment } from "@/app/app/faktur/actions";

/**
 * Tombol "Verifikasi dana masuk" (L3 / K4) — hanya untuk invoice transfer/QRIS yang
 * ditandai lunas OLEH TEKNISI dan belum diverifikasi. Owner/admin tenant memastikan
 * dana benar-benar masuk rekening (antisipasi bukti fiktif), lalu penerimaan dihitung.
 * Penandaan lunas oleh admin/owner sendiri tidak memunculkan tombol ini (sudah
 * otomatis terverifikasi — markInvoicePaid).
 * Pola identik dengan CancelInvoiceButton (Button pustaka UI + useTransition + toast).
 */
export function VerifyPaymentButton({ invoiceId, method }: { invoiceId: string; method: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function verify() {
    if (!confirm(`Verifikasi pembayaran ${method} ini — pastikan dana sudah masuk ke rekening usaha. Setelah diverifikasi, angka masuk ke Penerimaan.`)) return;
    start(async () => {
      const res = await actionVerifyPayment(invoiceId);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Pembayaran terverifikasi — masuk Penerimaan");
      router.refresh();
    });
  }

  return (
    <Button type="button" onClick={verify} disabled={pending}
      className="w-full min-h-[44px] bg-emerald-600 text-white hover:bg-emerald-700">
      {pending ? "Memverifikasi…" : "✓ Verifikasi — dana sudah masuk rekening"}
    </Button>
  );
}
