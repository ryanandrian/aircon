"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ownerInviteTechnician,
  ownerRevokeInvite,
  ownerUpdateTechnician,
  ownerResetTechnicianPin,
  ownerTechnicianAssignments,
  ownerUpdateAdmin,
  ownerResetAdminPin,
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

type Position = "TEKNISI" | "KERNET";
type UserStatus = "INVITED" | "ACTIVE" | "DISABLED";
type Role = "TECHNICIAN" | "ADMIN";
interface Tech { id: string; name: string; phone: string; active: boolean; position: Position; status: UserStatus }
interface Admin { id: string; name: string; phone: string; status: UserStatus; jobTitle: string | null }
interface Invite { id: string; name: string; phone: string; token: string; role: Role; jobTitle: string | null }

const POSITION_LABEL: Record<Position, string> = { TEKNISI: "Teknisi", KERNET: "Kernet" };

export function TechnicianManager({
  appUrl, technicians, admins, invites, isOwner,
}: {
  appUrl: string; technicians: Tech[]; admins: Admin[]; invites: Invite[]; isOwner: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<Role>("TECHNICIAN");
  const [jobTitle, setJobTitle] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"TEKNISI" | "ADMIN">("TEKNISI");

  // Dialog state
  const [editTech, setEditTech] = useState<Tech | null>(null);
  const [pinTech, setPinTech] = useState<Tech | null>(null);
  const [assignTech, setAssignTech] = useState<Tech | null>(null);
  const [editAdmin, setEditAdmin] = useState<Admin | null>(null);
  const [pinAdmin, setPinAdmin] = useState<Admin | null>(null);

  function invite(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    start(async () => {
      const res = await ownerInviteTechnician(name, phone, role, jobTitle || undefined);
      if (!res.ok) { setMsg({ ok: false, text: res.error }); return; }
      setMsg({ ok: true, text: `Undangan ${role === "ADMIN" ? "admin" : "teknisi"} dibuat. Bagikan link ke yang bersangkutan.` });
      setName(""); setPhone(""); setJobTitle("");
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
    const peran = inv.role === "ADMIN" ? (inv.jobTitle?.trim() || "admin") : "teknisi";
    const text = `Halo ${inv.name}, Anda diundang jadi ${peran} di Aircon. Buka link ini untuk membuat PIN & mulai: ${url}`;
    const wa = `https://wa.me/${inv.phone}?text=${encodeURIComponent(text)}`;
    window.open(wa, "_blank");
  }

  function toggleAdminActive(a: Admin) {
    start(async () => {
      const res = await ownerUpdateAdmin(a.id, { active: !(a.status === "ACTIVE") });
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(a.status === "ACTIVE" ? "Admin dinonaktifkan" : "Admin diaktifkan");
      router.refresh();
    });
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
            <h2 className="font-semibold text-foreground">Undang Tim / Staf Baru</h2>
            {msg && <p className={`text-sm ${msg.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>{msg.text}</p>}
            {isOwner && (
              <div className="space-y-1.5">
                <Label>Peran</Label>
                <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                  <SelectTrigger className="min-h-[44px] rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TECHNICIAN">Teknisi (lapangan)</SelectItem>
                    <SelectItem value="ADMIN">Admin (kantor)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {role === "ADMIN"
                    ? "Admin mengelola pelanggan, tagihan, jadwal & laporan (tidak termasuk langganan usaha)."
                    : "Teknisi menangani pekerjaan lapangan dari HP."}
                </p>
              </div>
            )}
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
            {isOwner && role === "ADMIN" && (
              <div className="space-y-1.5">
                <Label htmlFor="jobTitle">Jabatan (opsional)</Label>
                <Input id="jobTitle" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="mis. Admin Keuangan / Admin Operasional"
                  className="min-h-[44px] rounded-xl text-base" />
                <p className="text-xs text-muted-foreground">Hanya label. Semua admin punya hak akses yang sama.</p>
              </div>
            )}
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
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground">{inv.name}</p>
                      <Badge variant="outline" className="shrink-0">{inv.role === "ADMIN" ? (inv.jobTitle?.trim() || "Admin") : "Teknisi"}</Badge>
                    </div>
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

      {/* Daftar tim dipisah per peran (kartu teknisi & admin beda bentuk) */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as "TEKNISI" | "ADMIN")} className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="TEKNISI">Teknisi ({technicians.length})</TabsTrigger>
          <TabsTrigger value="ADMIN">Admin ({admins.length})</TabsTrigger>
        </TabsList>

        {/* Panel Admin */}
        <TabsContent value="ADMIN" className="mt-3">
          {admins.length === 0 ? (
            <EmptyState
              icon={Icon.Users}
              title="Belum ada admin"
              desc="Undang admin (staf kantor) lewat form di atas — pilih peran Admin. Mereka mengelola pelanggan, tagihan & laporan."
            />
          ) : (
            <div className="space-y-3">
              {admins.map((a) => (
                <Card key={a.id} className="py-0">
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-500 font-bold text-white">
                      {a.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-semibold text-foreground">{a.name}</span>
                        <Badge variant="outline" className="shrink-0">{a.jobTitle?.trim() || "Admin"}</Badge>
                        {a.status === "INVITED" ? (
                          <Badge variant="secondary" className="shrink-0">Belum set PIN</Badge>
                        ) : a.status === "ACTIVE" ? (
                          <Badge className="shrink-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">Aktif</Badge>
                        ) : (
                          <Badge variant="secondary" className="shrink-0">Nonaktif</Badge>
                        )}
                      </div>
                      <p className="truncate text-sm text-muted-foreground">{a.phone}</p>
                    </div>
                    {isOwner && (
                      <div className="flex shrink-0 items-center gap-1">
                        <Button type="button" variant="ghost" size="icon" aria-label="Ubah" onClick={() => setEditAdmin(a)}>
                          <Icon.Note className="h-4 w-4" aria-hidden />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" aria-label="Reset PIN" title="Reset PIN" onClick={() => setPinAdmin(a)}>
                          <Icon.Shield className="h-4 w-4" aria-hidden />
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Panel Teknisi */}
        <TabsContent value="TEKNISI" className="mt-3 space-y-3">
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
                    <Button type="button" variant="outline" size="sm" className="hidden gap-1.5 sm:inline-flex" onClick={() => setAssignTech(t)}>
                      <Icon.Job className="h-4 w-4" aria-hidden /> Penugasan
                    </Button>
                    <Button type="button" variant="ghost" size="icon" aria-label="Penugasan" className="sm:hidden" onClick={() => setAssignTech(t)}>
                      <Icon.Job className="h-4 w-4" aria-hidden />
                    </Button>
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
        </TabsContent>
      </Tabs>

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
      {assignTech && (
        <AssignmentDialog tech={assignTech} onClose={() => setAssignTech(null)} />
      )}
      {editAdmin && (
        <EditAdminDialog
          admin={editAdmin}
          onClose={() => setEditAdmin(null)}
          onSaved={() => { setEditAdmin(null); router.refresh(); }}
          onToggleActive={() => { toggleAdminActive(editAdmin); setEditAdmin(null); }}
        />
      )}
      {pinAdmin && (
        <ResetAdminPinDialog
          admin={pinAdmin}
          onClose={() => setPinAdmin(null)}
          onDone={() => { setPinAdmin(null); router.refresh(); }}
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

type AssignRow = { id: string; date: string | null; customer: string; unit: string; role: "TECHNICIAN" | "KERNET"; service: string; status: string };

function EditAdminDialog({
  admin, onClose, onSaved, onToggleActive,
}: {
  admin: Admin; onClose: () => void; onSaved: () => void; onToggleActive: () => void;
}) {
  const [name, setName] = useState(admin.name);
  const [phone, setPhone] = useState(admin.phone);
  const [jobTitle, setJobTitle] = useState(admin.jobTitle ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const res = await ownerUpdateAdmin(admin.id, { name, phone, jobTitle });
    setSaving(false);
    if (!res.ok) { toast.error(res.error); return; }
    toast.success("Perubahan disimpan");
    onSaved();
  }

  const active = admin.status === "ACTIVE";
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Ubah Admin</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-admin-name">Nama</Label>
            <Input id="edit-admin-name" value={name} onChange={(e) => setName(e.target.value)} className="h-11 rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-admin-phone">Nomor HP</Label>
            <Input id="edit-admin-phone" type="tel" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-11 rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-admin-title">Jabatan (opsional)</Label>
            <Input id="edit-admin-title" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)}
              placeholder="mis. Admin Keuangan" className="h-11 rounded-xl" />
            <p className="text-xs text-muted-foreground">Hanya label. Semua admin punya hak akses yang sama.</p>
          </div>
          {admin.status !== "INVITED" && (
            <div className="flex items-center justify-between rounded-xl border p-3">
              <div>
                <p className="text-sm font-medium text-foreground">Status</p>
                <p className="text-xs text-muted-foreground">{active ? "Aktif — bisa mengelola kantor" : "Nonaktif"}</p>
              </div>
              <Button type="button" variant={active ? "outline" : "default"} size="sm"
                className={active ? "text-red-600" : "bg-emerald-500 text-white hover:bg-emerald-600"}
                onClick={onToggleActive}>
                {active ? "Nonaktifkan" : "Aktifkan"}
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

function ResetAdminPinDialog({ admin, onClose, onDone }: { admin: Admin; onClose: () => void; onDone: () => void }) {
  const [pin, setPin] = useState("");
  const [saving, setSaving] = useState(false);
  const valid = /^\d{6}$/.test(pin);

  async function submit() {
    setSaving(true);
    const res = await ownerResetAdminPin(admin.id, pin);
    setSaving(false);
    if (!res.ok) { toast.error(res.error); return; }
    toast.success(`PIN ${admin.name} berhasil direset`);
    onDone();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Reset PIN — {admin.name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Masukkan PIN baru 6 digit. Beritahukan PIN ini ke admin untuk login.</p>
          <div className="space-y-1.5">
            <Label htmlFor="new-admin-pin">PIN baru (6 angka)</Label>
            <Input id="new-admin-pin" type="tel" inputMode="numeric" maxLength={6} value={pin}
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

const SERVICE_LABEL: Record<string, string> = {
  CLEANING: "Cuci AC", REFILL_FREON: "Isi Freon", REPAIR: "Perbaikan",
  INSTALL: "Pasang Baru", DISMANTLE: "Bongkar", INSPECTION: "Pengecekan", OTHER: "Lainnya",
};
const JOB_STATUS: Record<string, string> = {
  DRAFT: "Draf", ASSIGNED: "Ditugaskan", ACCEPTED: "Diterima", EN_ROUTE: "Menuju",
  ARRIVED: "Tiba", IN_PROGRESS: "Dikerjakan", WAITING: "Menunggu", COMPLETED: "Selesai", CANCELLED: "Batal",
};

function fmtPeriod(p: string): string {
  const [y, m] = p.split("-");
  const bulan = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  return `${bulan[Number(m) - 1] ?? m} ${y}`;
}
const fmtRowDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "—";

function AssignmentDialog({ tech, onClose }: { tech: Tech; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AssignRow[]>([]);
  const [periods, setPeriods] = useState<string[]>([]);
  const [period, setPeriod] = useState<string>("ALL");

  async function load(p: string) {
    setLoading(true);
    const res = await ownerTechnicianAssignments(tech.id, p === "ALL" ? undefined : p);
    setLoading(false);
    if (!res.ok) { toast.error(res.error); return; }
    setRows(res.rows);
    setPeriods(res.periods);
  }

  useEffect(() => { queueMicrotask(() => load("ALL")); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  function changePeriod(p: string | null) { const v = p ?? "ALL"; setPeriod(v); load(v); }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-2xl">
        <DialogHeader><DialogTitle>Penugasan — {tech.name}</DialogTitle></DialogHeader>

        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">{rows.length} pekerjaan</p>
          <Select value={period} onValueChange={changePeriod}>
            <SelectTrigger className="h-10 w-44 rounded-xl">
              <SelectValue>{(v: string | null) => (v && v !== "ALL" ? fmtPeriod(v) : "Semua periode")}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua periode</SelectItem>
              {periods.map((p) => <SelectItem key={p} value={p}>{fmtPeriod(p)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="-mx-6 overflow-auto px-6" style={{ maxHeight: "55vh" }}>
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Memuat…</p>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Belum ada penugasan{period !== "ALL" ? " pada periode ini" : ""}.</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-2 font-medium">No</th>
                  <th className="py-2 pr-2 font-medium">Tgl</th>
                  <th className="py-2 pr-2 font-medium">Pelanggan</th>
                  <th className="py-2 pr-2 font-medium">Unit</th>
                  <th className="py-2 pr-2 font-medium">Posisi</th>
                  <th className="py-2 pr-2 font-medium">Layanan</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id} className="border-b last:border-0 align-top">
                    <td className="py-2 pr-2 tabular-nums text-muted-foreground">{i + 1}</td>
                    <td className="py-2 pr-2 whitespace-nowrap">{fmtRowDate(r.date)}</td>
                    <td className="py-2 pr-2">{r.customer}</td>
                    <td className="py-2 pr-2">{r.unit}</td>
                    <td className="py-2 pr-2">
                      <Badge variant={r.role === "KERNET" ? "secondary" : "outline"} className="whitespace-nowrap">
                        {r.role === "KERNET" ? "Kernet" : "Teknisi"}
                      </Badge>
                    </td>
                    <td className="py-2 pr-2">{SERVICE_LABEL[r.service] ?? r.service}</td>
                    <td className="py-2">
                      <Badge variant={r.status === "COMPLETED" ? "secondary" : r.status === "CANCELLED" ? "outline" : "outline"} className="whitespace-nowrap">
                        {JOB_STATUS[r.status] ?? r.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Tutup</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
