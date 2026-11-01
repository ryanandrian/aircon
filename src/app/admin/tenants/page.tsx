import Link from "next/link";
import { listTenants } from "@/lib/services/platform-service";
import type { TenantStatus } from "@prisma/client";
import { TenantStatusBadge } from "../status-badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { EmptyState } from "@/components/empty-state";
import { Icon } from "@/components/icons";
import type { AttributionKind } from "@/lib/partner/attribution";
import { AttributionBadgeShort, AttributionPartner } from "../attribution-badge";

export const dynamic = "force-dynamic";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Semua Status" },
  { value: "TRIAL", label: "Basic (Gratis)" },
  { value: "ACTIVE", label: "Aktif" },
  { value: "PAST_DUE", label: "Menunggak" },
  { value: "SUSPENDED", label: "Ditangguhkan" },
  { value: "CANCELLED", label: "Berhenti" },
];

const VALID: readonly string[] = ["TRIAL", "ACTIVE", "PAST_DUE", "SUSPENDED", "CANCELLED"];

const SOURCE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Semua Sumber" },
  { value: "NONE", label: "Tanpa Bawaan" },
  { value: "AGENT", label: "Bawaan Agen" },
  { value: "RESELLER", label: "Bawaan Reseller" },
];

const VALID_SOURCES: readonly string[] = ["NONE", "AGENT", "RESELLER"];

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function TenantsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string; source?: string }>;
}) {
  const sp = await searchParams;
  const search = sp.search?.trim() || undefined;
  const status = sp.status && VALID.includes(sp.status) ? (sp.status as TenantStatus) : undefined;
  const source = sp.source && VALID_SOURCES.includes(sp.source) ? (sp.source as AttributionKind) : undefined;

  const { items } = await listTenants({ search, status, source, limit: 50 });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Daftar Usaha</h1>
        <p className="text-sm text-muted-foreground">Kelola langganan seluruh usaha pelanggan.</p>
      </header>

      <form method="get" className="flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Input
          type="search"
          name="search"
          defaultValue={search ?? ""}
          placeholder="Cari nama, slug, atau telepon…"
          className="h-11 w-full min-w-0 sm:h-9 sm:w-64"
        />
        <select
          name="status"
          defaultValue={sp.status ?? ""}
          aria-label="Filter status"
          className="h-11 w-full min-w-0 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 sm:h-9 sm:w-auto"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          name="source"
          defaultValue={sp.source ?? ""}
          aria-label="Filter sumber"
          className="h-11 w-full min-w-0 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 sm:h-9 sm:w-auto"
        >
          {SOURCE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <SubmitButton className="h-11 w-full shrink-0 bg-sky-500 px-4 text-white hover:bg-sky-600 sm:h-9 sm:w-auto" pendingLabel="Menerapkan…">
          Terapkan
        </SubmitButton>
      </form>

      <Card className="p-0">
        {items.length === 0 ? (
          <EmptyState
            variant="bare"
            icon={Icon.Business}
            title="Tidak ada usaha yang cocok"
            desc="Coba ubah kata kunci pencarian atau filter status untuk menemukan usaha yang Anda cari."
          />
        ) : (
          <>
            <div className="space-y-3 p-3 sm:hidden">
              {items.map((t) => (
                <article key={t.id} className="min-w-0 rounded-xl border bg-card p-3">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <Link href={`/admin/tenants/${t.id}`} className="min-w-0 break-words font-medium text-foreground hover:text-sky-600">
                      {t.name}
                    </Link>
                    <TenantStatusBadge status={t.status} />
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">/{t.slug}</div>
                  <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
                    <dt className="text-muted-foreground">Paket</dt>
                    <dd className="min-w-0 break-words text-right text-muted-foreground">{t.plan}</dd>
                    <dt className="text-muted-foreground">Agen / Reseller</dt>
                    <dd className="min-w-0 text-right">
                      <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
                        <AttributionBadgeShort attribution={t.attribution} />
                        <AttributionPartner attribution={t.attribution} />
                      </div>
                    </dd>
                    <dt className="text-muted-foreground">Periode Berakhir</dt>
                    <dd className="min-w-0 break-words text-right text-muted-foreground">{fmtDate(t.currentPeriodEnd ?? t.trialEndsAt)}</dd>
                    <dt className="text-muted-foreground">User / Pekerjaan</dt>
                    <dd className="min-w-0 break-words text-right tabular-nums text-muted-foreground">
                      {t.userCount} / {t.jobCount}
                    </dd>
                  </dl>
                </article>
              ))}
            </div>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-5 py-3 font-medium">Nama Usaha</th>
                    <th className="px-5 py-3 font-medium">Paket</th>
                    <th className="px-5 py-3 font-medium">Agen / Reseller</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Periode Berakhir</th>
                    <th className="px-5 py-3 font-medium text-right">User</th>
                    <th className="px-5 py-3 font-medium text-right">Pekerjaan</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((t) => (
                    <tr key={t.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="px-5 py-3">
                        <Link href={`/admin/tenants/${t.id}`} className="block">
                          <span className="font-medium text-foreground">{t.name}</span>
                          <span className="block text-xs text-muted-foreground">/{t.slug}</span>
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{t.plan}</td>
                      <td className="max-w-[260px] px-5 py-3">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <AttributionBadgeShort attribution={t.attribution} />
                          <AttributionPartner attribution={t.attribution} />
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <TenantStatusBadge status={t.status} />
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{fmtDate(t.currentPeriodEnd ?? t.trialEndsAt)}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">{t.userCount}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">{t.jobCount}</td>
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
