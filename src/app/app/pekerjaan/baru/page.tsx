import { redirect } from "next/navigation";
import Link from "next/link";
import { tryGetServerContext } from "@/lib/auth/context";
import { prisma } from "@/lib/prisma";
import { JobForm } from "./job-form";

export const dynamic = "force-dynamic";

export default async function PekerjaanBaruPage() {
  const ctx = await tryGetServerContext();
  if (!ctx) redirect("/login?next=/app/pekerjaan/baru");
  if (ctx.role !== "OWNER" && ctx.role !== "ADMIN") redirect("/app");

  // SECURITY: semua query tenant-scoped dari ctx.tenantId (sesi).
  const [customers, assets, technicianRows] = await Promise.all([
    prisma.customer.findMany({
      where: { tenantId: ctx.tenantId, deletedAt: null },
      select: { id: true, name: true, address: true },
      orderBy: { name: "asc" },
    }),
    prisma.asset.findMany({
      where: { tenantId: ctx.tenantId, deletedAt: null },
      select: { id: true, customerId: true, brand: true, model: true, roomLocation: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.technician.findMany({
      where: { tenantId: ctx.tenantId, active: true },
      select: { id: true, user: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const assetOptions = assets.map((a) => ({
    id: a.id,
    customerId: a.customerId,
    label:
      [a.brand, a.model].filter(Boolean).join(" ").trim() ||
      a.roomLocation ||
      "Unit AC",
  }));
  const technicians = technicianRows.map((t) => ({ id: t.id, name: t.user.name }));

  return (
    <main className="min-h-screen bg-slate-50 pb-16">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4 sm:px-6">
          <h1 className="text-lg font-bold text-slate-900">Pekerjaan Baru</h1>
          <Link href="/app/pekerjaan" className="text-sm text-slate-500 hover:text-slate-800">
            ← Kembali
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-2xl space-y-6 px-4 py-6 sm:px-6">
        {customers.length === 0 ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Belum ada pelanggan. Tambahkan pelanggan dulu sebelum membuat pekerjaan.
          </div>
        ) : (
          <JobForm customers={customers} assets={assetOptions} technicians={technicians} />
        )}
      </div>
    </main>
  );
}
