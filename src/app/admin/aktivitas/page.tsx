import Link from "next/link";
import {
  ACTIVITY_LEVEL_OPTIONS,
  ACTIVITY_PERIOD_OPTIONS,
  getTenantActivityReport,
  type ActivityPeriod,
  type TenantActivityRow,
} from "@/lib/services/platform-activity-service";
import { activityLabel, type ActivityLevel } from "@/lib/services/platform-activity";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { EmptyState } from "@/components/empty-state";
import { Icon } from "@/components/icons";
import { TenantStatusBadge } from "../status-badge";

export const dynamic = "force-dynamic";

const VALID_PERIODS: readonly string[] = ["7d", "30d", "90d"];
const VALID_LEVELS: readonly string[] = ["JOBS", "OTHER", "NONE"];

/** Label tanggal dalam zona WIB — DB menyimpan timestamp UTC. */
function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
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
    timeZone: "Asia/Jakarta",
  });
}

/** Badge tingkat aktivitas — memakai Badge yang sudah ada (seragam). */
function ActivityBadge({ level }: { level: ActivityLevel }) {
  if (level === "JOBS") {
    return (
      <Badge className="bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300">
        {activityLabel(level)}
      </Badge>
    );
  }
  if (level === "OTHER") {
    return (
      <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
        {activityLabel(level)}
      </Badge>
    );
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
  searchParams: Promise<{ period?: string; level?: string | string[]; q?: string }>;
}) {
  const sp = await searchParams;
  const period: ActivityPeriod =
    sp.period && VALID_PERIODS.includes(sp.period) ? (sp.period as ActivityPeriod) : "30d";

  // Filter status bisa lebih dari satu (checkbox) — query string bisa berulang.
  const rawLevels = sp.level === undefined ? [] : Array.isArray(sp.level) ? sp.level : [sp.level];
  const levels = rawLevels.filter((l): l is ActivityLevel => VALID_LEVELS.includes(l));
  const search = sp.q?.trim() || undefined;

  const report = await getTenantActivityReport(period, new Date(), { levels, search });

  // Urutan: paling banyak pekerjaan dulu, lalu yang paling baru aktif.
  const sorted = [...report.rows].sort((a, b) => {
    if (b.jobs !== a.jobs) return b.jobs - a.jobs;
    const la = a.lastActivityAt ? a.lastActivityAt.getTime() : 0;
    const lb = b.lastActivityAt ? b.lastActivityAt.getTime() : 0;
    return lb - la;
  });

  const filterActive = levels.length > 0 || Boolean(search);
  const periodLabel = ACTIVITY_PERIOD_OPTIONS.find((o) => o.value === period)?.label ?? period;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Aktivitas Usaha</h1>
        <p className="text-sm text-muted-foreground">
          Ringkasan kegiatan bisnis tiap usaha: pekerjaan, pelanggan, unit AC, dan invoice.
        </p>
      </header>

      <form
        method="get"
        className="flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-end"
      >
        <div className="min-w-0 flex-1 sm:max-w-xs">
          <label htmlFor="q" className="mb-1 block text-xs font-medium text-muted-foreground">
            Cari usaha
          </label>
          <Input
            id="q"
            type="search"
            name="q"
            defaultValue={search ?? ""}
            placeholder="Nama usaha…"
            className="h-11 w-full min-w-0 sm:h-9"
          />
        </div>

        <div className="min-w-0 sm:w-48">
          <label htmlFor="period" className="mb-1 block text-xs font-medium text-muted-foreground">
            Periode
          </label>
          <select
            id="period"
            name="period"
            defaultValue={period}
            className="h-11 w-full min-w-0 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 sm:h-9"
          >
            {ACTIVITY_PERIOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <fieldset className="min-w-0">
          <legend className="mb-1 text-xs font-medium text-muted-foreground">Status Aktivitas</legend>
          <div className="flex min-h-[44px] flex-wrap items-center gap-x-4 gap-y-2 sm:min-h-9">
            {ACTIVITY_LEVEL_OPTIONS.map((o) => (
              <label
                key={o.value}
                className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 text-sm sm:min-h-9"
              >
                <input
                  type="checkbox"
                  name="level"
                  value={o.value}
                  defaultChecked={levels.includes(o.value)}
                  className="h-4 w-4 rounded border-input accent-sky-500"
                />
                {o.label}
              </label>
            ))}
          </div>
        </fieldset>

        {/* `min-h-[44px]` — pola yang dipakai proyek ini untuk target sentuh 44px
            (class `min-h-11` dipangkas Tailwind v4; `h-11` bentrok dengan height
            bawaan Button karena tailwind-merge memprioritaskan `h-*`). */}
        <SubmitButton
          className="min-h-[44px] w-full shrink-0 bg-sky-500 px-4 text-white hover:bg-sky-600 sm:min-h-9 sm:w-auto"
          pendingLabel="Menerapkan…"
        >
          Terapkan
        </SubmitButton>

        {filterActive && (
          <Link
            href="/admin/aktivitas"
            className="inline-flex min-h-[44px] shrink-0 items-center text-sm font-medium text-sky-600 hover:underline sm:min-h-9"
          >
            Reset filter
          </Link>
        )}
      </form>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span>
          Periode {periodLabel}: {fmtDate(report.since)} — {fmtDate(report.until)} (WIB)
        </span>
        {filterActive && (
          <span>
            · Menampilkan {sorted.length} dari {report.totals.tenants} usaha
            {levels.length > 0 && (
              <>
                {" "}
                · Status: {levels.map((l) => activityLabel(l)).join(", ")}
              </>
            )}
            {search && <> · Pencarian: “{search}”</>}
          </span>
        )}
      </div>

      <section className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <StatCard
          label="Usaha Dipantau"
          value={report.totals.tenants}
          hint={filterActive ? "Seluruh usaha, bukan hasil filter" : undefined}
        />
        <StatCard
          label="Usaha dengan Pekerjaan"
          value={report.totals.tenantsWithJobs}
          hint="Ada pekerjaan dibuat pada periode"
        />
        <StatCard
          label="Total Pekerjaan"
          value={report.totals.jobs}
          hint={`${report.totals.jobsCompleted} selesai pada periode`}
        />
        <StatCard
          label="Invoice Terbit"
          value={report.totals.invoices}
          hint={`${report.totals.customers} pelanggan baru`}
        />
      </section>

      <Card className="p-0">
        {sorted.length === 0 ? (
          <EmptyState
            variant="bare"
            icon={Icon.Chart}
            title={filterActive ? "Tidak ada usaha yang cocok" : "Belum ada usaha"}
            desc={
              filterActive
                ? "Coba ubah kata kunci pencarian atau status aktivitas, lalu tekan Terapkan."
                : "Belum ada tenant terdaftar untuk dipantau aktivitasnya."
            }
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
                    <th className="px-5 py-3 font-medium">Status Aktivitas</th>
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
                        <span className="mt-1 block break-words text-xs text-muted-foreground">
                          {r.summary}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-foreground">{r.jobs}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">
                        {r.jobsCompleted}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">
                        {r.customers}
                      </td>
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
        <dd className="min-w-0 break-words text-right text-muted-foreground">
          {fmtDateTime(row.lastActivityAt)}
        </dd>
        <dt className="text-muted-foreground">Status</dt>
        <dd className="min-w-0 text-right">
          <TenantStatusBadge status={row.status} />
        </dd>
      </dl>
    </article>
  );
}
