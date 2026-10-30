"use client";

import { useState, useTransition } from "react";
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
import { actionSendReceiptWa } from "@/app/app/faktur/actions";
import { actionTechSendReceiptWa } from "@/app/t/faktur/actions";

/** Aksi kwitansi: Cetak/Simpan PDF + Kirim WA (gateway, nomor tenant). print:hidden. */
export function KwitansiActions({ invoiceId, variant }: { invoiceId: string; variant: "admin" | "tech" }) {
  const [pending, start] = useTransition();
  const [resendConfirm, setResendConfirm] = useState(false);
  const [resendMode, setResendMode] = useState(false);
  const [sent, setSent] = useState(false);

  async function sendWa(resend = false) {
    const resendId = resend ? crypto.randomUUID() : undefined;
    setResendMode(resend);
    start(async () => {
      const options = resendId ? { resendId } : {};
      const res = variant === "admin"
        ? await actionSendReceiptWa(invoiceId, options)
        : await actionTechSendReceiptWa(invoiceId, options);
      if (!res.ok) {
        const meta = res as { alreadyProcessed?: boolean; waMe?: { url: string; message: string } };
        if (meta.alreadyProcessed) {
          setSent(true);
          toast.info("Permintaan ini sudah pernah diproses. Gateway menahan pengiriman duplikat; status pesan tidak dapat dipastikan dari respons ini.");
          return;
        }
        toast.error(res.error);
        return;
      }
      setSent(true);
      const to = variant === "admin" ? (res as { to?: string }).to : (res as { data?: { to?: string } }).data?.to;
      toast.success(to ? `Kwitansi diterima gateway untuk dikirim ke ${to}` : "Kwitansi diterima gateway untuk dikirim");
    });
  }

  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      <Button type="button" variant="outline" onClick={() => window.print()} className="gap-2">
        <Icon.Print className="h-4 w-4" aria-hidden /> Cetak / Simpan PDF
      </Button>
      <Button
        type="button"
        onClick={() => (sent ? setResendConfirm(true) : sendWa())}
        disabled={pending}
        className="gap-2"
      >
        <Icon.Send className="h-4 w-4" aria-hidden />
        {pending ? (resendMode ? "Mengirim ulang…" : "Mengirim…") : sent ? "Kirim WA lagi" : "Kirim via WA"}
      </Button>
      <Dialog open={resendConfirm} onOpenChange={setResendConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kirim ulang kwitansi?</DialogTitle>
            <DialogDescription>
              Pelanggan akan menerima pesan WhatsApp yang sama sekali lagi. Pastikan memang ingin mengirim ulang.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setResendConfirm(false)}>
              Batal
            </Button>
            <Button
              type="button"
              onClick={() => {
                setResendConfirm(false);
                sendWa(true);
              }}
            >
              Ya, kirim ulang
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
