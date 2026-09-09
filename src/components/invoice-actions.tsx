"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icons";
import { actionSendInvoiceWa } from "@/app/app/faktur/actions";
import { actionTechSendInvoiceWa } from "@/app/t/faktur/actions";

/**
 * Aksi dokumen (proforma/invoice/kwitansi): Cetak/Simpan PDF + Kirim WA (gateway, nomor tenant).
 * Disembunyikan saat cetak (print:hidden). Dipakai di panel admin & teknisi.
 * Kirim WA otomatis ke kontak penagihan (PIC keuangan → utama) — tanpa link internal (ringkasan teks).
 */
export function InvoiceActions({
  invoiceId,
  variant,
  docLabel = "dokumen",
}: {
  invoiceId: string;
  variant: "admin" | "tech";
  docLabel?: string;
}) {
  const [pending, start] = useTransition();
  const [sent, setSent] = useState(false);

  function sendWa() {
    start(async () => {
      const res = variant === "admin"
        ? await actionSendInvoiceWa(invoiceId)
        : await actionTechSendInvoiceWa(invoiceId);
      if (!res.ok) { toast.error(res.error); return; }
      const to = variant === "admin" ? (res as { to?: string }).to : (res as { data?: { to?: string } }).data?.to;
      toast.success(to ? `${docLabel} dikirim via WA ke ${to}` : `${docLabel} dikirim via WA`);
      setSent(true);
    });
  }

  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      <Button type="button" variant="outline" onClick={() => window.print()} className="gap-2">
        <Icon.Print className="h-4 w-4" aria-hidden /> Cetak / Simpan PDF
      </Button>
      <Button type="button" onClick={sendWa} disabled={pending} className="gap-2">
        <Icon.Send className="h-4 w-4" aria-hidden />
        {pending ? "Mengirim…" : sent ? "Kirim WA lagi" : "Kirim via WA"}
      </Button>
    </div>
  );
}
