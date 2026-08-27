import { redirect } from "next/navigation";
import { tryGetServerContext } from "@/lib/auth/context";
import { prisma } from "@/lib/prisma";
import { AppHeader } from "../_components/app-header";
import { CustomerManager } from "./customer-manager";

export const dynamic = "force-dynamic";

export default async function PelangganPage() {
  const ctx = await tryGetServerContext();
  if (!ctx) redirect("/login?next=/app/pelanggan");

  const customers = await prisma.customer.findMany({
    where: { tenantId: ctx.tenantId, deletedAt: null },
    include: { _count: { select: { assets: true, jobs: true } } },
    orderBy: { updatedAt: "desc" },
    take: 300,
  });

  const rows = customers.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    address: c.address,
    source: c.source,
    notes: c.notes,
    assetCount: c._count.assets,
    jobCount: c._count.jobs,
  }));

  return (
    <main className="min-h-screen bg-muted/40">
      <AppHeader title="Pelanggan" />
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        <CustomerManager customers={rows} />
      </div>
    </main>
  );
}
