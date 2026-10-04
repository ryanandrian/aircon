"use server";

import { revalidatePath } from "next/cache";
import { getServerContext } from "@/lib/auth/context";
import { assertRole, AuthError } from "@/lib/auth/guard";
import {
  createJob,
  JobError,
  type CreateJobInput,
} from "@/lib/services/job-management-service";
import { transitionJob, TransitionError } from "@/lib/services/job-service";
import {
  assignJob as assignTeam,
  detectConflict,
  type AssignmentInput,
} from "@/lib/services/assignment-service";
import { prisma } from "@/lib/prisma";
import type { ServiceType } from "@prisma/client";
import {
  listAgendaJobs,
  countAgendaJobs,
  listAgendaPeople,
  type AgendaJobItem,
  type AgendaCounts,
} from "@/lib/services/agenda-service";
import { agendaRange, parseAgendaParams, type AgendaParams } from "@/lib/domain/agenda";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

const SERVICE_TYPES: ServiceType[] = [
  "CLEANING",
  "REFILL_FREON",
  "REPAIR",
  "INSTALL",
  "DISMANTLE",
  "INSPECTION",
  "OTHER",
];

/** Gabung tanggal (YYYY-MM-DD) + jam (HH:mm) → Date lokal. Null bila kosong/invalid. */
function toDate(dateStr: string, timeStr?: string): Date | null {
  if (!dateStr) return null;
  const iso = timeStr ? `${dateStr}T${timeStr}` : `${dateStr}T00:00`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export interface CreateJobFormInput {
  customerId: string;
  assetId?: string;
  serviceType: string;
  scheduledDate?: string;
  scheduledTime?: string;
  windowEndTime?: string;
  technicianId?: string;
  price?: string;
  notes?: string;
  /** FASE 5: pengingat yang dikonversi jadi pekerjaan ini (tombol "Jadikan Pekerjaan"). */
  reminderId?: string;
}

/** Buat pekerjaan baru. SECURITY: OWNER/ADMIN, tenant dari sesi. */
export async function actionCreateJob(
  input: CreateJobFormInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await getServerContext();
    assertRole(ctx.role, ["OWNER", "ADMIN"]);

    if (!input.customerId) return { ok: false, error: "Pelanggan wajib dipilih." };
    if (!SERVICE_TYPES.includes(input.serviceType as ServiceType)) {
      return { ok: false, error: "Jenis servis tidak dikenal." };
    }

    const scheduledDate = input.scheduledDate
      ? toDate(input.scheduledDate, input.scheduledTime)
      : null;
    const windowEnd =
      input.scheduledDate && input.windowEndTime
        ? toDate(input.scheduledDate, input.windowEndTime)
        : null;

    let price: number | undefined;
    if (input.price && input.price.trim() !== "") {
      const parsed = Number(input.price.replace(/[^\d]/g, ""));
      if (Number.isNaN(parsed) || parsed < 0) {
        return { ok: false, error: "Harga tidak valid." };
      }
      price = parsed;
    }

    const payload: CreateJobInput = {
      customerId: input.customerId,
      assetId: input.assetId || undefined,
      serviceType: input.serviceType as ServiceType,
      scheduledDate: scheduledDate ?? undefined,
      windowStart: scheduledDate ?? undefined,
      windowEnd: windowEnd ?? undefined,
      technicianId: input.technicianId || undefined,
      price,
      notes: input.notes?.trim() || undefined,
    };

    const job = await createJob(ctx.tenantId, ctx.userId, payload);

    // FASE 5 — konversi pengingat (opsional). Best-effort & tenant-scoped:
    // pengingat yang tidak cocok unit/status justru TIDAK diubah, job tetap jadi
    // (operasi utama membuat pekerjaan tidak diblokir oleh pengingat yang salah sasaran).
    if (input.reminderId) {
      try {
        await prisma.repeatReminder.updateMany({
          where: {
            id: input.reminderId,
            tenantId: ctx.tenantId,
            assetId: input.assetId,
            status: { in: ["QUEUED", "SENT"] },
          },
          data: { status: "CONVERTED", jobId: job.id },
        });
      } catch (err) {
        console.warn("[actionCreateJob] konversi pengingat dilewati:", err);
      }
      revalidatePath("/app/pengingat");
    }

    revalidatePath("/app/pekerjaan");
    return { ok: true, data: { id: job.id } };
  } catch (err) {
    return { ok: false, error: toMessage(err, "Gagal membuat pekerjaan. Coba lagi.") };
  }
}

