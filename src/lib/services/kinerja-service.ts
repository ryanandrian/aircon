/**
 * Kinerja Service (2026-10-05) — rangkuman + detail kinerja tim per periode.
 *
 * SUMBER KEBENARAN = pekerjaan YANG BENAR-BENAR DIKERJAKAN:
 *   WorkSession.status = CLOSED (di-tutup teknisi) → WorkItem.techIds/kernetIds
 *   (audit data live: 88/88 item terisi).
 * BUKAN JobAssignment (penugasan) — tidak dipakai di sini sama sekali.
 *
 * Periode & agregasi murni ada di `@/lib/domain/kinerja` (diuji terpisah).
 * Dasar periode = tanggal kerja (closedAt), sesuai keputusan user 2026-10-05:
 * semua kolom berbasis tanggal kerja, berbeda dgn computeIncentives (acuan
 * invoice) yang TETAP dipakai apa adanya di halaman Laporan Keuangan.
 *
 * Insentif: memakai computeItemIncentive (K6/K7) + gerbang incentiveEnabled —
 * aturan SAMA dgn computeIncentives, hanya dasar perbedaan acuan di atas.
 * SECURITY: tenant-scoped.
 */
import { prisma } from "@/lib/prisma";
import { aggregateKinerja, type KinerjaSession, type KinItem, type KinPerson } from "@/lib/domain/kinerja-aggregate";
import type { IncentiveCatalogItem } from "@/lib/services/service-catalog-service";

export interface KinerjaResult {
  people: KinPerson[];
  totalPeople: number;
  totalItems: number;
  totalJobs: number;
  incentiveEnabled: boolean;
}

/** Label unit mengikuti poli resmi: "merek · PK · ruangan" (unit-manager / /t/kerja). */
function unitLabel(a: { brand?: string | null; capacityPk?: number | null; roomLocation?: string | null } | null): string | null {
  if (!a) return null;
  const label = [a.brand, a.capacityPk ? `${a.capacityPk}PK` : null, a.roomLocation].filter(Boolean).join(" · ");
  return label || null;
}

export async function listKinerja(tenantId: string, start: Date, end: Date): Promise<KinerjaResult> {
  // 1) Sesi CLOSED dalam rentang + nama pelanggan + item (roster & harga snapshot).
  const sessions = await prisma.workSession.findMany({
    where: { tenantId, status: "CLOSED", closedAt: { gte: start, lte: end } },
    select: {
      id: true,
      jobId: true,
      closedAt: true,
      customer: { select: { name: true } },
      items: {
        select: {
          serviceId: true,
          descSnapshot: true,
          qty: true,
          unit: true,
          unitPriceSnapshot: true,
          lineTotal: true,
          techIds: true,
          kernetIds: true,
          asset: { select: { brand: true, capacityPk: true, roomLocation: true } },
        },
      },
    },
    orderBy: { closedAt: "desc" },
  });

  // 2) Tipe pekerjaan per jobId (WorkSession tidak punya relasi job — query terpisah).
  const jobIds = [...new Set(sessions.map((s) => s.jobId).filter(Boolean))] as string[];
  const jobs = jobIds.length
    ? await prisma.jobOrder.findMany({
        where: { tenantId, id: { in: jobIds } },
        select: { id: true, serviceType: true },
      })
    : [];
  const jobTypeOf = new Map(jobs.map((j) => [j.id, j.serviceType as string]));

  // 3) Config insentif tenant (gerbang source — sama computeIncentives).
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { teamIncentiveMode: true, incentiveEnabled: true },
  });
  const incentiveEnabled = tenant?.incentiveEnabled ?? false;
  const teamMode = (tenant?.teamIncentiveMode ?? "BAGI_RATA") as "BAGI_RATA" | "PENUH";

  // 4) Nama personel (semua teknisi tenant — roster WorkItem merujuk id teknisi).
  const techs = await prisma.technician.findMany({
    where: { tenantId },
    select: { id: true, user: { select: { name: true } } },
  });
  const names = new Map(techs.map((t) => [t.id, t.user?.name ?? "—"]));

  // 5) Katalog insentif utk service yang dipakai.
  const serviceIds = [...new Set(sessions.flatMap((s) => s.items.map((i) => i.serviceId)).filter(Boolean))] as string[];
  const catalog = serviceIds.length
    ? await prisma.serviceCatalog.findMany({
        where: { id: { in: serviceIds }, tenantId },
        select: {
          id: true, standardPrice: true,
          techIncentiveType: true, techIncentiveValue: true,
          kernetIncentiveType: true, kernetIncentiveValue: true,
        },
      })
    : [];
  const catalogById = new Map<string, IncentiveCatalogItem>(
    catalog.map((c) => [c.id, {
      standardPrice: Number(c.standardPrice),
      techIncentiveType: c.techIncentiveType,
      techIncentiveValue: Number(c.techIncentiveValue),
      kernetIncentiveType: c.kernetIncentiveType,
      kernetIncentiveValue: Number(c.kernetIncentiveValue),
    }]),
  );

  // 6) Bentuk input domain (agregasi murni, diuji di tests/kinerja.test.ts).
  const input: KinerjaSession[] = sessions.map((s) => ({
    sessionId: s.id,
    jobId: s.jobId,
    closedAt: s.closedAt!,
    customer: s.customer.name,
    jobType: s.jobId ? jobTypeOf.get(s.jobId) ?? null : null,
    items: s.items.map((it): KinItem => ({
      serviceId: it.serviceId,
      desc: it.descSnapshot,
      qty: Number(it.qty),
      unit: it.unit,
      unitPrice: Number(it.unitPriceSnapshot),
      lineTotal: Number(it.lineTotal),
      techIds: it.techIds,
      kernetIds: it.kernetIds,
      assetLabel: unitLabel(it.asset),
    })),
  }));

  const people = aggregateKinerja(input, { names, catalogById, teamMode, incentiveEnabled });
  return {
    people,
    totalPeople: people.length,
    totalItems: people.reduce((sum, p) => sum + p.itemCount, 0),
    // Pekerjaan UNIK lintas personel (1 sesi = 1 pekerjaan dikerjakan).
    totalJobs: new Set(sessions.map((s) => s.jobId ?? `ws:${s.id}`)).size,
    incentiveEnabled,
  };
}
