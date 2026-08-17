import Link from "next/link";
import { getPlatformStats } from "@/lib/services/platform-service";
import { formatIDR } from "@/lib/billing/plans";
import { PaymentStatusBadge } from "./status-badge";

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
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-1 text-3xl font-semibold text-slate-900">{value}</div>
      {hint ? <div className="mt-1 text-xs text-slate-400">{hint}</div> : null}
    </div>
  );
}

export default async function AdminDashboardPage() {
  const stats = await getPlatformStats();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Ringkasan</h1>
        <p className="text-sm text-slate-500">Kondisi seluruh usaha & langganan.</p>
      </header>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <StatCard label="Total Usaha" value={stats.total} />
        <StatCard label="Aktif" value={stats.active} />
        <StatCard label="Masa Coba" value={stats.trial} />
        <StatCard label="Menunggak" value={stats.pastDue} />
        <StatCard label="Ditangguhkan" value={stats.suspended} />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-lg font-medium">Pembayaran Terbaru</h2>
          <Link href="/admin/tenants" className="text-sm font-medium text-sky-600 hover:underline">
            Lihat semua usaha →
          </Link>
        </div>
        {stats.recentPayments.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-400">Belum ada pembayaran.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3 font-medium">Usaha</th>
                <th className="px-5 py-3 font-medium">Order ID</th>
                <th className="px-5 py-3 font-medium">Paket</th>
                <th className="px-5 py-3 font-medium text-right">Jumlah</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Tanggal</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentPayments.map((p) => (
                <tr key={p.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-5 py-3">
                    <Link
                      href={`/admin/tenants/${p.tenant.id}`}
                      className="font-medium text-slate-800 hover:text-sky-600"
                    >
                      {p.tenant.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-slate-500">{p.orderId}</td>
                  <td className="px-5 py-3 text-slate-600">{p.plan}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{formatIDR(p.amount)}</td>
                  <td className="px-5 py-3">
                    <PaymentStatusBadge status={p.status} />
                  </td>
                  <td className="px-5 py-3 text-slate-500">{fmtDate(p.paidAt ?? p.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
