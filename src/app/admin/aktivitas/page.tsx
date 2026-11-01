import Link from "next/link";
import {
  ACTIVITY_PERIOD_OPTIONS,
  getTenantActivityReport,
  type ActivityPeriod,
  type TenantActivityRow,
} from "@/lib/services/platform-activity-service";
import { activityLabel, type ActivityLevel } from "@/lib/services/platform-activity";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { Icon } from "@/components/icons";
import { TenantStatusBadge } from "../status-badge";

export const dynamic = "force-dynamic";

const VALID_PERIODS: readonly string[] = ["7d", "30d", "90d"];

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fmtDateTime(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Badge tingkat aktivitas — memakai Badge yang sudah ada (seragam). */
function ActivityBadge({ level }: { level: ActivityLevel }) {
  if (level === "JOBS") {
    return <Badge className="bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300">{activityLabel(level)}</Badge>;
  }
  if (level === "OTHER") {
    return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">{activityLabel(level)}</Badge>;
  }
  return <Badge variant="secondary">{activityLabel(level)}</Badge>;
}

function StatCard({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-3 sm:p-5">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-semibold text-foreground sm:text-3xl">{value}</div>
        {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
      </CardContent>
    </Card>
  );
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const sp = await searchParams;
  const period: ActivityPeriod =
    sp.period && VALID_PERIODS.includes(sp.period) ? (sp.period as ActivityPeriod) : "30d";

  const report = await getTenantActivityReport(period);

  // Urutan: yang paling aktif dulu, lalu Dormant di akhir.
  const sorted = [...report.rows].sort((a, b) => {
    if (b.jobs !== a.jobs) return b.jobs - a.jobs;
    const la = a.lastActivityAt ? a.lastActivityAt.getTime() : 0;
    const lb = b.lastActivityAt ? b.lastActivityAt.getTime() : 0;
    return lb - la;
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Aktivitas Usaha</h1>
        <p className="text-sm text-muted-foreground">
          Ringkasan kegiatan bisnis tiap usaha: pekerjaan, pelanggan, unit AC, dan invoice.
        </p>
      </header>

      <form method="get" className="flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <select
          name="period"
          defaultValue={period}
          aria-label="Periode laporan"
          className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        >
          {ACTIVITY_PERIOD_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground">
          Periode: {fmtDate(report.since)} — {fmtDate(report.until)}
        </span>
      </form>

      <section className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <StatCard label="Usaha Dipantau" value={report.totals.tenants} />
        <StatCard label="Usaha dengan Pekerjaan" value={report.totals.tenantsWithJobs} hint="Ada pekerjaan dibuat pada periode" />
        <StatCard label="Total Pekerjaan" value={report.totals.jobs} hint={`${report.totals.jobsCompleted} selesai pada periode`} />
        <StatCard label="Invoice Terbit" value={report.totals.invoices} hint={`${report.totals.customers} pelanggan baru`} />
      </section>

      <Card className="p-0">
        {sorted.length === 0 ? (
          <EmptyState
            variant="bare"
            icon={Icon.Chart}
            title="Belum ada usaha"
            desc="Belum ada tenant terdaftar untuk dipantau aktivitasnya."
          />
        ) : (
          <>
            {/* Mobile: kartu */}
            <div className="space-y-3 p-3 sm:hidden">
              {sorted.map((r) => (
                <TenantActivityCard key={r.tenantId} row={r} />
              ))}
            </div>

            {/* Desktop: tabel */}
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full min-w-[980px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-5 py-3 font-medium">Usaha</th>
                    <th className="px-5 py-3 font-medium">Aktivitas</th>
                    <th className="px-5 py-3 font-medium text-right">Pekerjaan</th>
                    <th className="px-5 py-3 font-medium text-right">Selesai</th>
                    <th className="px-5 py-3 font-medium text-right">Pelanggan Baru</th>
                    <th className="px-5 py-3 font-medium text-right">Unit AC</th>
                    <th className="px-5 py-3 font-medium text-right">Invoice</th>
                    <th className="px-5 py-3 font-medium text-right">Berjalan</th>
                    <th className="px-5 py-3 font-medium">Terakhir Aktif</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((r) => (
                    <tr key={r.tenantId} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="max-w-[220px] px-5 py-3">
                        <Link
                          href={`/admin/tenants/${r.tenantId}`}
                          className="block break-words font-medium text-foreground hover:text-sky-600"
                        >
                          {r.tenantName}
                        </Link>
                        <span className="mt-0.5 block">
                          <TenantStatusBadge status={r.status} />
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <ActivityBadge level={r.level} />
                        <span className="mt-1 block break-words text-xs text-muted-foreground">{r.summary}</span>
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-foreground">{r.jobs}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">{r.jobsCompleted}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">{r.customers}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">{r.assets}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">{r.invoices}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">{r.jobsOpen}</td>
                      <td className="px-5 py-3 text-muted-foreground">{fmtDateTime(r.lastActivityAt)}</td>
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

function TenantActivityCard({ row }: { row: TenantActivityRow }) {
  return (
    <article className="min-w-0 rounded-xl border bg-card p-3">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <Link
          href={`/admin/tenants/${row.tenantId}`}
          className="min-w-0 break-words font-medium text-foreground hover:text-sky-600"
        >
          {row.tenantName}
        </Link>
        <ActivityBadge level={row.level} />
      </div>
      <p className="mt-1 break-words text-xs text-muted-foreground">{row.summary}</p>
      <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Pekerjaan</dt>
        <dd className="min-w-0 break-words text-right tabular-nums text-foreground">
          {row.jobs} ({row.jobsCompleted} selesai)
        </dd>
        <dt className="text-muted-foreground">Pelanggan Baru</dt>
        <dd className="min-w-0 break-words text-right tabular-nums text-foreground">{row.customers}</dd>
        <dt className="text-muted-foreground">Unit AC</dt>
        <dd className="min-w-0 break-words text-right tabular-nums text-foreground">{row.assets}</dd>
        <dt className="text-muted-foreground">Invoice</dt>
        <dd className="min-w-0 break-words text-right tabular-nums text-foreground">{row.invoices}</dd>
        <dt className="text-muted-foreground">Pekerjaan Berjalan</dt>
        <dd className="min-w-0 break-words text-right tabular-nums text-foreground">{row.jobsOpen}</dd>
        <dt className="text-muted-foreground">Terakhir Aktif</dt>
        <dd className="min-w-0 break-words text-right text-muted-foreground">{fmtDateTime(row.lastActivityAt)}</dd>
        <dt className="text-muted-foreground">Status</dt>
        <dd className="min-w-0 text-right">
          <TenantStatusBadge status={row.status} />
        </dd>
      </dl>
    </article>
  );
}
