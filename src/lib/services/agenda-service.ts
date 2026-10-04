/**
 * Agenda Pekerjaan — query list & count (tenant-scoped).
 *
 * Dipakai page /app/pekerjaan (server) dan server action (client reload).
 * Semua query di sini memakai WHERE yang SAMA dengan kartu hitungan, supaya
 * angka kartu = isi daftar (tidak ada angka menyesatkan).
 *
 * Aturan non-destruktif (hasil audit data live 2026-10-04):
 * - Range pekan/bulan TIDAK boleh menyembunyikan job:
 *     (scheduledDate dalam range) OR (tanpa jadwal) OR (jatuh tempo/lewat & masih aktif)
 *   → job "Belum terjadwal" & job terlambat selalu tampil (grup teratas), seperti
 *     perilaku tab "Hari ini" pada board lama.
 * - Filter status "Semua" = semua status (termasuk Dibatalkan/Dijadwalkan Ulang),
 *   sehingga tak ada job yang hilang dari semua tampilan (bukan seperti hole lama
 *   di mana RESCHEDULED tak muncul di bucket mana pun).
 * - Pencarian & filter tim mengurangi DAFTAR, bukan kartu (kartu = statistik periode).
 */
import { prisma } from "@/lib/prisma";
import { ACTIVE_STATUSES } from "@/lib/domain/job-state-machine";
import type { Prisma } from "@prisma/client";
import type { JobStatus } from "@prisma/client";
import type { AgendaParams, AgendaStatusKey } from "@/lib/domain/agenda";

/** Item presentasi agenda — baris Prisma tidak dikirim mentah ke klien. */
export interface AgendaJobItem {
  id: string;
  customerName: string;
  address: string | null;
  serviceType: string;
  status: string;
  scheduledDate: string | null;
  /** Riwayat: dipakai mengelompokkan job final tanpa jadwal (lihat effectiveHistoryDate). */
  completedAt: string | null;
  updatedAt: string;
  /** Jam selesai bila diisi pada form (data live saat ini: belum ada yang mengisi). */
  windowEnd: string | null;
  unit: string | null;
  technicians: string[];
  kernets: string[];
  /** Hanya ada JobOrder.technicianId legacy (tanpa JobAssignment) — data live: ada 5. */
  legacyTechnician: string | null;
}

export interface AgendaCounts {
  /** Total job pada periode (semua status). */
  total: number;
  /** Job berjalan HARI INI (lintas periode — selalu relevan). */
  today: number;
  /** Selesai pada periode. */
  done: number;
  /** Masih berjalan tapi belum punya tim (teknisi/kernet). */
  noTeam: number;
  /** Masih berjalan tapi belum punya tanggal jadwal. */
  noSchedule: number;
}

const ACTIVE = ACTIVE_STATUSES;
const DONE: JobStatus[] = ["COMPLETED"];

/**
 * WHERE daftar. `statusOverride` dipakai kartu hitungan (dipaksa SEMUA).
 * Range hanya untuk view week/month; riwayat tanpa range.
 */
