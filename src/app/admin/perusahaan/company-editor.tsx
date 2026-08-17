"use client";

import { useState, useTransition } from "react";
import { actionUpdateCompany } from "../config-actions";

interface Initial {
  legalName: string;
  brandName: string;
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

  const field = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";
  const label = "block text-sm font-medium text-slate-700";

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-500">Identitas</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>Nama badan hukum</label>
            <input name="legalName" defaultValue={initial.legalName} className={field} placeholder="PT Lumite ..." />
          </div>
          <div>
            <label className={label}>Nama brand</label>
            <input name="brandName" defaultValue={initial.brandName} className={field} required />
          </div>
          <div>
            <label className={label}>NPWP</label>
            <input name="npwp" defaultValue={initial.npwp} className={field} />
          </div>
          <div>
            <label className={label}>Email</label>
            <input name="email" type="email" defaultValue={initial.email} className={field} />
          </div>
          <div>
            <label className={label}>Telepon</label>
            <input name="phone" defaultValue={initial.phone} className={field} />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-500">Pajak</h2>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="isPkp" checked={isPkp} onChange={(e) => setIsPkp(e.target.checked)} />
          Perusahaan sudah PKP (boleh memungut pajak)
        </label>
        <p className="text-xs text-slate-400">
          {isPkp
            ? "Pajak dipungut sesuai rate di menu Kebijakan Billing."
            : "Bukan PKP → pajak TIDAK dipungut (rate efektif 0%), apa pun setelan Kebijakan."}
        </p>
        <div className="max-w-xs">
          <label className={label}>Label pajak</label>
          <input name="taxLabel" defaultValue={initial.taxLabel} className={field} placeholder="PPN" />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-500">Alamat</h2>
        <div>
          <label className={label}>Alamat</label>
          <input name="addressLine" defaultValue={initial.addressLine} className={field} />
        </div>
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <label className={label}>Kota</label>
            <input name="city" defaultValue={initial.city} className={field} />
          </div>
          <div>
            <label className={label}>Provinsi</label>
            <input name="province" defaultValue={initial.province} className={field} />
          </div>
          <div>
            <label className={label}>Kode pos</label>
            <input name="postalCode" defaultValue={initial.postalCode} className={field} />
          </div>
        </div>
        <div className="max-w-xs">
          <label className={label}>Kode negara</label>
          <input name="countryCode" defaultValue={initial.countryCode} className={field} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-500">Checkout</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>Masa berlaku link bayar (jam)</label>
            <input type="number" name="checkoutExpiryHours" defaultValue={initial.checkoutExpiryHours} className={field} min={1} max={720} />
          </div>
          <div>
            <label className={label}>URL kembali setelah bayar</label>
            <input name="finishUrl" defaultValue={initial.finishUrl} className={field} placeholder="https://..." />
          </div>
        </div>
      </section>

      {msg && <p className={`text-sm ${msg.ok ? "text-emerald-600" : "text-red-600"}`}>{msg.text}</p>}
      {updatedBy && <p className="text-xs text-slate-400">Terakhir diubah oleh {updatedBy}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-sky-500 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-600 disabled:opacity-50"
      >
        {pending ? "Menyimpan…" : "Simpan Profil"}
      </button>
    </form>
  );
}
