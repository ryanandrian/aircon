"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actionApproveReseller, actionRejectReseller } from "@/app/agen/actions";
import { CopyButton } from "@/app/agen/copy-button";
import { Icon } from "@/components/icons";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/empty-state";
import { Loader2 } from "lucide-react";

interface ResellerView {
  id: string; name: string; status: string;
  commissionType: string; commissionValue: number; bankMasked: string | null;
}

const selectCls = "mt-1 min-h-[40px] w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

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

  return (
    <div className="space-y-4">
      {msg && <p className="rounded-xl bg-muted px-4 py-3 text-sm text-foreground">{msg}</p>}

      {joinCode && (
        <section className="flex items-center justify-between gap-2 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">Tautan rekrut reseller (bagikan)</div>
            <div className="truncate text-sm text-foreground">…/reseller/daftar/{joinCode}</div>
          </div>
          <CopyButton text={`/reseller/daftar/${joinCode}`} full />
        </section>
      )}

      {/* Menunggu persetujuan */}
      <section className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
        <h2 className="text-sm font-semibold text-muted-foreground">Menunggu Persetujuan ({pendingList.length})</h2>
        {pendingList.length === 0 ? (
          <EmptyState
            variant="bare"
            icon={Icon.Users}
            title="Tidak ada pendaftaran baru"
            desc="Bagikan tautan rekrut di atas — pendaftaran reseller yang menunggu persetujuan akan muncul di sini."
          />
        ) : (
          <div className="mt-3 space-y-3">
            {pendingList.map((r) => (
              <form key={r.id} action={(fd) => approve(r.id, fd)} className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/40 dark:bg-amber-950/30">
                <div className="font-medium text-foreground">{r.name}</div>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  <label className="text-xs text-foreground">Tipe komisi
                    <select name="commissionType" defaultValue="FLAT_IDR" className={selectCls}>
                      <option value="FLAT_IDR">Rupiah / pembayaran</option>
                      <option value="PERCENT">Persen</option>
                    </select>
                  </label>
                  <label className="text-xs text-foreground">Nilai
                    <Input name="commissionValue" type="number" min="0" step="0.01" required className="mt-1 min-h-[40px]" placeholder="mis. 25000" />
                  </label>
                  <div className="flex items-end gap-2">
                    <Button type="submit" disabled={pending} className="min-h-[40px] flex-1 bg-sky-500 text-white hover:bg-sky-600">
                      {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                      Setujui
                    </Button>
                    <Button type="button" variant="outline" onClick={() => reject(r.id)} className="min-h-[40px]">Tolak</Button>
                  </div>
                </div>
              </form>
            ))}
          </div>
        )}
      </section>

      {/* Reseller aktif + export */}
      <section className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground">Reseller Aktif ({activeList.length})</h2>
          {activeList.length > 0 && (
            <a href="/api/agen/reseller-export" className={buttonVariants({ variant: "outline", size: "sm", className: "gap-1.5" })}>
              <Icon.Package className="h-3.5 w-3.5" aria-hidden /> Export CSV Transfer
            </a>
          )}
        </div>
        {activeList.length === 0 ? (
          <EmptyState
            variant="bare"
            icon={Icon.Technician}
            title="Belum ada reseller aktif"
            desc="Setujui pendaftaran reseller untuk menambah jaringan penjualan Anda."
          />
        ) : (
          <div className="mt-3 divide-y divide-border">
            {activeList.map((r) => (
              <div key={r.id} className="flex items-center justify-between py-2.5 text-sm">
                <div>
                  <div className="font-medium text-foreground">{r.name}</div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    Komisi {r.commissionType === "PERCENT" ? `${r.commissionValue}%` : "Rp " + r.commissionValue.toLocaleString("id-ID")}
                    {r.bankMasked ? <> · rekening <Icon.Check className="h-3 w-3" aria-hidden /></> : " · rekening —"}
                  </div>
                </div>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">Aktif</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
