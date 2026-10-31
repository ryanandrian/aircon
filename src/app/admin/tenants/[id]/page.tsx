import Link from "next/link";
import { notFound } from "next/navigation";
import { getTenantDetail } from "@/lib/services/platform-service";
import { formatIDR } from "@/lib/billing/plans";
import { tenantHealth } from "@/lib/services/platform-format";
import { TenantStatusBadge, PaymentStatusBadge } from "../../status-badge";
import { StatusChanger } from "./status-changer";
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

const HEALTH_STYLE: Record<string, string> = {
  sehat: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  perhatian: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  bermasalah: "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300",
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-medium text-foreground">{value}</div>
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

  const health = tenantHealth(tenant.status);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/tenants" className="text-sm text-sky-600 hover:underline">
          ← Kembali ke daftar usaha
        </Link>
      </div>

      <header className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
            <h1 className="min-w-0 break-words text-xl font-semibold text-foreground sm:text-2xl">{tenant.name}</h1>
            <TenantStatusBadge status={tenant.status} />
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${HEALTH_STYLE[health]}`}
            >
              {health}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            /{tenant.slug} · {tenant.phone}
          </p>
        </div>
      </header>

      <Card>
        <CardContent className="p-3 sm:p-5">
          <h2 className="mb-4 text-base font-medium text-foreground sm:text-lg">Langganan</h2>
          <div className="grid grid-cols-1 gap-4 min-[360px]:grid-cols-2 md:grid-cols-4">
            <Field label="Paket" value={tenant.plan} />
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

          <div className="mt-6 border-t pt-5">
            <div className="mb-2 text-sm font-medium text-foreground">Ubah Status Langganan</div>
            <StatusChanger tenantId={tenant.id} current={tenant.status} />
          </div>
        </CardContent>
      </Card>

      <Card className="p-0">
        <div className="border-b px-4 py-4 sm:px-5">
          <h2 className="text-base font-medium text-foreground sm:text-lg">Riwayat Pembayaran</h2>
        </div>
        {tenant.payments.length === 0 ? (
          <EmptyState
            variant="bare"
            icon={Icon.Billing}
            title="Belum ada pembayaran"
            desc="Riwayat transaksi langganan usaha ini akan muncul di sini setelah ada pembayaran."
          />
        ) : (
          <>
            <div className="space-y-3 p-3 sm:hidden">
              {tenant.payments.map((p) => (
                <article key={p.id} className="min-w-0 rounded-xl border bg-card p-3">
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <span className="min-w-0 break-all font-mono text-xs text-muted-foreground">{p.orderId}</span>
                    <PaymentStatusBadge status={p.status} />
                  </div>
                  <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
                    <dt className="text-muted-foreground">Paket</dt><dd className="min-w-0 break-words text-right">{p.plan}</dd>
                    <dt className="text-muted-foreground">Jumlah</dt><dd className="min-w-0 break-words text-right font-medium tabular-nums">{formatIDR(p.amount)}</dd>
                    <dt className="text-muted-foreground">Dibayar</dt><dd className="text-right text-muted-foreground">{fmtDate(p.paidAt)}</dd>
                    <dt className="text-muted-foreground">Dibuat</dt><dd className="text-right text-muted-foreground">{fmtDate(p.createdAt)}</dd>
                  </dl>
                </article>
              ))}
            </div>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full min-w-[680px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-5 py-3 font-medium">Order ID</th><th className="px-5 py-3 font-medium">Paket</th>
                    <th className="px-5 py-3 text-right font-medium">Jumlah</th><th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Dibayar</th><th className="px-5 py-3 font-medium">Dibuat</th>
                  </tr>
                </thead>
                <tbody>
                  {tenant.payments.map((p) => (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{p.orderId}</td>
                      <td className="px-5 py-3 text-muted-foreground">{p.plan}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-foreground">{formatIDR(p.amount)}</td>
                      <td className="px-5 py-3"><PaymentStatusBadge status={p.status} /></td>
                      <td className="px-5 py-3 text-muted-foreground">{fmtDate(p.paidAt)}</td>
                      <td className="px-5 py-3 text-muted-foreground">{fmtDate(p.createdAt)}</td>
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