export function agendaWhere(
  tenantId: string,
  params: AgendaParams,
  range: { from: Date; to: Date } | null,
  statusOverride?: AgendaStatusKey,
): Prisma.JobOrderWhereInput {
  const status = statusOverride ?? params.status;
  const where: Prisma.JobOrderWhereInput = { tenantId, deletedAt: null };

  if (status === "BELUM") where.status = { in: ACTIVE };
  else if (status === "SELESAI") where.status = { in: DONE };
  else if (status === "BATAL") where.status = { in: ["CANCELLED"] };
  else if (status === "ULANG") where.status = { in: ["RESCHEDULED"] };
  // "SEMUA" → tanpa batasan status: semua job terlihat (tanpa celah tersembunyi).

  const rangeClauses: Prisma.JobOrderWhereInput[] = [];
  if (range) {
    rangeClauses.push({
      AND: [
        { scheduledDate: { gte: range.from } },
        { scheduledDate: { lte: range.to } },
      ],
    });
    // Tanpa jadwal → hanya yang MASIH AKTIF (mis. belum diatur jadwalnya).
    // Job COMPLETED/CANCELLED tanpa jadwal TIDAK ikut tampilan pekan/bulan:
    // bukan lagi "pekerjaan yang butuh jadwal", hanya terlihat di Riwayat.
    rangeClauses.push({
      AND: [{ scheduledDate: null }, { status: { in: ACTIVE } }],
    });
    // Terlewat & belum selesai → tetap terlihat di periode mana pun (jangan lolos).
    rangeClauses.push({
      AND: [{ scheduledDate: { lt: range.from } }, { status: { in: ACTIVE } }],
    });
  }

  const clauses: Prisma.JobOrderWhereInput[] = [];
  const q = params.q.trim();
  if (q) {
    clauses.push({
      OR: [
        { customer: { name: { contains: q, mode: "insensitive" } } },
        { customer: { phone: { contains: q } } },
        { asset: { brand: { contains: q, mode: "insensitive" } } },
        { asset: { model: { contains: q, mode: "insensitive" } } },
        { addressSnapshot: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  if (params.tim) {
    clauses.push({
      OR: [
        { technicianId: params.tim },
        { assignments: { some: { personId: params.tim, tenantId } } },
      ],
    });
  }

  const and: Prisma.JobOrderWhereInput[] = [];
  if (rangeClauses.length) and.push({ OR: rangeClauses });
  if (clauses.length) and.push(...clauses);
  if (and.length) where.AND = and;
  return where;
}

/**
 * Daftar job untuk satu halaman tampilan.
 * - week/month: tanpa jadwal & terlewat diurutkan ke atas (scheduledDate asc nulls first)
 * - riwayat: terbaru dulu (scheduledDate desc nulls last) → grup hari menurun
 * Cursor pagination per halaman (riwayat besar); minggu/bulan dibatasi 1000 baris.
 */
export async function listAgendaJobs(
  tenantId: string,
  params: AgendaParams,
  range: { from: Date; to: Date } | null,
  opts: { cursor?: string; limit?: number } = {},
) {
  const limit = Math.max(1, Math.min(opts.limit ?? 60, 100));
  const where = agendaWhere(tenantId, params, range);
  const riwayat = params.view === "riwayat";
  const orderBy: Prisma.JobOrderOrderByWithRelationInput[] = riwayat
    ? [
        { scheduledDate: { sort: "desc", nulls: "last" } },
        { createdAt: "desc" },
        { id: "desc" },
      ]
    : [
        { scheduledDate: { sort: "asc", nulls: "first" } },
        { windowStart: "asc" },
        { createdAt: "desc" },
        { id: "desc" },
      ];

  const rows = await prisma.jobOrder.findMany({
    where,
    select: {
      id: true,
      serviceType: true,
      status: true,
      scheduledDate: true,
      completedAt: true,
      updatedAt: true,
      windowEnd: true,
      addressSnapshot: true,
      technicianId: true,
      technician: { select: { user: { select: { name: true } } } },
      customer: { select: { name: true, address: true } },
      asset: { select: { brand: true, model: true, roomLocation: true } },
      assignments: {
        where: { tenantId },
        select: {
          roleOnJob: true,
          isLead: true,
          createdAt: true,
          person: { select: { user: { select: { name: true } } } },
        },
        orderBy: [{ isLead: "desc" }, { createdAt: "asc" }],
      },
    },
    orderBy,
    take: limit + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  const jobs: AgendaJobItem[] = page.map((j) => {
    const technicians = j.assignments
      .filter((a) => a.roleOnJob === "TECHNICIAN")
      .map((a) => a.person.user.name);
    const kernets = j.assignments
      .filter((a) => a.roleOnJob === "KERNET")
      .map((a) => a.person.user.name);
    const legacyTechnician =
      technicians.length === 0 ? (j.technician?.user.name ?? null) : null;
    const unit = j.asset
      ? ([j.asset.brand, j.asset.model].filter(Boolean).join(" ").trim() ||
          j.asset.roomLocation ||
          "Unit AC")
      : null;
    return {
      id: j.id,
      customerName: j.customer.name,
      address: j.addressSnapshot ?? j.customer.address,
      serviceType: j.serviceType,
      status: j.status,
      scheduledDate: j.scheduledDate?.toISOString() ?? null,
      completedAt: j.completedAt?.toISOString() ?? null,
      updatedAt: j.updatedAt.toISOString(),
      windowEnd: j.windowEnd?.toISOString() ?? null,
      unit,
      technicians,
      kernets,
      legacyTechnician,
    };
  });

  return {
    jobs,
    nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
  };
}

/**
 * Kartu hitungan — WHERE disusun dari agendaWhere yang sama (status dipaksa SEMUA),
 * lalu disaring status per kartu. "Hari ini" dihitung lintas periode.
 */
export async function countAgendaJobs(
  tenantId: string,
  params: AgendaParams,
  range: { from: Date; to: Date } | null,
): Promise<AgendaCounts> {
  const baseParams: AgendaParams = { ...params, q: "", tim: "" };
  const base = agendaWhere(tenantId, baseParams, range, "SEMUA");

  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const [total, today, done, noTeam, noSchedule] = await Promise.all([
    prisma.jobOrder.count({ where: base }),
    prisma.jobOrder.count({
      where: {
        tenantId,
        deletedAt: null,
        status: { in: ACTIVE },
        scheduledDate: { gte: startToday, lte: endToday },
      },
    }),
    prisma.jobOrder.count({
      where: { ...base, status: { in: DONE } },
    }),
    prisma.jobOrder.count({
      where: {
        ...base,
        status: { in: ACTIVE },
        technicianId: null,
        assignments: { none: { tenantId } },
      },
    }),
    prisma.jobOrder.count({
      where: { ...base, status: { in: ACTIVE }, scheduledDate: null },
    }),
  ]);

  return { total, today, done, noTeam, noSchedule };
}

/** Daftar personel aktif tenant (untuk Select filter tim). */
export async function listAgendaPeople(tenantId: string) {
  const rows = await prisma.technician.findMany({
    where: { tenantId, active: true },
    select: {
      id: true,
      position: true,
      user: { select: { name: true } },
    },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });
  return rows.map((r) => ({ id: r.id, name: r.user.name, position: r.position }));
}
