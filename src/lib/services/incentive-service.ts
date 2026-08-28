/**
 * Incentive Service (F6.1) — agregasi insentif per personel/periode (K5/K6/K7).
 * Acuan periode (K5): LUNAS (invoice.paidAt) [default] atau TERBIT (invoice.issueDate) — dari Tenant.incentiveBasis.
 * Mode tim (K7): BAGI_RATA [default] | PENUH — dari Tenant.teamIncentiveMode.
 * Per WorkItem: setiap techId dapat insentif pos TECHNICIAN, kernetId pos KERNET (K6, semua kategori).
 */
import { prisma } from "@/lib/prisma";
import { computeItemIncentive, type IncentiveCatalogItem } from "@/lib/services/service-catalog-service";

export interface IncentiveLineInput {
  serviceId: string | null;
  unitPrice: number;
  qty: number;
  techIds: string[];
  kernetIds: string[];
}

export interface PersonIncentive {
  personId: string;
  personName: string;
  amount: number;
  itemCount: number;
}

/**
 * Agregasi MURNI: hitung insentif per personel dari daftar item + config katalog + mode tim.
 * @param catalogById map serviceId → config insentif katalog.
 */
export function aggregateIncentives(
  items: IncentiveLineInput[],
  catalogById: Map<string, IncentiveCatalogItem>,
  teamMode: "BAGI_RATA" | "PENUH",
): Map<string, number> {
  const byPerson = new Map<string, number>();
  for (const it of items) {
    if (!it.serviceId) continue;
    const cat = catalogById.get(it.serviceId);
    if (!cat) continue;
    // Teknisi
    const nTech = it.techIds.length;
    if (nTech > 0) {
      const per = computeItemIncentive(cat, "TECHNICIAN", it.unitPrice, it.qty, nTech, teamMode);
      for (const pid of it.techIds) byPerson.set(pid, (byPerson.get(pid) ?? 0) + per);
    }
    // Kernet
    const nKernet = it.kernetIds.length;
    if (nKernet > 0) {
      const per = computeItemIncentive(cat, "KERNET", it.unitPrice, it.qty, nKernet, teamMode);
      for (const pid of it.kernetIds) byPerson.set(pid, (byPerson.get(pid) ?? 0) + per);
    }
  }
  return byPerson;
}

/**
 * Insentif per personel dalam periode [start, end] (tenant-scoped).
 * Item diambil dari WorkItem yang WorkSession-nya punya Invoice memenuhi acuan (LUNAS/TERBIT) dalam periode.
 */
export async function computeIncentives(
  tenantId: string, start: Date, end: Date,
): Promise<PersonIncentive[]> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId }, select: { teamIncentiveMode: true, incentiveBasis: true },
  });
  const basis = tenant?.incentiveBasis ?? "LUNAS";
  const teamMode = (tenant?.teamIncentiveMode ?? "BAGI_RATA") as "BAGI_RATA" | "PENUH";

  // Invoice yang memenuhi acuan dalam periode (hanya INVOICE, bukan proforma/cancelled).
  const invoiceWhere = basis === "LUNAS"
    ? { tenantId, docType: "INVOICE" as const, status: "PAID" as const, paidAt: { gte: start, lte: end } }
    : { tenantId, docType: "INVOICE" as const, status: { in: ["ISSUED", "PAID", "OVERDUE"] as ("ISSUED" | "PAID" | "OVERDUE")[] }, issueDate: { gte: start, lte: end } };

  const invoices = await prisma.invoice.findMany({
    where: invoiceWhere, select: { workSessionId: true },
  });
  const wsIds = [...new Set(invoices.map((i) => i.workSessionId).filter(Boolean) as string[])];
  if (wsIds.length === 0) return [];

  const items = await prisma.workItem.findMany({
    where: { tenantId, workSessionId: { in: wsIds } },
    select: { serviceId: true, unitPriceSnapshot: true, qty: true, techIds: true, kernetIds: true },
  });

  // Config insentif katalog utk service yang dipakai.
  const serviceIds = [...new Set(items.map((i) => i.serviceId).filter(Boolean) as string[])];
  const catalog = serviceIds.length
    ? await prisma.serviceCatalog.findMany({
        where: { id: { in: serviceIds }, tenantId },
        select: { id: true, standardPrice: true, techIncentiveType: true, techIncentiveValue: true, kernetIncentiveType: true, kernetIncentiveValue: true },
      })
    : [];
  const catalogById = new Map<string, IncentiveCatalogItem>(
    catalog.map((c) => [c.id, {
      standardPrice: Number(c.standardPrice),
      techIncentiveType: c.techIncentiveType, techIncentiveValue: Number(c.techIncentiveValue),
      kernetIncentiveType: c.kernetIncentiveType, kernetIncentiveValue: Number(c.kernetIncentiveValue),
    }]),
  );

  const lines: IncentiveLineInput[] = items.map((i) => ({
    serviceId: i.serviceId, unitPrice: Number(i.unitPriceSnapshot), qty: Number(i.qty),
    techIds: i.techIds, kernetIds: i.kernetIds,
  }));
  const byPerson = aggregateIncentives(lines, catalogById, teamMode);

  // Jumlah item per personel (utk info).
  const itemCount = new Map<string, number>();
  for (const it of lines) {
    for (const pid of [...it.techIds, ...it.kernetIds]) itemCount.set(pid, (itemCount.get(pid) ?? 0) + 1);
  }

  // Nama personel (via Technician → User).
  const personIds = [...byPerson.keys()];
  const techs = personIds.length
    ? await prisma.technician.findMany({ where: { id: { in: personIds }, tenantId }, select: { id: true, user: { select: { name: true } } } })
    : [];
  const nameOf = new Map(techs.map((t) => [t.id, t.user?.name ?? "—"]));

  return personIds
    .map((pid) => ({ personId: pid, personName: nameOf.get(pid) ?? "—", amount: byPerson.get(pid) ?? 0, itemCount: itemCount.get(pid) ?? 0 }))
    .filter((p) => p.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}
