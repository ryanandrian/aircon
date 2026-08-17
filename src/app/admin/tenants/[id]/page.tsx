import Link from "next/link";
import { notFound } from "next/navigation";
import { getTenantDetail } from "@/lib/services/platform-service";
import { formatIDR } from "@/lib/billing/plans";
import { tenantHealth } from "@/lib/services/platform-format";
import { TenantStatusBadge, PaymentStatusBadge } from "../../status-badge";
import { StatusChanger } from "./status-changer";

export const dynamic = "force-dynamic";

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const HEALTH_STYLE: Record<string, string> = {
  sehat: "bg-emerald-100 text-emerald-800",
  perhatian: "bg-amber-100 text-amber-800",
  bermasalah: "bg-rose-100 text-rose-800",
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-0.5 text-sm font-medium text-slate-800">{value}</div>
    </div>
  );
}

export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tenant = await getTenantDetail(id);
  if (!tenant) notFound();

  const health = tenantHealth(tenant.status, tenant.trialEndsAt);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/tenants" className="text-sm text-sky-600 hover:underline">
          ← Kembali ke daftar usaha
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{tenant.name}</h1>
            <TenantStatusBadge status={tenant.status} />
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${HEALTH_STYLE[health]}`}
            >
              {health}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            /{tenant.slug} · {tenant.phone}
          </p>
        </div>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-medium">Langganan</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Field label="Paket" value={tenant.plan} />
          <Field label="Masa Coba Berakhir" value={fmtDate(tenant.trialEndsAt)} />
          <Field label="Periode Berakhir" value={fmtDate(tenant.currentPeriodEnd)} />
          <Field label="Bergabung" value={fmtDate(tenant.createdAt)} />
          <Field label="Jumlah User" value={String(tenant._count.users)} />
          <Field label="Jumlah Pelanggan" value={String(tenant._count.customers)} />
          <Field label="Jumlah Pekerjaan" value={String(tenant._count.jobs)} />
          {tenant.subscription ? (
            <Field
              label="Harga Bulanan"
              value={formatIDR(tenant.subscription.amountMonthly)}
            />
          ) : (
            <Field label="Harga Bulanan" value="—" />
          )}
        </div>

        <div className="mt-6 border-t border-slate-100 pt-5">
          <div className="mb-2 text-sm font-medium text-slate-700">Ubah Status Langganan</div>
          <StatusChanger tenantId={tenant.id} current={tenant.status} />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-lg font-medium">Riwayat Pembayaran</h2>
        </div>
        {tenant.payments.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-400">Belum ada pembayaran.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3 font-medium">Order ID</th>
                <th className="px-5 py-3 font-medium">Paket</th>
                <th className="px-5 py-3 font-medium text-right">Jumlah</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Dibayar</th>
                <th className="px-5 py-3 font-medium">Dibuat</th>
              </tr>
            </thead>
            <tbody>
              {tenant.payments.map((p) => (
                <tr key={p.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-5 py-3 font-mono text-xs text-slate-500">{p.orderId}</td>
                  <td className="px-5 py-3 text-slate-600">{p.plan}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{formatIDR(p.amount)}</td>
                  <td className="px-5 py-3">
                    <PaymentStatusBadge status={p.status} />
                  </td>
                  <td className="px-5 py-3 text-slate-500">{fmtDate(p.paidAt)}</td>
                  <td className="px-5 py-3 text-slate-500">{fmtDate(p.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
