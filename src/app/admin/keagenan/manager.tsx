"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actionCreateAgent, actionUpdateAgent, actionBuildPayouts, actionMarkPaid, actionIssueAgentToken } from "./actions";
import { Icon } from "@/components/icons";
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
  const field = "mt-1 min-h-[42px] w-full rounded-xl border border-slate-300 px-3 py-2 text-sm";

  return (
    <div className="space-y-6">
      {msg && (
        <p className={`rounded-xl px-4 py-3 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{msg.text}</p>
      )}

      {/* Agen */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Agen ({agents.length})</h2>
          <button onClick={() => setShowForm((s) => !s)} className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600">
            {showForm ? "Tutup" : "+ Agen Baru"}
          </button>
        </div>

        {showForm && (
          <form action={createAgent} className="mt-4 grid gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4 sm:grid-cols-2">
            <label className="text-sm">Nama Perusahaan/Agen*<input name="companyName" required className={field} /></label>
            <label className="text-sm">Nama PIC<input name="picName" className={field} /></label>
            <label className="text-sm">Email PIC*<input name="picEmail" type="email" required className={field} /></label>
            <label className="text-sm">No. HP PIC<input name="picPhone" className={field} /></label>
            <label className="text-sm">Tipe Komisi
              <select name="commissionType" className={field} defaultValue="PERCENT">
                <option value="PERCENT">Persen (%)</option>
                <option value="FLAT_IDR">Rupiah tetap / bulan</option>
              </select>
            </label>
            <label className="text-sm">Nilai Komisi<input name="commissionValue" type="number" step="0.01" min="0" required className={field} placeholder="mis. 20 atau 50000" /></label>
            <label className="text-sm">Status Pajak
              <select name="taxStatus" className={field} defaultValue="BADAN_NPWP">
                {Object.entries(TAX_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="text-sm">NPWP<input name="npwp" className={field} /></label>
            <label className="text-sm">Nama Bank<input name="bankName" className={field} /></label>
            <label className="text-sm">No. Rekening (terenkripsi)<input name="bankAccount" className={field} /></label>
            <label className="text-sm">Atas Nama<input name="bankHolder" className={field} /></label>
            <div className="sm:col-span-2">
              <button type="submit" disabled={pending} className="min-h-[42px] rounded-xl bg-sky-500 px-5 text-sm font-semibold text-white hover:bg-sky-600 disabled:opacity-50">
                {pending ? "Menyimpan…" : "Buat Agen"}
              </button>
            </div>
          </form>
        )}

        <div className="mt-4 space-y-3">
          {agents.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400">Belum ada agen. Rekrut mitra pemasaran & buat di sini.</p>
          ) : agents.map((a) => (
            <div key={a.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900">{a.companyName}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${a.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"}`}>{a.status === "ACTIVE" ? "Aktif" : "Nonaktif"}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">{a.picEmail}</div>
                  <div className="mt-1 text-sm text-slate-600">
                    Komisi: <b>{a.commissionType === "PERCENT" ? `${a.commissionValue}%` : rupiah(a.commissionValue) + "/bln"}</b>
                    {" · "}{a.tenantCount} pelanggan · {a.resellerCount} reseller
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400">Komisi bulan ini</div>
                  <div className="font-bold tabular-nums text-sky-600">{rupiah(a.commissionThisMonth)}</div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {a.code && (
                  <button onClick={() => copy(a.code!, `code-${a.id}`)} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700">
                    Kode agen: <b>{a.code}</b> {copied === `code-${a.id}` ? <Icon.Check className="h-3.5 w-3.5" aria-hidden /> : <Icon.Copy className="h-3.5 w-3.5" aria-hidden />}
                  </button>
                )}
                {a.joinCode && (
                  <button onClick={() => copy(`${appUrl}/agen/daftar/${a.joinCode}`, `join-${a.id}`)} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700">
                    Tautan rekrut reseller {copied === `join-${a.id}` ? <span className="inline-flex items-center gap-1"><Icon.Check className="h-3.5 w-3.5" aria-hidden /> tersalin</span> : <Icon.Copy className="h-3.5 w-3.5" aria-hidden />}
                  </button>
                )}
                <button onClick={() => setEditId(editId === a.id ? null : a.id)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600">
                  {editId === a.id ? "Batal" : "Ubah rate/status"}
                </button>
                <button onClick={() => inviteAgent(a.id)} disabled={pending} className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700 disabled:opacity-50">
                  Undang login portal
                </button>
              </div>

              {editId === a.id && (
                <form action={(fd) => updateAgent(a.id, fd)} className="mt-3 grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-4">
                  <label className="text-xs">Tipe
                    <select name="commissionType" defaultValue={a.commissionType} className={field}>
                      <option value="PERCENT">Persen</option><option value="FLAT_IDR">Rupiah</option>
                    </select>
                  </label>
                  <label className="text-xs">Nilai<input name="commissionValue" type="number" step="0.01" defaultValue={a.commissionValue} className={field} /></label>
                  <label className="text-xs">Status
                    <select name="status" defaultValue={a.status} className={field}>
                      <option value="ACTIVE">Aktif</option><option value="SUSPENDED">Nonaktif</option>
                    </select>
                  </label>
                  <div className="flex items-end">
                    <button type="submit" disabled={pending} className="min-h-[42px] w-full rounded-xl bg-sky-500 text-sm font-semibold text-white disabled:opacity-50">Simpan</button>
                  </div>
                </form>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Pencairan */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Pencairan Komisi</h2>
          <button onClick={buildPayouts} disabled={pending} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            Susun Draft Bulan Lalu
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-500">Draft dihitung dari buku besar (komisi terkumpul − refund). Owner menyetujui & mencatat bukti transfer.</p>
        <div className="mt-3 space-y-2">
          {payouts.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400">Belum ada pencairan. Klik "Susun Draft" setelah ada komisi.</p>
          ) : payouts.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-3">
              <div>
                <div className="text-sm font-medium text-slate-900">{p.agentName}</div>
                <div className="text-xs text-slate-500">{p.period}</div>
              </div>
              <div className="text-right text-xs text-slate-500">
                <div>Bruto {rupiah(p.gross)} · PPh {rupiah(p.tax)}</div>
                <div className="text-sm font-bold text-slate-900">Bersih {rupiah(p.net)}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.status === "PAID" ? "bg-emerald-100 text-emerald-700" : p.status === "APPROVED" ? "bg-sky-100 text-sky-700" : "bg-amber-100 text-amber-700"}`}>
                  {p.status === "PAID" ? "Lunas" : p.status === "APPROVED" ? "Disetujui" : "Draft"}
                </span>
                {p.status !== "PAID" && (
                  <button onClick={() => markPaid(p.id)} disabled={pending} className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                    Tandai Lunas
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
