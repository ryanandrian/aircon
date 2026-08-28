"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actionAssignTeam, actionCheckTeamConflicts, actionCancelJob } from "../actions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/icons";

interface TechOption { id: string; name: string; }
type Role = "TECHNICIAN" | "KERNET";
interface Member { personId: string; roleOnJob: Role; }

export function OwnerActions({
  jobId, canAssign, canCancel, technicians, defaultDate, initialTeam,
}: {
  jobId: string;
  canAssign: boolean;
  canCancel: boolean;
  technicians: TechOption[];
  defaultDate: string;
  initialTeam?: { personId: string; roleOnJob: Role }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const [showAssign, setShowAssign] = useState(false);
  const [members, setMembers] = useState<Member[]>(
    initialTeam && initialTeam.length ? initialTeam.map((m) => ({ personId: m.personId, roleOnJob: m.roleOnJob }))
      : technicians[0] ? [{ personId: technicians[0].id, roleOnJob: "TECHNICIAN" }] : [],
  );
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState("09:00");
  const [durationMin, setDurationMin] = useState(60);
  const [conflicts, setConflicts] = useState<{ name: string; conflicts: { customerName: string }[] }[] | null>(null);

  const [showCancel, setShowCancel] = useState(false);
  const [reason, setReason] = useState("");

  // personel yang belum dipilih (untuk dropdown tambah)
  const chosen = new Set(members.map((m) => m.personId));
  const available = technicians.filter((t) => !chosen.has(t.id));

  function addMember() {
    if (available[0]) setMembers((m) => [...m, { personId: available[0].id, roleOnJob: "KERNET" }]);
  }
  function removeMember(pid: string) { setMembers((m) => m.filter((x) => x.personId !== pid)); }
  function setRole(pid: string, role: Role) { setMembers((m) => m.map((x) => x.personId === pid ? { ...x, roleOnJob: role } : x)); }
  function setPerson(idx: number, pid: string) { setMembers((m) => m.map((x, i) => i === idx ? { ...x, personId: pid } : x)); }

  async function checkConflicts() {
    setMsg(null); setConflicts(null);
    const res = await actionCheckTeamConflicts(members.map((m) => m.personId), date, time, durationMin, jobId);
    if (!res.ok) { setMsg({ kind: "err", text: res.error }); return; }
    setConflicts(res.data ?? []);
  }

  function submitAssign() {
    setMsg(null);
    start(async () => {
      const res = await actionAssignTeam(jobId, members, date, time, durationMin);
      if (!res.ok) { setMsg({ kind: "err", text: res.error }); return; }
      setMsg({ kind: "ok", text: "Tim berhasil ditugaskan." });
      setShowAssign(false);
      router.refresh();
    });
  }

  function submitCancel() {
    setMsg(null);
    start(async () => {
      const res = await actionCancelJob(jobId, reason);
      if (!res.ok) { setMsg({ kind: "err", text: res.error }); return; }
      setMsg({ kind: "ok", text: "Pekerjaan dibatalkan." });
      setShowCancel(false);
      router.refresh();
    });
  }

  if (!canAssign && !canCancel) return null;
  const nameOf = (id: string) => technicians.find((t) => t.id === id)?.name ?? "—";

  return (
    <Card>
      <CardContent className="p-5">
        <h2 className="text-base font-bold text-foreground">Aksi Pemilik</h2>

        {msg && (
          <p role={msg.kind === "err" ? "alert" : "status"}
            className={`mt-3 rounded-xl border px-4 py-3 text-sm ${msg.kind === "err"
              ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-400"
              : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/50 dark:text-emerald-400"}`}>
            {msg.text}
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {canAssign && (
            <Button type="button" onClick={() => { setShowAssign((v) => !v); setShowCancel(false); }}
              size="lg" className="min-h-[44px] bg-sky-500 text-white hover:bg-sky-600">
              {technicians.length ? "Tugaskan Tim" : "Teknisi belum ada"}
            </Button>
          )}
          {canCancel && (
            <Button type="button" variant="outline" onClick={() => { setShowCancel((v) => !v); setShowAssign(false); }}
              size="lg" className="min-h-[44px] border-red-300 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/40">
              Batalkan
            </Button>
          )}
        </div>

        {showAssign && technicians.length > 0 && (
          <div className="mt-4 space-y-4 rounded-2xl bg-muted/40 p-4">
            <div className="space-y-2">
              <Label>Personel & Peran</Label>
              <p className="text-xs text-muted-foreground">Peran bisa berbeda tiap pekerjaan — 1 orang bisa jadi teknisi di sini, kernet di tempat lain.</p>
              {members.map((m, idx) => (
                <div key={m.personId} className="flex items-center gap-2">
                  <select
                    value={m.personId}
                    onChange={(e) => setPerson(idx, e.target.value)}
                    className="min-h-[44px] flex-1 rounded-xl border bg-background px-3 text-sm"
                  >
                    <option value={m.personId}>{nameOf(m.personId)}</option>
                    {available.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <div className="flex overflow-hidden rounded-xl border">
                    <button type="button" onClick={() => setRole(m.personId, "TECHNICIAN")}
                      className={`px-3 py-2 text-xs font-medium ${m.roleOnJob === "TECHNICIAN" ? "bg-sky-500 text-white" : "bg-background text-muted-foreground"}`}>Teknisi</button>
                    <button type="button" onClick={() => setRole(m.personId, "KERNET")}
                      className={`px-3 py-2 text-xs font-medium ${m.roleOnJob === "KERNET" ? "bg-sky-500 text-white" : "bg-background text-muted-foreground"}`}>Kernet</button>
                  </div>
                  {members.length > 1 && (
                    <button type="button" onClick={() => removeMember(m.personId)} aria-label="Hapus personel" className="p-1 text-destructive">
                      <Icon.Close className="h-4 w-4" aria-hidden />
                    </button>
                  )}
                </div>
              ))}
              {available.length > 0 && (
                <Button type="button" variant="ghost" size="sm" onClick={addMember}>+ Tambah personel</Button>
              )}
              <p className="text-xs text-muted-foreground">Personel pertama = penanggung jawab (lead).</p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="assign-date">Tanggal</Label>
                <Input id="assign-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="min-h-[44px] rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="assign-time">Jam</Label>
                <Input id="assign-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className="min-h-[44px] rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="assign-dur">Durasi (mnt)</Label>
                <Input id="assign-dur" type="number" min="15" step="15" value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value) || 60)} className="min-h-[44px] rounded-xl" />
              </div>
            </div>

            <Button type="button" variant="outline" size="sm" onClick={checkConflicts} disabled={!date}>
              <Icon.Calendar className="h-4 w-4" aria-hidden /> Cek bentrok jadwal
            </Button>
            {conflicts !== null && (
              conflicts.length === 0 ? (
                <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-400">✓ Tidak ada bentrok jadwal.</p>
              ) : (
                <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
                  <p className="font-semibold">⚠ Peringatan bentrok jadwal:</p>
                  {conflicts.map((c) => (
                    <p key={c.name}>{c.name}: bentrok dgn {c.conflicts.map((x) => x.customerName).join(", ")}</p>
                  ))}
                  <p className="mt-1">Anda tetap bisa menyimpan bila memang disengaja.</p>
                </div>
              )
            )}

            <SubmitButton type="button" onClick={submitAssign} pending={pending}
              disabled={members.length === 0 || !date}
              pendingLabel="Menyimpan…" size="lg"
              className="min-h-[48px] w-full rounded-2xl bg-sky-500 px-6 text-white hover:bg-sky-600">
              Simpan Penugasan
            </SubmitButton>
          </div>
        )}

        {showCancel && (
          <div className="mt-4 space-y-3 rounded-2xl bg-muted/40 p-4">
            <div className="space-y-1.5">
              <Label htmlFor="cancel-reason">Alasan pembatalan</Label>
              <Textarea id="cancel-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)}
                placeholder="Contoh: pelanggan menunda, alamat tidak ditemukan…" className="rounded-2xl text-base" />
            </div>
            <SubmitButton type="button" onClick={submitCancel} pending={pending} pendingLabel="Memproses…" size="lg"
              className="min-h-[48px] w-full rounded-2xl bg-red-500 px-6 text-white hover:bg-red-600">
              Ya, Batalkan Pekerjaan
            </SubmitButton>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
