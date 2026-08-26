"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ownerInviteTechnician, ownerRevokeInvite } from "@/app/masuk-teknisi/actions";
import { Icon } from "@/components/icons";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";

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
      <Card>
        <CardContent className="p-5">
          <form onSubmit={invite} className="space-y-3">
            <h2 className="font-semibold text-foreground">Undang Teknisi Baru</h2>
            {msg && <p className={`text-sm ${msg.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>{msg.text}</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name">Nama</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required
                  className="min-h-[44px] rounded-xl text-base" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Nomor HP</Label>
                <Input id="phone" type="tel" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value)} required
                  placeholder="08xxxxxxxxxx"
                  className="min-h-[44px] rounded-xl text-base" />
              </div>
            </div>
            <SubmitButton pending={pending} disabled={!name || !phone} pendingLabel="Memproses…"
              size="lg" className="min-h-[44px] rounded-xl bg-sky-500 px-5 text-white hover:bg-sky-600">
              Buat Undangan
            </SubmitButton>
          </form>
        </CardContent>
      </Card>

      {/* Undangan pending */}
      {invites.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">Menunggu Bergabung</h2>
          {invites.map((inv) => (
            <Card key={inv.id} className="border-amber-200 bg-amber-50 ring-amber-200/50 dark:border-amber-900/40 dark:bg-amber-950/30 dark:ring-amber-900/40">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">{inv.name}</p>
                    <p className="text-sm text-muted-foreground">{inv.phone}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => revoke(inv.id)} disabled={pending}
                    className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/40">Batalkan</Button>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button onClick={() => waShare(inv)} size="lg"
                    className="min-h-[40px] flex-1 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600">
                    Kirim via WhatsApp
                  </Button>
                  <Button variant="secondary" onClick={() => copyLink(inv.token)} size="lg"
                    className="min-h-[40px] flex-1 rounded-xl">
                    {copied === inv.token ? <span className="inline-flex items-center gap-1"><Icon.Check className="h-4 w-4" aria-hidden /> Tersalin</span> : "Salin Link"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      {/* Teknisi aktif */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Teknisi Aktif ({technicians.length})</h2>
        {technicians.length === 0 ? (
          <EmptyState
            icon={Icon.Technician}
            title="Belum ada teknisi"
            desc="Undang teknisi lewat form di atas — mereka akan menerima tautan untuk membuat PIN dan mulai menangani pekerjaan."
          />
        ) : (
          technicians.map((t) => (
            <Card key={t.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium text-foreground">{t.name}</p>
                  <p className="text-sm text-muted-foreground">{t.phone}</p>
                </div>
                {t.active ? (
                  <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">Aktif</Badge>
                ) : (
                  <Badge variant="secondary">Nonaktif</Badge>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </section>
    </div>
  );
}