/** Batalkan pekerjaan. SECURITY: OWNER/ADMIN. Alasan wajib bila sudah berjalan. */
export async function actionCancelJob(
  jobId: string,
  reason: string,
): Promise<ActionResult> {
  try {
    const ctx = await getServerContext();
    assertRole(ctx.role, ["OWNER", "ADMIN"]);

    if (!jobId) return { ok: false, error: "Pekerjaan tidak dikenal." };

    await transitionJob({
      tenantId: ctx.tenantId,
      jobId,
      toStatus: "CANCELLED",
      actorId: ctx.userId,
      role: ctx.role,
      meta: reason.trim() ? { reason: reason.trim() } : {},
    });

    revalidatePath("/app/pekerjaan");
    revalidatePath(`/app/pekerjaan/${jobId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: toMessage(err, "Gagal membatalkan pekerjaan. Coba lagi.") };
  }
}

function toMessage(err: unknown, fallback: string): string {
  if (err instanceof JobError) return err.message;
  if (err instanceof TransitionError) return err.message;
  if (err instanceof AuthError) return err.message;
  console.error("[pekerjaan action] gagal:", err);
  return fallback;
}

// ─────────── F3.3 Penugasan tim (multi-personel, peran cair) ───────────

export interface TeamMemberInput { personId: string; roleOnJob: "TECHNICIAN" | "KERNET"; isLead?: boolean; }

/** Cek bentrok jadwal utk sekumpulan personel pada jendela waktu tertentu. */
export async function actionCheckTeamConflicts(
  personIds: string[],
  scheduledDate: string,
  scheduledTime: string,
  durationMin: number,
  excludeJobId?: string,
): Promise<ActionResult<{ personId: string; name: string; conflicts: { customerName: string }[] }[]>> {
  try {
    const ctx = await getServerContext();
    assertRole(ctx.role, ["OWNER", "ADMIN"]);
    const start = toDate(scheduledDate, scheduledTime);
    if (!start) return { ok: false, error: "Jadwal wajib diisi." };
    const end = new Date(start.getTime() + (durationMin > 0 ? durationMin : 60) * 60000);

    const techs = await prisma.technician.findMany({
      where: { tenantId: ctx.tenantId, id: { in: personIds } },
      select: { id: true, user: { select: { name: true } } },
    });
    const nameOf = new Map(techs.map((t) => [t.id, t.user?.name ?? "—"]));

    const out = [];
    for (const pid of personIds) {
      const conflicts = await detectConflict(ctx.tenantId, pid, start, end, excludeJobId);
      if (conflicts.length > 0) {
        out.push({ personId: pid, name: nameOf.get(pid) ?? "—", conflicts: conflicts.map((c) => ({ customerName: c.customerName })) });
      }
    }
    return { ok: true, data: out };
  } catch (err) {
    return { ok: false, error: toMessage(err, "Gagal memeriksa jadwal.") };
  }
}

/** Tugaskan tim (N personel + peran) ke pekerjaan + jadwal. SECURITY: OWNER/ADMIN. */
export async function actionAssignTeam(
  jobId: string,
  members: TeamMemberInput[],
  scheduledDate: string,
  scheduledTime: string,
  durationMin: number,
): Promise<ActionResult> {
  try {
    const ctx = await getServerContext();
    assertRole(ctx.role, ["OWNER", "ADMIN"]);
    if (!jobId) return { ok: false, error: "Pekerjaan tidak dikenal." };
    if (members.length === 0) return { ok: false, error: "Pilih minimal 1 personel." };
    const start = toDate(scheduledDate, scheduledTime);
    if (!start) return { ok: false, error: "Jadwal wajib diisi." };
    const end = new Date(start.getTime() + (durationMin > 0 ? durationMin : 60) * 60000);

    const people: AssignmentInput[] = members.map((m) => ({
      personId: m.personId, roleOnJob: m.roleOnJob, isLead: m.isLead,
    }));
    await assignTeam(ctx.tenantId, jobId, people, { start, end });

    // Status DRAFT→ASSIGNED (transition lama, lewat lead). Abaikan bila sudah ASSIGNED+.
    try {
      await transitionJob({ tenantId: ctx.tenantId, jobId, toStatus: "ASSIGNED", actorId: ctx.userId, role: ctx.role, meta: {} });
    } catch { /* sudah di status lanjut — tak apa */ }

    revalidatePath("/app/pekerjaan");
    revalidatePath(`/app/pekerjaan/${jobId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: toMessage(err, "Gagal menugaskan tim.") };
  }
}

// ─────────── Agenda (pengganti tab today/upcoming/done) ───────────

export type { AgendaJobItem, AgendaCounts };

/** Data isi agenda untuk satu set searchParams (dipakai render awal & revisi klien). */
export type AgendaPayload = {
  params: AgendaParams;
  items: AgendaJobItem[];
  nextCursor: string | null;
  counts: AgendaCounts | null;
};

/** Pilihan filter tim (personel aktif tenant) — dikirim sekali dari page. */
export type AgendaPeople = Awaited<ReturnType<typeof listAgendaPeople>>;

/**
 * Muat isi agenda dari searchParams (server: validasi param + query tenant-scoped).
 * Dipakai AgendaBoard saat ganti tampilan/periode/filter/pencarian.
 * `cursor` = lanjutan halaman riwayat (hitungan kartu TIDAK dihitung ulang).
 */
export async function actionLoadAgenda(
  sp: { [key: string]: string | string[] | undefined },
  opts: { cursor?: string } = {},
): Promise<{ ok: true; data: AgendaPayload } | { ok: false; error: string }> {
  try {
    const ctx = await getServerContext();
    assertRole(ctx.role, ["OWNER", "ADMIN"]);
    const params = parseAgendaParams(sp);
    const range = agendaRange(params);
    const [{ jobs, nextCursor }, counts] = await Promise.all([
      listAgendaJobs(ctx.tenantId, params, range, { cursor: opts.cursor }),
      opts.cursor
        ? Promise.resolve<AgendaCounts | null>(null)
        : countAgendaJobs(ctx.tenantId, params, range),
    ]);
    return { ok: true, data: { params, items: jobs, nextCursor, counts } };
  } catch (err) {
    return { ok: false, error: toMessage(err, "Gagal memuat agenda pekerjaan.") };
  }
}
