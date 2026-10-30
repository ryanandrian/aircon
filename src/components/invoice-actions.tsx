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
  docUrl,
}: {
  invoiceId: string;
  variant: "admin" | "tech";
  docLabel?: string;
  /** F7d: tautan dokumen publik (/d/{token}) — bila ada, tombol "Salin link dokumen"
   *  muncul supaya admin/teknisi bisa kirim manual via WhatsApp Apps/Web miliknya. */
  docUrl?: string | null;
}) {
  const [pending, start] = useTransition();
  const [resendConfirm, setResendConfirm] = useState(false);
  const [resendMode, setResendMode] = useState(false);
  const [sent, setSent] = useState(false);
  // F3: fallback utk tenant TRIAL/BASIC (plan-locked) — server mengirim balik
  // tautan wa.me (aplikasi WA milik pengirim) → tombol "Buka WhatsApp" muncul.
  const [waMe, setWaMe] = useState<{ url: string; message: string } | null>(null);

  async function copyDocLink() {
    if (!docUrl) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(docUrl);
      } else {
        // Fallback utk konteks non-secure / browser lama (user-friendly).
        const ta = document.createElement("textarea");
        ta.value = docUrl;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      toast.success("Link dokumen disalin — tempel di WhatsApp Anda.");
    } catch {
      toast.error("Gagal menyalin link. Salin manual dari alamat browser.");
    }
  }

  async function sendWa(resend = false) {
    const resendId = resend ? crypto.randomUUID() : undefined;
    setResendMode(resend);
    start(async () => {
      const options = resendId ? { resendId } : {};
      const res = variant === "admin"
        ? await actionSendInvoiceWa(invoiceId, options)
        : await actionTechSendInvoiceWa(invoiceId, options);
      if (!res.ok) {
        const meta = res as { waMe?: { url: string; message: string }; alreadyProcessed?: boolean };
        setWaMe(meta.waMe ?? null);
        if (meta.alreadyProcessed) {
          setSent(true);
          toast.info("Permintaan ini sudah pernah diproses. Gateway menahan pengiriman duplikat; status pesan tidak dapat dipastikan dari respons ini.");
          return;
        }
        toast.error(meta.waMe ? `${res.error} (lihat tombol "Buka WhatsApp")` : res.error);
        return;
      }
      setWaMe(null);
      setSent(true);
      const to = variant === "admin" ? (res as { to?: string }).to : (res as { data?: { to?: string } }).data?.to;
      toast.success(to ? `${docLabel} diterima gateway untuk dikirim ke ${to}` : `${docLabel} diterima gateway untuk dikirim`);
    });
  }

  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      <Button type="button" variant="outline" onClick={() => window.print()} className="gap-2">
        <Icon.Print className="h-4 w-4" aria-hidden /> Cetak / Simpan PDF
      </Button>
      {docUrl && (
        <Button type="button" variant="outline" onClick={copyDocLink} className="gap-2">
          <Icon.Copy className="h-4 w-4" aria-hidden /> Salin link dokumen
        </Button>
      )}
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
            <DialogTitle>Kirim ulang {docLabel}?</DialogTitle>
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
      {waMe && (
        <a href={waMe.url} target="_blank" rel="noopener noreferrer">
          <Button type="button" variant="outline" className="gap-2">
            <Icon.Message className="h-4 w-4" aria-hidden /> Buka WhatsApp
          </Button>
        </a>
      )}
    </div>
  );
}
