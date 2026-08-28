"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { actionCancelInvoice } from "@/app/t/faktur/actions";

/** Tombol batalkan dokumen (K11: admin only). */
export function CancelInvoiceButton({ invoiceId, isProforma }: { invoiceId: string; isProforma: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function cancel() {
    if (!confirm(`Batalkan ${isProforma ? "proforma" : "invoice"} ini? Tindakan tak bisa dibatalkan.`)) return;
    start(async () => {
      const res = await actionCancelInvoice(invoiceId);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Dokumen dibatalkan");
      router.refresh();
    });
  }

  return (
    <Button type="button" variant="outline" onClick={cancel} disabled={pending}
      className="w-full min-h-[44px] border-red-300 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/40">
      Batalkan Dokumen
    </Button>
  );
}
