"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ownerInviteTechnician,
  ownerRevokeInvite,
  ownerUpdateTechnician,
  ownerResetTechnicianPin,
} from "@/app/masuk-teknisi/actions";
import { Icon } from "@/components/icons";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type Position = "TEKNISI" | "KERNET";
type UserStatus = "INVITED" | "ACTIVE" | "DISABLED";
interface Tech { id: string; name: string; phone: string; active: boolean; position: Position; status: UserStatus }
interface Invite { id: string; name: string; phone: string; token: string }

const POSITION_LABEL: Record<Position, string> = { TEKNISI: "Teknisi", KERNET: "Kernet" };

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
  const [query, setQuery] = useState("");

  // Dialog state
  const [editTech, setEditTech] = useState<Tech | null>(null);
  const [pinTech, setPinTech] = useState<Tech | null>(null);

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

  function toggleActive(t: Tech) {
    start(async () => {
      const res = await ownerUpdateTechnician(t.id, { active: !t.active });
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(t.active ? "Teknisi dinonaktifkan" : "Teknisi diaktifkan");
      router.refresh();
    });
  }

  const q = query.trim().toLowerCase();
  const filtered = q
    ? technicians.filter((t) => t.name.toLowerCase().includes(q) || t.phone.toLowerCase().includes(q))
    : technicians;

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
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-muted-foreground">Tim Teknisi ({technicians.length})</h2>
        </div>
        {technicians.length > 3 && (
          <Input placeholder="Cari nama atau nomor HP…" value={query} onChange={(e) => setQuery(e.target.value)}
            className="h-11 rounded-xl" />
        )}
        {technicians.length === 0 ? (
          <EmptyState
            icon={Icon.Technician}
            title="Belum ada teknisi"
            desc="Undang teknisi lewat form di atas — mereka akan menerima tautan untuk membuat PIN dan mulai menangani pekerjaan."
          />
        ) : filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Tidak ada teknisi yang cocok dengan pencarian.</p>
        ) : (
          <div className="space-y-3">
            {filtered.map((t) => (
              <Card key={t.id} className="py-0">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-500 font-bold text-white">
                    {t.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-semibold text-foreground">{t.name}</span>
                      <Badge variant="outline" className="shrink-0">{POSITION_LABEL[t.position]}</Badge>
                      {t.status === "INVITED" ? (
                        <Badge variant="secondary" className="shrink-0">Belum set PIN</Badge>
                      ) : t.active ? (
                        <Badge className="shrink-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">Aktif</Badge>
                      ) : (
                        <Badge variant="secondary" className="shrink-0">Nonaktif</Badge>
                      )}
                    </div>
                    <p className="truncate text-sm text-muted-foreground">{t.phone}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button type="button" variant="ghost" size="icon" aria-label="Ubah" onClick={() => setEditTech(t)}>
                      <Icon.Note className="h-4 w-4" aria-hidden />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" aria-label="Reset PIN" title="Reset PIN" onClick={() => setPinTech(t)}>
                      <Icon.Shield className="h-4 w-4" aria-hidden />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {editTech && (
        <EditTechnicianDialog
          tech={editTech}
          onClose={() => setEditTech(null)}
          onSaved={() => { setEditTech(null); router.refresh(); }}
          onToggleActive={() => { toggleActive(editTech); setEditTech(null); }}
        />
      )}
      {pinTech && (
        <ResetPinDialog
          tech={pinTech}
          onClose={() => setPinTech(null)}
          onDone={() => { setPinTech(null); router.refresh(); }}
        />
      )}
    </div>
  );
}

function EditTechnicianDialog({
  tech, onClose, onSaved, onToggleActive,
}: {
  tech: Tech; onClose: () => void; onSaved: () => void; onToggleActive: () => void;
}) {
  const [name, setName] = useState(tech.name);
  const [phone, setPhone] = useState(tech.phone);
  const [position, setPosition] = useState<Position>(tech.position);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const res = await ownerUpdateTechnician(tech.id, { name, phone, position });
    setSaving(false);
    if (!res.ok) { toast.error(res.error); return; }
    toast.success("Perubahan disimpan");
    onSaved();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Ubah Teknisi</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-name">Nama</Label>
            <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} className="h-11 rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-phone">Nomor HP</Label>
            <Input id="edit-phone" type="tel" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-11 rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label>Posisi default</Label>
            <Select value={position} onValueChange={(v) => setPosition(v as Position)}>
              <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="TEKNISI">Teknisi</SelectItem>
                <SelectItem value="KERNET">Kernet</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Hanya label default. Saat penugasan, posisi bisa berbeda per pekerjaan.</p>
          </div>
          {tech.status !== "INVITED" && (
            <div className="flex items-center justify-between rounded-xl border p-3">
              <div>
                <p className="text-sm font-medium text-foreground">Status</p>
                <p className="text-xs text-muted-foreground">{tech.active ? "Aktif — bisa menerima pekerjaan" : "Nonaktif"}</p>
              </div>
              <Button type="button" variant={tech.active ? "outline" : "default"} size="sm"
                className={tech.active ? "text-red-600" : "bg-emerald-500 text-white hover:bg-emerald-600"}
                onClick={onToggleActive}>
                {tech.active ? "Nonaktifkan" : "Aktifkan"}
              </Button>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Batal</Button>
          <Button onClick={save} disabled={saving || name.trim().length < 2} className="bg-sky-500 text-white hover:bg-sky-600">
            {saving ? "Menyimpan…" : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetPinDialog({ tech, onClose, onDone }: { tech: Tech; onClose: () => void; onDone: () => void }) {
  const [pin, setPin] = useState("");
  const [saving, setSaving] = useState(false);
  const valid = /^\d{6}$/.test(pin);

  async function submit() {
    setSaving(true);
    const res = await ownerResetTechnicianPin(tech.id, pin);
    setSaving(false);
    if (!res.ok) { toast.error(res.error); return; }
    toast.success(`PIN ${tech.name} berhasil direset`);
    onDone();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Reset PIN — {tech.name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Masukkan PIN baru 6 digit. Beritahukan PIN ini ke teknisi untuk login.</p>
          <div className="space-y-1.5">
            <Label htmlFor="new-pin">PIN baru (6 angka)</Label>
            <Input id="new-pin" type="tel" inputMode="numeric" maxLength={6} value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="••••••" className="h-11 rounded-xl tracking-[0.5em]" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Batal</Button>
          <Button onClick={submit} disabled={saving || !valid} className="bg-sky-500 text-white hover:bg-sky-600">
            {saving ? "Menyimpan…" : "Reset PIN"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
