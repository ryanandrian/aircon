"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actionApproveReseller, actionRejectReseller } from "@/app/agen/actions";
import { CopyButton } from "@/app/agen/copy-button";

interface ResellerView {
  id: string; name: string; status: string;
  commissionType: string; commissionValue: number; bankMasked: string | null;
}

export function ResellerManager({ joinCode, resellers }: { joinCode: string | null; resellers: ResellerView[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function approve(id: string, fd: FormData) {
    start(async () => {
      const res = await actionApproveReseller(id, fd);
      setMsg(res.ok ? "Reseller disetujui — tautan aktivasi dibuat." : res.error);
      if (res.ok) router.refresh();
    });
  }
  function reject(id: string) {
    if (!confirm("Tolak pendaftaran reseller ini?")) return;
    start(async () => {
      const res = await actionRejectReseller(id);
      setMsg(res.ok ? "Ditolak." : res.error);
      if (res.ok) router.refresh();
    });
  }

  const pendingList = resellers.filter((r) => r.status === "PENDING");
  const activeList = resellers.filter((r) => r.status === "ACTIVE");
  const field = "mt-1 min-h-[40px] w-full rounded-lg border border-slate-300 px-3 text-sm";

  return (
    <div className="space-y-4">
      {msg && <p className="rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700">{msg}</p>}

      {joinCode && (
        <section className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="min-w-0">
            <div className="text-xs text-slate-400">Tautan rekrut reseller (bagikan)</div>
            <div className="truncate text-sm text-slate-700">…/reseller/daftar/{joinCode}</div>
          </div>
          <CopyButton text={`/reseller/daftar/${joinCode}`} full />
        </section>
      )}

      {/* Menunggu persetujuan */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-500">Menunggu Persetujuan ({pendingList.length})</h2>
        {pendingList.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">Tidak ada pendaftaran baru.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {pendingList.map((r) => (
              <form key={r.id} action={(fd) => approve(r.id, fd)} className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <div className="font-medium text-slate-900">{r.name}</div>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  <label className="text-xs">Tipe komisi
                    <select name="commissionType" defaultValue="FLAT_IDR" className={field}>
                      <option value="FLAT_IDR">Rupiah / pembayaran</option>
                      <option value="PERCENT">Persen</option>
                    </select>
                  </label>
                  <label className="text-xs">Nilai
                    <input name="commissionValue" type="number" min="0" step="0.01" required className={field} placeholder="mis. 25000" />
                  </label>
                  <div className="flex items-end gap-2">
                    <button type="submit" disabled={pending} className="min-h-[40px] flex-1 rounded-lg bg-sky-500 text-sm font-semibold text-white disabled:opacity-50">Setujui</button>
                    <button type="button" onClick={() => reject(r.id)} className="min-h-[40px] rounded-lg border border-slate-300 px-3 text-sm text-slate-500">Tolak</button>
                  </div>
                </div>
              </form>
            ))}
          </div>
        )}
      </section>

      {/* Reseller aktif + export */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-500">Reseller Aktif ({activeList.length})</h2>
          {activeList.length > 0 && (
            <a href="/api/agen/reseller-export" className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
              ⬇ Export CSV Transfer
            </a>
          )}
        </div>
        {activeList.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">Belum ada reseller aktif.</p>
        ) : (
          <div className="mt-3 divide-y divide-slate-100">
            {activeList.map((r) => (
              <div key={r.id} className="flex items-center justify-between py-2.5 text-sm">
                <div>
                  <div className="font-medium text-slate-900">{r.name}</div>
                  <div className="text-xs text-slate-400">
                    Komisi {r.commissionType === "PERCENT" ? `${r.commissionValue}%` : "Rp " + r.commissionValue.toLocaleString("id-ID")}
                    {r.bankMasked ? " · rekening ✓" : " · rekening —"}
                  </div>
                </div>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">Aktif</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
