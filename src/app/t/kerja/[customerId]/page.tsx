import { redirect, notFound } from "next/navigation";
import { tryGetServerContext } from "@/lib/auth/context";
import { prisma } from "@/lib/prisma";
import { openWorkSession, getWorkSession } from "@/lib/services/worksession-service";
import { listCatalog } from "@/lib/services/service-catalog-service";
import { WorkSessionScreen } from "./work-session";

export const dynamic = "force-dynamic";

export default async function KerjaPage({ params, searchParams }: {
  params: Promise<{ customerId: string }>;
  searchParams: Promise<{ job?: string }>;
}) {
  const { customerId } = await params;
  const { job } = await searchParams;
  const ctx = await tryGetServerContext();
  if (!ctx) redirect(`/login?next=/t/kerja/${customerId}`);

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, tenantId: ctx.tenantId, deletedAt: null },
    select: { id: true, name: true, topType: true },
  });
  if (!customer) notFound();

  const wsId = await openWorkSession(ctx.tenantId, customerId, ctx.userId, job);
  const [ws, catalogRows, assetRows] = await Promise.all([
    getWorkSession(ctx.tenantId, wsId),
    listCatalog(ctx.tenantId, { activeOnly: true }),
    prisma.asset.findMany({
      where: { tenantId: ctx.tenantId, customerId, deletedAt: null },
      select: { id: true, brand: true, roomLocation: true, capacityPk: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const catalog = catalogRows.map((c) => ({ id: c.id, name: c.name, unit: c.unit, standardPrice: Number(c.standardPrice), category: c.category }));
  const assets = assetRows.map((a) => ({ id: a.id, label: [a.brand, a.capacityPk ? `${a.capacityPk}PK` : null, a.roomLocation].filter(Boolean).join(" · ") || "Unit AC" }));
  const items = ws.items.map((it) => ({
    id: it.id, desc: it.descSnapshot, qty: Number(it.qty), unit: it.unit,
    unitPrice: Number(it.unitPriceSnapshot), lineTotal: Number(it.lineTotal),
    assetLabel: it.asset ? [it.asset.brand, it.asset.roomLocation].filter(Boolean).join(" · ") || null : null,
  }));

  return (
    <main className="min-h-screen bg-muted/40 pb-24">
      <WorkSessionScreen
        wsId={wsId}
        customerName={customer.name}
        isTempo={(customer.topType ?? "CASH") !== "CASH"}
        catalog={catalog}
        assets={assets}
        initialItems={items}
      />
    </main>
  );
}
