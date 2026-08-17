/**
 * Platform service — operasi LINTAS-tenant untuk Admin Platform (tim internal).
 * PENTING: setiap fungsi di sini bersifat lintas-tenant (memang tugas admin),
 * jadi HANYA boleh dipanggil SETELAH requirePlatformAdmin() di entry point
 * (layout admin + tiap server action). Jangan panggil dari konteks tenant biasa.
 */
import { prisma } from "@/lib/prisma";
import type { TenantStatus, TenantPlan } from "@prisma/client";

const VALID_STATUSES: readonly TenantStatus[] = [
  "TRIAL",
  "ACTIVE",
  "PAST_DUE",
  "SUSPENDED",
  "CANCELLED",
];

export interface TenantSummary {
  id: string;
  name: string;
  slug: string;
  phone: string;
  plan: TenantPlan;
  status: TenantStatus;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  createdAt: Date;
  userCount: number;
  jobCount: number;
}

export interface ListTenantsParams {
  search?: string;
  status?: TenantStatus;
  cursor?: string;
  limit?: number;
}

export interface ListTenantsResult {
  items: TenantSummary[];
  nextCursor: string | null;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * PLATFORM-ADMIN-ONLY.
 * Daftar semua usaha (tenant) + ringkasan. Mendukung filter status, pencarian
 * nama/slug/telepon, dan paginasi cursor (by id).
 */
export async function listTenants(params: ListTenantsParams = {}): Promise<ListTenantsResult> {
  const limit = Math.min(Math.max(params.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const search = params.search?.trim();

  const tenants = await prisma.tenant.findMany({
    where: {
      ...(params.status ? { status: params.status } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { slug: { contains: search, mode: "insensitive" as const } },
              { phone: { contains: search } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    select: {
      id: true,
      name: true,
      slug: true,
      phone: true,
      plan: true,
      status: true,
      trialEndsAt: true,
      currentPeriodEnd: true,
      createdAt: true,
      _count: { select: { users: true, jobs: true } },
    },
  });

  const hasMore = tenants.length > limit;
  const page = hasMore ? tenants.slice(0, limit) : tenants;

  return {
    items: page.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      phone: t.phone,
      plan: t.plan,
      status: t.status,
      trialEndsAt: t.trialEndsAt,
      currentPeriodEnd: t.currentPeriodEnd,
      createdAt: t.createdAt,
      userCount: t._count.users,
      jobCount: t._count.jobs,
    })),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  };
}

/**
 * PLATFORM-ADMIN-ONLY.
 * Detail satu usaha: data tenant + subscription + pembayaran terakhir + counts.
 * Mengembalikan null bila tenant tidak ditemukan.
 */
export async function getTenantDetail(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      subscription: true,
      payments: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      _count: { select: { users: true, jobs: true, customers: true } },
    },
  });

  return tenant;
}

export type TenantDetail = NonNullable<Awaited<ReturnType<typeof getTenantDetail>>>;

/**
 * PLATFORM-ADMIN-ONLY.
 * Ubah status langganan usaha (mis. aktifkan / tangguhkan). Memvalidasi status.
 * Menyinkronkan status di Subscription bila ada, agar konsisten.
 */
export async function setTenantStatus(tenantId: string, status: TenantStatus) {
  if (!VALID_STATUSES.includes(status)) {
    throw new Error(`Status tidak valid: ${String(status)}`);
  }

  const existing = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, subscription: { select: { id: true } } },
  });
  if (!existing) {
    throw new Error("Usaha tidak ditemukan");
  }

  const updated = await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      status,
      ...(existing.subscription
        ? { subscription: { update: { status } } }
        : {}),
    },
  });

  return updated;
}

/**
 * PLATFORM-ADMIN-ONLY.
 * Angka ringkas untuk dashboard: total usaha per status + pembayaran terbaru.
 */
export async function getPlatformStats() {
  const [total, active, trial, pastDue, suspended, recentPayments] = await Promise.all([
    prisma.tenant.count(),
    prisma.tenant.count({ where: { status: "ACTIVE" } }),
    prisma.tenant.count({ where: { status: "TRIAL" } }),
    prisma.tenant.count({ where: { status: "PAST_DUE" } }),
    prisma.tenant.count({ where: { status: "SUSPENDED" } }),
    prisma.payment.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { tenant: { select: { id: true, name: true } } },
    }),
  ]);

  return { total, active, trial, pastDue, suspended, recentPayments };
}

export type PlatformStats = Awaited<ReturnType<typeof getPlatformStats>>;
