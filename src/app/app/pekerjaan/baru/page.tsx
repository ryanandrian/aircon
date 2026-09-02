import { redirect } from "next/navigation";
import Link from "next/link";
import { tryGetServerContext } from "@/lib/auth/context";
import { prisma } from "@/lib/prisma";
import { JobForm } from "./job-form";
import { Card, CardContent } from "@/components/ui/card";

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
    <main className="min-h-screen bg-background pb-16">
      <header className="border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-3">
          <h1 className="text-lg font-bold text-foreground">Pekerjaan Baru</h1>
          <Link href="/app/pekerjaan" className="text-sm text-muted-foreground hover:text-foreground">
            ← Kembali
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-4xl space-y-6 px-5 py-6">
        {customers.length === 0 ? (
          <Card className="border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/30">
            <CardContent className="p-4 text-sm text-amber-800 dark:text-amber-300">
              Belum ada pelanggan. Tambahkan pelanggan dulu sebelum membuat pekerjaan.
            </CardContent>
          </Card>
        ) : (
          <JobForm customers={customers} assets={assetOptions} technicians={technicians} />
        )}
      </div>
    </main>
  );
}
