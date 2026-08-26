"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actionCreateAgent, actionUpdateAgent, actionBuildPayouts, actionMarkPaid, actionIssueAgentToken } from "./actions";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import type { CommissionType, PartnerStatus, PartnerTaxStatus, PayoutStatus } from "@prisma/client";

interface AgentView {
  id: string; companyName: string; picEmail: string; status: PartnerStatus;
  commissionType: CommissionType; commissionValue: number; taxStatus: PartnerTaxStatus;
  code: string | null; joinCode: string | null; resellerCount: number; tenantCount: number; commissionThisMonth: number;
}
interface PayoutView {
  id: string; agentName: string; period: string; gross: number; tax: number; net: number; status: PayoutStatus;
}

const rupiah = (n: number) => "Rp " + n.toLocaleString("id-ID");
const TAX_LABEL: Record<PartnerTaxStatus, string> = {
  BADAN_NPWP: "Badan ber-NPWP (2%)", BADAN_NON_NPWP: "Badan tanpa NPWP (4%)",
  PERORANGAN: "Perorangan (2,5%)", PKP: "PKP (2% + PPN faktur)",
};

const selectCls = "mt-1 min-h-[42px] w-full rounded-xl border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export function KeagenanManager({ agents, payouts }: { agents: AgentView[]; payouts: PayoutView[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  function toast(ok: boolean, text: string) { setMsg({ ok, text }); setTimeout(() => setMsg(null), 4000); }

  function createAgent(fd: FormData) {
    start(async () => {
      const res = await actionCreateAgent(fd);
      if (res.ok) { toast(true, "Agen dibuat. Bagikan kode & tautan pendaftaran reseller."); setShowForm(false); router.refresh(); }
      else toast(false, res.error);
    });
  }
  function updateAgent(agentId: string, fd: FormData) {
    start(async () => {
      const res = await actionUpdateAgent(agentId, fd);
      if (res.ok) { toast(true, "Tersimpan"); setEditId(null); router.refresh(); }
      else toast(false, res.error);
    });
  }
  function buildPayouts() {
    start(async () => {
      const res = await actionBuildPayouts();
      if (res.ok) { toast(true, "Draft pencairan bulan lalu disusun."); router.refresh(); }
      else toast(false, res.error);
    });
  }
  function markPaid(id: string) {
    const ref = window.prompt("Nomor/bukti transfer:");
    if (!ref) return;
    start(async () => {
      const res = await actionMarkPaid(id, ref);
      if (res.ok) { toast(true, "Ditandai lunas."); router.refresh(); }
      else toast(false, res.error);
    });
  }
  function copy(text: string, key: string) {
    navigator.clipboard?.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 1500);
  }
  function inviteAgent(agentId: string) {
    start(async () => {
      const res = await actionIssueAgentToken(agentId);
      if (res.ok) {
        const full = window.location.origin + res.url;
        navigator.clipboard?.writeText(full);
        toast(true, "Tautan aktivasi login agen tersalin — kirim ke PIC agen.");
      } else toast(false, res.error);
    });
  }

  const appUrl = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="space-y-6">
      {msg && (
        <p className={`rounded-xl px-4 py-3 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400" : "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400"}`}>{msg.text}</p>
      )}

      {/* Agen */}
      <section className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Agen ({agents.length})</h2>
          <Button type="button" onClick={() => setShowForm((s) => !s)} className="bg-sky-500 text-white hover:bg-sky-600">
            {showForm ? "Tutup" : "+ Agen Baru"}
          </Button>
        </div>

        {showForm && (
          <form action={createAgent} className="mt-4 grid gap-3 rounded-xl border bg-muted/40 p-4 sm:grid-cols-2">
            <label className="text-sm text-foreground">Nama Perusahaan/Agen*<Input name="companyName" required className="mt-1 min-h-[42px]" /></label>
            <label className="text-sm text-foreground">Nama PIC<Input name="picName" className="mt-1 min-h-[42px]" /></label>
            <label className="text-sm text-foreground">Email PIC*<Input name="picEmail" type="email" required className="mt-1 min-h-[42px]" /></label>
            <label className="text-sm text-foreground">No. HP PIC<Input name="picPhone" className="mt-1 min-h-[42px]" /></label>
            <label className="text-sm text-foreground">Tipe Komisi
              <select name="commissionType" className={selectCls} defaultValue="PERCENT">
                <option value="PERCENT">Persen (%)</option>
                <option value="FLAT_IDR">Rupiah tetap / bulan</option>
              </select>
            </label>
            <label className="text-sm text-foreground">Nilai Komisi<Input name="commissionValue" type="number" step="0.01" min="0" required className="mt-1 min-h-[42px]" placeholder="mis. 20 atau 50000" /></label>
            <label className="text-sm text-foreground">Status Pajak
              <select name="taxStatus" className={selectCls} defaultValue="BADAN_NPWP">
                {Object.entries(TAX_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="text-sm text-foreground">NPWP<Input name="npwp" className="mt-1 min-h-[42px]" /></label>
            <label className="text-sm text-foreground">Nama Bank<Input name="bankName" className="mt-1 min-h-[42px]" /></label>
            <label className="text-sm text-foreground">No. Rekening (terenkripsi)<Input name="bankAccount" className="mt-1 min-h-[42px]" /></label>
            <label className="text-sm text-foreground">Atas Nama<Input name="bankHolder" className="mt-1 min-h-[42px]" /></label>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={pending} className="min-h-[42px] bg-sky-500 px-5 text-white hover:bg-sky-600">
                {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                {pending ? "Menyimpan…" : "Buat Agen"}
              </Button>
            </div>
          </form>
        )}

        <div className="mt-4 space-y-3">
          {agents.length === 0 ? (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Belum ada agen. Rekrut mitra pemasaran &amp; buat di sini.</p>
          ) : agents.map((a) => (
            <div key={a.id} className="rounded-xl border p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">{a.companyName}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${a.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}>{a.status === "ACTIVE" ? "Aktif" : "Nonaktif"}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{a.picEmail}</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Komisi: <b className="text-foreground">{a.commissionType === "PERCENT" ? `${a.commissionValue}%` : rupiah(a.commissionValue) + "/bln"}</b>
                    {" · "}{a.tenantCount} pelanggan · {a.resellerCount} reseller
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Komisi bulan ini</div>
                  <div className="font-bold tabular-nums text-sky-600">{rupiah(a.commissionThisMonth)}</div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {a.code && (
                  <button onClick={() => copy(a.code!, `code-${a.id}`)} className="inline-flex items-center gap-1 rounded-lg bg-muted px-3 py-1.5 text-xs font-medium text-foreground">
                    Kode agen: <b>{a.code}</b> {copied === `code-${a.id}` ? <Icon.Check className="h-3.5 w-3.5" aria-hidden /> : <Icon.Copy className="h-3.5 w-3.5" aria-hidden />}
                  </button>
                )}
                {a.joinCode && (
                  <button onClick={() => copy(`${appUrl}/agen/daftar/${a.joinCode}`, `join-${a.id}`)} className="inline-flex items-center gap-1 rounded-lg bg-muted px-3 py-1.5 text-xs font-medium text-foreground">
                    Tautan rekrut reseller {copied === `join-${a.id}` ? <span className="inline-flex items-center gap-1"><Icon.Check className="h-3.5 w-3.5" aria-hidden /> tersalin</span> : <Icon.Copy className="h-3.5 w-3.5" aria-hidden />}
                  </button>
                )}
                <Button type="button" variant="outline" size="sm" onClick={() => setEditId(editId === a.id ? null : a.id)}>
                  {editId === a.id ? "Batal" : "Ubah rate/status"}
                </Button>
                <Button type="button" size="sm" onClick={() => inviteAgent(a.id)} disabled={pending} className="border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 dark:border-sky-900/40 dark:bg-sky-950/40 dark:text-sky-300">
                  Undang login portal
                </Button>
              </div>

              {editId === a.id && (
                <form action={(fd) => updateAgent(a.id, fd)} className="mt-3 grid gap-2 rounded-lg bg-muted/40 p-3 sm:grid-cols-4">
                  <label className="text-xs text-foreground">Tipe
                    <select name="commissionType" defaultValue={a.commissionType} className={selectCls}>
                      <option value="PERCENT">Persen</option><option value="FLAT_IDR">Rupiah</option>
                    </select>
                  </label>
                  <label className="text-xs text-foreground">Nilai<Input name="commissionValue" type="number" step="0.01" defaultValue={a.commissionValue} className="mt-1 min-h-[42px]" /></label>
                  <label className="text-xs text-foreground">Status
                    <select name="status" defaultValue={a.status} className={selectCls}>
                      <option value="ACTIVE">Aktif</option><option value="SUSPENDED">Nonaktif</option>
                    </select>
                  </label>
                  <div className="flex items-end">
                    <Button type="submit" disabled={pending} className="min-h-[42px] w-full bg-sky-500 text-white hover:bg-sky-600">
                      {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                      Simpan
                    </Button>
                  </div>
                </form>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Pencairan */}
      <section className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Pencairan Komisi</h2>
          <Button type="button" variant="outline" onClick={buildPayouts} disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Susun Draft Bulan Lalu
          </Button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Draft dihitung dari buku besar (komisi terkumpul − refund). Owner menyetujui &amp; mencatat bukti transfer.</p>
        <div className="mt-3 space-y-2">
          {payouts.length === 0 ? (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Belum ada pencairan. Klik &quot;Susun Draft&quot; setelah ada komisi.</p>
          ) : payouts.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3">
              <div>
                <div className="text-sm font-medium text-foreground">{p.agentName}</div>
                <div className="text-xs text-muted-foreground">{p.period}</div>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <div>Bruto {rupiah(p.gross)} · PPh {rupiah(p.tax)}</div>
                <div className="text-sm font-bold text-foreground">Bersih {rupiah(p.net)}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.status === "PAID" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" : p.status === "APPROVED" ? "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300" : "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"}`}>
                  {p.status === "PAID" ? "Lunas" : p.status === "APPROVED" ? "Disetujui" : "Draft"}
                </span>
                {p.status !== "PAID" && (
                  <Button type="button" size="sm" onClick={() => markPaid(p.id)} disabled={pending} className="bg-emerald-500 text-white hover:bg-emerald-600">
                    {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
                    Tandai Lunas
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
