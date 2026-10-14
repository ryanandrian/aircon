"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actionAssignTeam, actionCheckTeamConflicts, actionResendAssignPush, type AssignPushResult } from "../actions";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/icons";

interface TechOption { id: string; name: string; }
type Role = "TECHNICIAN" | "KERNET";
interface Member { personId: string; roleOnJob: Role; }

export function OwnerActions({
  jobId, canAssign, technicians, defaultDate, initialTeam,
}: {
  jobId: string;
  canAssign: boolean;
  technicians: TechOption[];
  defaultDate: string;
  initialTeam?: { personId: string; roleOnJob: Role }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  // G-A9b: push gagal → panel + tombol Kirim Ulang (tanpa refresh; permintaan pemilik).
  const [retryPush, setRetryPush] = useState<{ personIds: string[]; names: string } | null>(null);
  const [resending, startResend] = useTransition();

  const [showAssign, setShowAssign] = useState(false);
  const [members, setMembers] = useState<Member[]>(
    initialTeam && initialTeam.length ? initialTeam.map((m) => ({ personId: m.personId, roleOnJob: m.roleOnJob }))
      : technicians[0] ? [{ personId: technicians[0].id, roleOnJob: "TECHNICIAN" }] : [],
  );
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState("09:00");
  const [durationMin, setDurationMin] = useState(60);
  const [conflicts, setConflicts] = useState<{ name: string; conflicts: { customerName: string }[] }[] | null>(null);

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

  // Toast sukses otomatis hilang beberapa detik (permintaan pemilik: "pesan ke
  // admin panel beberapa saat lalu otomatis hilang — tanpa refresh").
  useEffect(() => {
    if (msg?.kind !== "ok") return;
    const t = window.setTimeout(() => setMsg(null), 5000);
    return () => window.clearTimeout(t);
  }, [msg]);

  function submitAssign() {
    setMsg(null); setRetryPush(null);
    start(async () => {
      const res = await actionAssignTeam(jobId, members, date, time, durationMin);
      if (!res.ok) { setMsg({ kind: "err", text: res.error }); return; }
      // push-report dari server: totalFailed>0 → tawarkan kirim ulang.
      const report: AssignPushResult | undefined = (res as { data?: AssignPushResult }).data;
      const failedPeople = report?.perPerson.filter((p) => p.failed > 0) ?? [];
      if (failedPeople.length > 0) {
        const names = failedPeople.map((p) => p.name ?? "personel").join(", ");
        setRetryPush({ personIds: failedPeople.map((p) => p.personId), names });
        setMsg({ kind: "err", text: `Penugasan tersimpan, tapi notifikasi ke ${names} GAGAL terkirim.` });
      } else {
        const sent = report?.totalSent ?? 0;
        setMsg({ kind: "ok", text: sent > 0 ? `Tim ditugaskan · notifikasi terkirim ke ${sent} personel.` : "Tim berhasil ditugaskan." });
      }
      setShowAssign(false);
      router.refresh();
    });
  }

  function resendFailedPush() {
    if (!retryPush) return;
    startResend(async () => {
      const r = await actionResendAssignPush(jobId, retryPush.personIds);
      if (!r.ok) { setMsg({ kind: "err", text: `Kirim ulang gagal: ${r.error}` }); return; }
      const stillFailed = r.data?.perPerson.filter((p) => p.failed > 0) ?? [];
      if (stillFailed.length > 0) {
        setRetryPush({ personIds: stillFailed.map((p) => p.personId), names: stillFailed.map((p) => p.name ?? "personel").join(", ") });
        setMsg({ kind: "err", text: `Masih gagal untuk ${retryPush.names}. Coba lagi atau periksa HP teknisi.` });
      } else {
        setRetryPush(null);
        setMsg({ kind: "ok", text: "Notifikasi berhasil dikirim ulang." });
      }
    });
  }

  // Aksi "Batalkan pekerjaan" pindah ke komponen sendiri (CancelJobPanel),
  // dirender di LUAR kartu — lihat catatan pada file cancel-job.tsx.
  if (!canAssign) return null;
  const nameOf = (id: string) => technicians.find((t) => t.id === id)?.name ?? "—";

  // Komponen ini dirender sebagai BAGIAN dari kartu "Jadwal & Tim" (keputusan gabung
  // kartu view+edit). Pembungkus <Card>/judul berada di halaman detail — di sini hanya
  // panel edit + aksinya, dipisah garis pemisah dari baris jadwal/tim di atasnya.
  return (
    <div id="jadwal-tim" className="mt-4 border-t border-border pt-4">
      <p className="text-xs text-muted-foreground">
        Atur <span className="font-medium text-foreground">jadwal (tanggal &amp; jam)</span> dan
        <span className="font-medium text-foreground"> tim</span> pekerjaan — keduanya tersimpan bersamaan saat Anda menekan Simpan Penugasan.
      </p>

      {msg && (
        <p role={msg.kind === "err" ? "alert" : "status"}
          className={`mt-3 rounded-xl border px-4 py-3 text-sm ${msg.kind === "err"
            ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-400"
            : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/50 dark:text-emerald-400"}`}>
          {msg.text}
        </p>
      )}
      {retryPush && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/50 dark:text-amber-300">
          <span>Notifikasi ke <b>{retryPush.names}</b> gagal terkirim.</span>
          <Button type="button" size="sm" variant="outline" disabled={resending}
            onClick={resendFailedPush} className="min-h-9">
            {resending ? "Mengirim…" : "Kirim Ulang"}
          </Button>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" onClick={() => setShowAssign((v) => !v)}
          size="lg" className="min-h-[44px] bg-sky-500 text-white hover:bg-sky-600">
          {technicians.length ? "Atur Jadwal & Tim" : "Teknisi belum ada"}
        </Button>
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
      </div>
  );
}
