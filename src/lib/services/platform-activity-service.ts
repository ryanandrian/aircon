/**
 * Laporan aktivitas usaha per tenant — PLATFORM-ADMIN-ONLY (read-only).
 *
 * Tujuan: admin platform perlu tahu siapa tenant yang benar-benar bekerja
 * (pekerjaan/pelanggan/invoice) dan siapa yang diam — tanpa membuka tiap
 * dashboard tenant satu per satu.
 *
 * Catatan penting soal zona waktu:
 * - Kolom `timestamp without time zone` di Postgres dibaca Prisma sebagai UTC.
 *   Tanggal dihitung di zona tenant (default Asia/Jakarta) agar "hari ini"
 *   Meaningful. Semua parameter periode dihitung di memori (bukan SQL),
 *   sehingga tidak ada ambiguitas UTC vs WIB.
 */
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { TenantPlan, TenantStatus } from "@prisma/client";
import {
  activityLevel,
  activitySummary,
  type ActivityLevel,
} from "@/lib/services/platform-activity";

export type ActivityPeriod = "7d" | "30d" | "90d";

const PERIOD_DAYS: Record<ActivityPeriod, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

export const ACTIVITY_PERIOD_OPTIONS: { value: ActivityPeriod; label: string }[] = [
  { value: "7d", label: "7 Hari Terakhir" },
  { value: "30d", label: "30 Hari Terakhir" },
  { value: "90d", label: "90 Hari Terakhir" },
];

export interface TenantActivityRow {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  plan: TenantPlan;
  status: TenantStatus;
  timezone: string;
  /** Jumlah pekerjaan dibuat dalam periode. */
  jobs: number;
  /** Jumlah pekerjaan selesai dalam periode. */
  jobsCompleted: number;
  /** Jumlah pelanggan baru dalam periode. */
  customers: number;
  /** Jumlah unit AC baru dalam periode. */
  assets: number;
  /** Jumlah invoice terbit dalam periode. */
  invoices: number;
  /** Jumlah pekerjaan yang masih berjalan (tak terselesaikan, bukan CANCELLED). */
  jobsOpen: number;
  /** Aktivitas terakhir yang terdeteksi (pekerjaan/pelanggan/invoice/unit). */
  lastActivityAt: Date | null;
  /** Tingkat aktivitas deskriptif pada periode. */
  level: ActivityLevel;
  /** Ringkasan teks siap tampil. */
  summary: string;
}

export interface TenantActivityReport {
  period: ActivityPeriod;
  periodDays: number;
  /** Batas periode (UTC) — dipakai display. */
  since: Date;
  until: Date;
  rows: TenantActivityRow[];
  totals: {
    tenants: number;
    tenantsWithJobs: number;
    tenantsWithOtherActivity: number;
    tenantsWithNoActivity: number;
    jobs: number;
    jobsCompleted: number;
    customers: number;
    invoices: number;
  };
}

