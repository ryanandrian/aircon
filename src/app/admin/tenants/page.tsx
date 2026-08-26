import Link from "next/link";
import { listTenants } from "@/lib/services/platform-service";
import type { TenantStatus } from "@prisma/client";
import { TenantStatusBadge } from "../status-badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { EmptyState } from "@/components/empty-state";
import { Icon } from "@/components/icons";

export const dynamic = "force-dynamic";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Semua Status" },
  { value: "TRIAL", label: "Masa Coba" },
  { value: "ACTIVE", label: "Aktif" },
  { value: "PAST_DUE", label: "Menunggak" },
  { value: "SUSPENDED", label: "Ditangguhkan" },
  { value: "CANCELLED", label: "Berhenti" },
];

const VALID: readonly string[] = ["TRIAL", "ACTIVE", "PAST_DUE", "SUSPENDED", "CANCELLED"];

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
  searchParams: Promise<{ search?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const search = sp.search?.trim() || undefined;
  const status = sp.status && VALID.includes(sp.status) ? (sp.status as TenantStatus) : undefined;

  const { items } = await listTenants({ search, status, limit: 50 });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Daftar Usaha</h1>
        <p className="text-sm text-muted-foreground">Kelola langganan seluruh usaha pelanggan.</p>
      </header>

      <form method="get" className="flex flex-wrap items-center gap-3">
        <Input
          type="search"
          name="search"
          defaultValue={search ?? ""}
          placeholder="Cari nama, slug, atau telepon…"
          className="h-9 w-64"
        />
        <select
          name="status"
          defaultValue={sp.status ?? ""}
          className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <SubmitButton className="h-9 bg-sky-500 px-4 text-white hover:bg-sky-600" pendingLabel="Menerapkan…">
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
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3 font-medium">Nama Usaha</th>
                <th className="px-5 py-3 font-medium">Paket</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Masa Coba Berakhir</th>
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
                  <td className="px-5 py-3">
                    <TenantStatusBadge status={t.status} />
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{fmtDate(t.trialEndsAt)}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">{t.userCount}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">{t.jobCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
