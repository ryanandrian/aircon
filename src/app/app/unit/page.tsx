import { redirect } from "next/navigation";
import { tryGetServerContext } from "@/lib/auth/context";
import { prisma } from "@/lib/prisma";
import { AppHeader } from "../_components/app-header";
import { UnitManager } from "./unit-manager";

export const dynamic = "force-dynamic";

export default async function UnitPage() {
  const ctx = await tryGetServerContext();
  if (!ctx) redirect("/login?next=/app/unit");

  // Unit AC per tenant + nama pelanggan + jumlah job (riwayat).
  const assets = await prisma.asset.findMany({
    where: { tenantId: ctx.tenantId, deletedAt: null },
    include: {
      customer: { select: { name: true } },
      _count: { select: { jobs: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  const rows = assets.map((a) => ({
    id: a.id,
    brand: a.brand,
    model: a.model,
    type: a.type,
    capacityPk: a.capacityPk,
    roomLocation: a.roomLocation,
    quantity: a.quantity,
    customerName: a.customer?.name ?? "—",
    jobCount: a._count.jobs,
    nextServiceDate: a.nextServiceDate ? a.nextServiceDate.toISOString() : null,
  }));

  return (
    <main className="min-h-screen bg-muted/40">
      <AppHeader title="Unit AC Pelanggan" />
      <div className="mx-auto max-w-4xl space-y-6 p-6">
        <UnitManager units={rows} />
      </div>
    </main>
  );
}
