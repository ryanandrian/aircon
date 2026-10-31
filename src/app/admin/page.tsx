import Link from "next/link";
import { getPlatformStats } from "@/lib/services/platform-service";
import { getVisitorStats } from "@/lib/services/visit-service";
import { formatIDR } from "@/lib/billing/plans";
import { PaymentStatusBadge } from "./status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { Icon } from "@/components/icons";

export const dynamic = "force-dynamic";

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function StatCard({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="mt-1 text-3xl font-semibold text-foreground">{value}</div>
        {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
      </CardContent>
    </Card>
  );
}

export default async function AdminDashboardPage() {
  const [stats, visitors] = await Promise.all([getPlatformStats(), getVisitorStats()]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Ringkasan</h1>
        <p className="text-sm text-muted-foreground">Kondisi seluruh usaha & langganan.</p>
      </header>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <StatCard label="Total Usaha" value={stats.total} />
        <StatCard label="Aktif" value={stats.active} />
        <StatCard label="Paket Basic (Gratis)" value={stats.trial} />
        <StatCard label="Menunggak" value={stats.pastDue} />
        <StatCard label="Ditangguhkan" value={stats.suspended} />
      </section>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <StatCard
          label="Pengunjung Unik (Total)"
          value={visitors.uniqueAllTime}
          hint="Landing airconet.id — IP sama tak dihitung 2×"
        />
        <StatCard label="Pengunjung Unik (Hari ini)" value={visitors.uniqueToday} hint="Zona WIB (+07)" />
      </section>

      <Card className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-4 sm:px-5">
          <h2 className="text-base font-medium text-foreground sm:text-lg">Pembayaran Terbaru</h2>
          <Link href="/admin/tenants" className="shrink-0 text-sm font-medium text-sky-600 hover:underline">
            Lihat semua usaha →
          </Link>
        </div>
        {stats.recentPayments.length === 0 ? (
          <EmptyState
            variant="bare"
            icon={Icon.Billing}
            title="Belum ada pembayaran"
            desc="Transaksi langganan dari seluruh usaha akan muncul di sini begitu ada pembayaran masuk."
          />
        ) : (
          <>
            <div className="space-y-3 p-3 sm:hidden">
              {stats.recentPayments.map((p) => (
                <article key={p.id} className="min-w-0 rounded-xl border bg-card p-3">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <Link href={`/admin/tenants/${p.tenant.id}`} className="min-w-0 break-words font-medium text-foreground hover:text-sky-600">
                      {p.tenant.name}
                    </Link>
                    <PaymentStatusBadge status={p.status} />
                  </div>
                  <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
                    <dt className="text-muted-foreground">Order</dt>
                    <dd className="min-w-0 break-all text-right font-mono text-xs text-muted-foreground">{p.orderId}</dd>
                    <dt className="text-muted-foreground">Paket</dt>
                    <dd className="min-w-0 break-words text-right text-muted-foreground">{p.plan}</dd>
                    <dt className="text-muted-foreground">Jumlah</dt>
                    <dd className="min-w-0 break-words text-right font-medium tabular-nums text-foreground">{formatIDR(p.amount)}</dd>
                    <dt className="text-muted-foreground">Tanggal</dt>
                    <dd className="text-right text-muted-foreground">{fmtDate(p.paidAt ?? p.createdAt)}</dd>
                  </dl>
                </article>
              ))}
            </div>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full min-w-[680px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-5 py-3 font-medium">Usaha</th>
                    <th className="px-5 py-3 font-medium">Order ID</th>
                    <th className="px-5 py-3 font-medium">Paket</th>
                    <th className="px-5 py-3 text-right font-medium">Jumlah</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Tanggal</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentPayments.map((p) => (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="px-5 py-3">
                        <Link href={`/admin/tenants/${p.tenant.id}`} className="font-medium text-foreground hover:text-sky-600">
                          {p.tenant.name}
                        </Link>
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{p.orderId}</td>
                      <td className="px-5 py-3 text-muted-foreground">{p.plan}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-foreground">{formatIDR(p.amount)}</td>
                      <td className="px-5 py-3"><PaymentStatusBadge status={p.status} /></td>
                      <td className="px-5 py-3 text-muted-foreground">{fmtDate(p.paidAt ?? p.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
