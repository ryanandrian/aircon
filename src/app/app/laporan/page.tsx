import { redirect } from "next/navigation";
import { tryGetServerContext } from "@/lib/auth/context";
import {
  getAccountsReceivable, getOverdueInvoices, getReceipts,
  getUnremittedCashByTech, refreshOverdueStatus,
} from "@/lib/services/ar-service";
import { computeIncentives } from "@/lib/services/incentive-service";
import { AppHeader } from "../_components/app-header";
import { Card, CardContent } from "@/components/ui/card";
import { RemitButton } from "./remit-button";

export const dynamic = "force-dynamic";

const rp = (n: number) => "Rp" + n.toLocaleString("id-ID");
const fmt = (d: Date | null) => d ? new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default async function LaporanPage() {
  const ctx = await tryGetServerContext();
  if (!ctx) redirect("/login?next=/app/laporan");
  if (ctx.role !== "OWNER" && ctx.role !== "ADMIN") redirect("/app");

  const now = new Date();
  await refreshOverdueStatus(ctx.tenantId, now); // sinkron status OVERDUE saat buka laporan
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const [ar, overdue, receipts, unremitted] = await Promise.all([
    getAccountsReceivable(ctx.tenantId, now),
    getOverdueInvoices(ctx.tenantId, now),
    getReceipts(ctx.tenantId, monthStart, monthEnd),
    getUnremittedCashByTech(ctx.tenantId),
  ]);
  const incentives = await computeIncentives(ctx.tenantId, monthStart, monthEnd);
  const totalIncentive = incentives.reduce((s, i) => s + i.amount, 0);
  const totalUnremitted = unremitted.reduce((s, u) => s + u.total, 0);

  return (
    <main className="min-h-screen">
      <AppHeader title="Laporan Keuangan" />
      <div className="mx-auto max-w-4xl space-y-5 px-5 py-6">

        {/* Ringkasan angka */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Total Piutang" value={rp(ar.total)} tone="sky" />
          <Stat label="Penerimaan Bulan Ini" value={rp(receipts.total)} sub={`${receipts.count} invoice`} tone="emerald" />
          <Stat label="Kas Belum Disetor" value={rp(totalUnremitted)} tone="amber" />
        </div>

        {/* Aging piutang */}
        <Card>
          <CardContent className="p-5">
            <h2 className="mb-3 text-sm font-bold text-foreground">Umur Piutang (Aging)</h2>
            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
              <Aging label="Belum jatuh tempo" value={rp(ar.current)} />
              <Aging label="1–30 hari" value={rp(ar.d1_30)} />
              <Aging label="31–60 hari" value={rp(ar.d31_60)} />
              <Aging label="61–90 hari" value={rp(ar.d61_90)} />
              <Aging label="> 90 hari" value={rp(ar.d90plus)} warn />
            </div>
          </CardContent>
        </Card>

        {/* Invoice jatuh tempo */}
        <Card>
          <CardContent className="p-5">
            <h2 className="mb-3 text-sm font-bold text-foreground">Invoice Jatuh Tempo ({overdue.length})</h2>
            {overdue.length === 0 ? (
              <p className="text-sm text-muted-foreground">Tidak ada invoice jatuh tempo. 👍</p>
            ) : (
              <div className="space-y-2">
                {overdue.map((o) => (
                  <a key={o.id} href={`/app/faktur/${o.id}`} className="flex items-center justify-between gap-3 rounded-xl border p-3 hover:border-red-300">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">{o.customerName}</div>
                      <div className="font-mono text-xs text-muted-foreground">{o.number} · jatuh tempo {fmt(o.dueDate)} · telat {o.daysLate} hari</div>
                    </div>
                    <div className="shrink-0 font-bold text-red-600">{rp(o.total)}</div>
                  </a>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Setoran kas teknisi (K17) */}
        <Card>
          <CardContent className="p-5">
            <h2 className="mb-1 text-sm font-bold text-foreground">Kas Belum Disetor per Teknisi</h2>
            <p className="mb-3 text-xs text-muted-foreground">Uang tunai yang dipegang teknisi dari invoice lunas, belum disetor ke pemilik.</p>
            {unremitted.length === 0 ? (
              <p className="text-sm text-muted-foreground">Semua kas sudah disetor. 👍</p>
            ) : (
              <div className="space-y-2">
                {unremitted.map((u) => (
                  <div key={u.techId} className="flex items-center justify-between gap-3 rounded-xl border p-3">
                    <div>
                      <div className="text-sm font-medium text-foreground">{u.techName}</div>
                      <div className="text-xs text-muted-foreground">{u.count} transaksi · {rp(u.total)}</div>
                    </div>
                    <RemitButton techName={u.techName} invoiceIds={u.invoiceIds} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Insentif personel bulan ini (K5/K6/K7) */}
        <Card>
          <CardContent className="p-5">
            <h2 className="mb-1 text-sm font-bold text-foreground">Insentif Personel Bulan Ini</h2>
            <p className="mb-3 text-xs text-muted-foreground">Total {rp(totalIncentive)} · acuan & mode diatur di Pengaturan.</p>
            {incentives.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada insentif periode ini.</p>
            ) : (
              <div className="space-y-2">
                {incentives.map((i) => (
                  <div key={i.personId} className="flex items-center justify-between gap-3 rounded-xl border p-3">
                    <div>
                      <div className="text-sm font-medium text-foreground">{i.personName}</div>
                      <div className="text-xs text-muted-foreground">{i.itemCount} pekerjaan</div>
                    </div>
                    <div className="font-bold text-sky-600">{rp(i.amount)}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </main>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: "sky" | "emerald" | "amber" }) {
  const toneCls = tone === "emerald" ? "text-emerald-600" : tone === "amber" ? "text-amber-600" : "text-sky-600";
  return (
    <Card><CardContent className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-bold ${toneCls}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </CardContent></Card>
  );
}

function Aging({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={`rounded-xl border p-2 ${warn ? "border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/30" : ""}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-sm font-semibold ${warn ? "text-red-600" : "text-foreground"}`}>{value}</div>
    </div>
  );
}
