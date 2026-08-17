"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ownerInviteTechnician, ownerRevokeInvite } from "@/app/masuk-teknisi/actions";

interface Tech { id: string; name: string; phone: string; active: boolean }
interface Invite { id: string; name: string; phone: string; token: string }

export function TechnicianManager({
  appUrl, technicians, invites,
}: {
  appUrl: string; technicians: Tech[]; invites: Invite[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState<string | null>(null);

  function invite(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    start(async () => {
      const res = await ownerInviteTechnician(name, phone);
      if (!res.ok) { setMsg({ ok: false, text: res.error }); return; }
      setMsg({ ok: true, text: "Undangan dibuat. Bagikan link ke teknisi." });
      setName(""); setPhone("");
      router.refresh();
    });
  }

  function revoke(id: string) {
    start(async () => {
      await ownerRevokeInvite(id);
      router.refresh();
    });
  }

  function copyLink(token: string) {
    const url = `${appUrl}/undangan/${token}`;
    navigator.clipboard?.writeText(url);
    setCopied(token);
    setTimeout(() => setCopied(null), 2000);
  }

  function waShare(inv: Invite) {
    const url = `${appUrl}/undangan/${inv.token}`;
    const text = `Halo ${inv.name}, Anda diundang jadi teknisi di Aircon. Buka link ini untuk membuat PIN & mulai: ${url}`;
    const wa = `https://wa.me/${inv.phone}?text=${encodeURIComponent(text)}`;
    window.open(wa, "_blank");
  }

  return (
    <div className="space-y-6">
      {/* Form undang */}
      <form onSubmit={invite} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">Undang Teknisi Baru</h2>
        {msg && <p className={`text-sm ${msg.ok ? "text-emerald-600" : "text-red-600"}`}>{msg.text}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-slate-700">Nama</label>
            <input id="name" value={name} onChange={(e) => setName(e.target.value)} required
              className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 px-3 py-2 text-base" />
          </div>
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-slate-700">Nomor HP</label>
            <input id="phone" type="tel" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value)} required
              placeholder="08xxxxxxxxxx"
              className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 px-3 py-2 text-base" />
          </div>
        </div>
        <button type="submit" disabled={pending || !name || !phone}
          className="min-h-[44px] rounded-xl bg-sky-500 px-5 font-semibold text-white hover:bg-sky-600 disabled:opacity-50">
          {pending ? "Memproses…" : "Buat Undangan"}
        </button>
      </form>

      {/* Undangan pending */}
      {invites.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-500">Menunggu Bergabung</h2>
          {invites.map((inv) => (
            <div key={inv.id} className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{inv.name}</p>
                  <p className="text-sm text-slate-500">{inv.phone}</p>
                </div>
                <button onClick={() => revoke(inv.id)} disabled={pending}
                  className="text-sm text-red-600 hover:underline">Batalkan</button>
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={() => waShare(inv)}
                  className="min-h-[40px] flex-1 rounded-xl bg-emerald-500 text-sm font-medium text-white">
                  Kirim via WhatsApp
                </button>
                <button onClick={() => copyLink(inv.token)}
                  className="min-h-[40px] flex-1 rounded-xl bg-slate-100 text-sm font-medium text-slate-700">
                  {copied === inv.token ? "Tersalin ✓" : "Salin Link"}
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Teknisi aktif */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-500">Teknisi Aktif ({technicians.length})</h2>
        {technicians.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-400">
            Belum ada teknisi. Undang lewat form di atas.
          </p>
        ) : (
          technicians.map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4">
              <div>
                <p className="font-medium">{t.name}</p>
                <p className="text-sm text-slate-500">{t.phone}</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${t.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                {t.active ? "Aktif" : "Nonaktif"}
              </span>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
