"use client";

import { useState, useTransition } from "react";
import { actionUpdateCompany } from "../config-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

interface Initial {
  legalName: string;
  brandName: string;
  logoUrl: string;
  isPkp: boolean;
  npwp: string;
  taxLabel: string;
  email: string;
  phone: string;
  addressLine: string;
  city: string;
  province: string;
  postalCode: string;
  countryCode: string;
  checkoutExpiryHours: number;
  finishUrl: string;
  invoiceNote: string;
  receiptNote: string;
  paymentFeeNote: string;
}

export function CompanyEditor({ initial, updatedBy }: { initial: Initial; updatedBy: string | null }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [isPkp, setIsPkp] = useState(initial.isPkp);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await actionUpdateCompany(fd);
      setMsg(res.ok ? { ok: true, text: "Tersimpan" } : { ok: false, text: res.error });
    });
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-5 rounded-xl bg-card p-6 ring-1 ring-foreground/10">
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Identitas</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="legalName">Nama badan hukum</Label>
            <Input id="legalName" name="legalName" defaultValue={initial.legalName} className="mt-1" placeholder="PT Lumite ..." />
          </div>
          <div>
            <Label htmlFor="brandName">Nama brand</Label>
            <Input id="brandName" name="brandName" defaultValue={initial.brandName} className="mt-1" required />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="logoUrl">Logo (URL/path)</Label>
            <Input id="logoUrl" name="logoUrl" defaultValue={initial.logoUrl} className="mt-1" placeholder="/brand/lumite-logo.png" />
            {initial.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={initial.logoUrl} alt="Logo perusahaan" className="mt-2 h-12 w-auto object-contain" />
            )}
          </div>
          <div>
            <Label htmlFor="npwp">NPWP</Label>
            <Input id="npwp" name="npwp" defaultValue={initial.npwp} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" defaultValue={initial.email} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="phone">Telepon</Label>
            <Input id="phone" name="phone" defaultValue={initial.phone} className="mt-1" />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Pajak</h2>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" name="isPkp" checked={isPkp} onChange={(e) => setIsPkp(e.target.checked)} />
          Perusahaan sudah PKP (boleh memungut pajak)
        </label>
        <p className="text-xs text-muted-foreground">
          {isPkp
            ? "Pajak dipungut sesuai rate di menu Kebijakan Billing."
            : "Bukan PKP → pajak TIDAK dipungut (rate efektif 0%), apa pun setelan Kebijakan."}
        </p>
        <div className="max-w-xs">
          <Label htmlFor="taxLabel">Label pajak</Label>
          <Input id="taxLabel" name="taxLabel" defaultValue={initial.taxLabel} className="mt-1" placeholder="PPN" />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Alamat</h2>
        <div>
          <Label htmlFor="addressLine">Alamat</Label>
          <Input id="addressLine" name="addressLine" defaultValue={initial.addressLine} className="mt-1" />
        </div>
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <Label htmlFor="city">Kota</Label>
            <Input id="city" name="city" defaultValue={initial.city} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="province">Provinsi</Label>
            <Input id="province" name="province" defaultValue={initial.province} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="postalCode">Kode pos</Label>
            <Input id="postalCode" name="postalCode" defaultValue={initial.postalCode} className="mt-1" />
          </div>
        </div>
        <div className="max-w-xs">
          <Label htmlFor="countryCode">Kode negara</Label>
          <Input id="countryCode" name="countryCode" defaultValue={initial.countryCode} className="mt-1" />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Checkout</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="checkoutExpiryHours">Masa berlaku link bayar (jam)</Label>
            <Input id="checkoutExpiryHours" type="number" name="checkoutExpiryHours" defaultValue={initial.checkoutExpiryHours} className="mt-1" min={1} max={720} />
          </div>
          <div>
            <Label htmlFor="finishUrl">URL kembali setelah bayar</Label>
            <Input id="finishUrl" name="finishUrl" defaultValue={initial.finishUrl} className="mt-1" placeholder="https://..." />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Dokumen Keuangan (Faktur &amp; Kwitansi)</h2>
        <p className="text-xs text-muted-foreground">Catatan kaki configurable. Kosongkan untuk memakai teks default sistem.</p>
        <div className="space-y-4">
          <div>
            <Label htmlFor="invoiceNote">Catatan kaki FAKTUR (tagihan, belum lunas)</Label>
            <Textarea id="invoiceNote" name="invoiceNote" defaultValue={initial.invoiceNote} className="mt-1" rows={2} maxLength={500} placeholder="mis. Pembayaran melalui tautan/kode yang tersedia…" />
          </div>
          <div>
            <Label htmlFor="receiptNote">Catatan kaki KWITANSI (bukti terima, lunas)</Label>
            <Textarea id="receiptNote" name="receiptNote" defaultValue={initial.receiptNote} className="mt-1" rows={2} maxLength={500} placeholder="mis. Bukti penerimaan pembayaran yang sah…" />
          </div>
          <div>
            <Label htmlFor="paymentFeeNote">Penjelasan biaya layanan channel (bila dibebankan ke pelanggan)</Label>
            <Textarea id="paymentFeeNote" name="paymentFeeNote" defaultValue={initial.paymentFeeNote} className="mt-1" rows={2} maxLength={500} placeholder="mis. Biaya layanan pembayaran dibayarkan pelanggan langsung kepada penyedia…" />
          </div>
        </div>
      </section>

      {msg && <p className={`text-sm ${msg.ok ? "text-emerald-600" : "text-red-600"}`}>{msg.text}</p>}
      {updatedBy && <p className="text-xs text-muted-foreground">Terakhir diubah oleh {updatedBy}</p>}

      <Button
        type="submit"
        disabled={pending}
        className="bg-sky-500 text-white hover:bg-sky-600"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {pending ? "Menyimpan…" : "Simpan Profil"}
      </Button>
    </form>
  );
}