/** Hitung aktivitas per tenant untuk satu periode (read-only). */
export async function getTenantActivityReport(
  period: ActivityPeriod = "30d",
  now = new Date(),
): Promise<TenantActivityReport> {
  const days = PERIOD_DAYS[period] ?? PERIOD_DAYS["30d"];
  const since = new Date(now.getTime() - days * 86_400_000);

  const tenants = await prisma.tenant.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      plan: true,
      status: true,
      timezone: true,
      _count: { select: { jobs: true } },
    },
  });

  const tenantIds = tenants.map((t) => t.id);
  if (tenantIds.length === 0) {
    return {
      period,
      periodDays: days,
      since,
      until: now,
      rows: [],
      totals: {
        tenants: 0,
        tenantsWithJobs: 0,
        tenantsWithOtherActivity: 0,
        tenantsWithNoActivity: 0,
        jobs: 0,
        jobsCompleted: 0,
        customers: 0,
        invoices: 0,
      },
    };
  }

  // Agregasi per tenant — 5 query groupBy (bukan N+1).
  const [jobsGroup, completedGroup, customersGroup, assetsGroup, invoicesGroup, openJobsGroup] =
    await Promise.all([
      prisma.jobOrder.groupBy({
        by: ["tenantId"],
        where: { tenantId: { in: tenantIds }, createdAt: { gte: since } },
        _count: { _all: true },
      }),
      prisma.jobOrder.groupBy({
        by: ["tenantId"],
        where: { tenantId: { in: tenantIds }, completedAt: { gte: since } },
        _count: { _all: true },
      }),
      prisma.customer.groupBy({
        by: ["tenantId"],
        where: { tenantId: { in: tenantIds }, createdAt: { gte: since } },
        _count: { _all: true },
      }),
      prisma.asset.groupBy({
        by: ["tenantId"],
        where: { tenantId: { in: tenantIds }, createdAt: { gte: since } },
        _count: { _all: true },
      }),
      prisma.invoice.groupBy({
        by: ["tenantId"],
        where: { tenantId: { in: tenantIds }, issueDate: { gte: since } },
        _count: { _all: true },
      }),
      prisma.jobOrder.groupBy({
        by: ["tenantId"],
        where: {
          tenantId: { in: tenantIds },
          status: { notIn: ["COMPLETED", "CANCELLED"] },
        },
        _count: { _all: true },
      }),
    ]);

  const toMap = (rows: { tenantId: string; _count: { _all: number } }[]) =>
    new Map(rows.map((r) => [r.tenantId, r._count._all]));

  const jobsMap = toMap(jobsGroup);
  const completedMap = toMap(completedGroup);
  const customersMap = toMap(customersGroup);
  const assetsMap = toMap(assetsGroup);
  const invoicesMap = toMap(invoicesGroup);
  const openJobsMap = toMap(openJobsGroup);

  // Aktivitas terakhir per tenant (paling baru dari 4 sumber).
  // Catatan: pakai Prisma.sql + Prisma.join (driver Postgres tak dukung placeholder `?`).
  const lastActivity = await prisma.$queryRaw<{ tenantId: string; lastActivityAt: Date }[]>(Prisma.sql`
    SELECT "tenantId", MAX("lastActivityAt") AS "lastActivityAt" FROM (
      SELECT "tenantId", "createdAt" AS "lastActivityAt" FROM "JobOrder"
      UNION ALL
      SELECT "tenantId", "createdAt" FROM "Customer"
      UNION ALL
      SELECT "tenantId", "issueDate" FROM "Invoice"
      UNION ALL
      SELECT "tenantId", "createdAt" FROM "Asset"
    ) AS src
    WHERE "tenantId" IN (${Prisma.join(tenantIds)})
    GROUP BY "tenantId"
  `);
  const lastActivityMap = new Map(lastActivity.map((r) => [r.tenantId, r.lastActivityAt]));

  const rows: TenantActivityRow[] = tenants.map((t) => {
    const jobs = jobsMap.get(t.id) ?? 0;
    const jobsCompleted = completedMap.get(t.id) ?? 0;
    const customers = customersMap.get(t.id) ?? 0;
    const assets = assetsMap.get(t.id) ?? 0;
    const invoices = invoicesMap.get(t.id) ?? 0;
    const jobsOpen = openJobsMap.get(t.id) ?? 0;
    const lastActivityAt = lastActivityMap.get(t.id) ?? null;

    return {
      tenantId: t.id,
      tenantName: t.name,
      tenantSlug: t.slug,
      plan: t.plan,
      status: t.status,
      timezone: t.timezone,
      jobs,
      jobsCompleted,
      customers,
      assets,
      invoices,
      jobsOpen,
      lastActivityAt,
      level: activityLevel({ jobs, jobsCompleted, customers, invoices }),
      summary: activitySummary({ jobs, jobsCompleted, customers, invoices }),
    };
  });

  return {
    period,
    periodDays: days,
    since,
    until: now,
    rows,
    totals: {
      tenants: rows.length,
      tenantsWithJobs: rows.filter((r) => r.level === "JOBS").length,
      tenantsWithOtherActivity: rows.filter((r) => r.level === "OTHER").length,
      tenantsWithNoActivity: rows.filter((r) => r.level === "NONE").length,
      jobs: rows.reduce((s, r) => s + r.jobs, 0),
      jobsCompleted: rows.reduce((s, r) => s + r.jobsCompleted, 0),
      customers: rows.reduce((s, r) => s + r.customers, 0),
      invoices: rows.reduce((s, r) => s + r.invoices, 0),
    },
  };
}

/** Export rentang periode yang digunakan laporan. */
export { PERIOD_DAYS };
