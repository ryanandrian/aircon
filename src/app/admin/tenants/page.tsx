import Link from "next/link";
import { listTenants } from "@/lib/services/platform-service";
import type { TenantStatus } from "@prisma/client";
import { TenantStatusBadge } from "../status-badge";

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
        <h1 className="text-2xl font-semibold">Daftar Usaha</h1>
        <p className="text-sm text-slate-500">Kelola langganan seluruh usaha pelanggan.</p>
      </header>

      <form method="get" className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          name="search"
          defaultValue={search ?? ""}
          placeholder="Cari nama, slug, atau telepon…"
          className="w-64 rounded-2xl border border-slate-200 px-4 py-2 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
        />
        <select
          name="status"
          defaultValue={sp.status ?? ""}
          className="rounded-2xl border border-slate-200 px-4 py-2 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-2xl bg-sky-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-600"
        >
          Terapkan
        </button>
      </form>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {items.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-400">
            Tidak ada usaha yang cocok.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
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
                <tr key={t.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <Link href={`/admin/tenants/${t.id}`} className="block">
                      <span className="font-medium text-slate-800">{t.name}</span>
                      <span className="block text-xs text-slate-400">/{t.slug}</span>
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{t.plan}</td>
                  <td className="px-5 py-3">
                    <TenantStatusBadge status={t.status} />
                  </td>
                  <td className="px-5 py-3 text-slate-500">{fmtDate(t.trialEndsAt)}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-slate-600">{t.userCount}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-slate-600">{t.jobCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
