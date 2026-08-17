"use server";

import { revalidatePath } from "next/cache";
import { getServerContext } from "@/lib/auth/context";
import { assertRole, AuthError } from "@/lib/auth/guard";
import {
  createJob,
  assignJob,
  JobError,
  type CreateJobInput,
} from "@/lib/services/job-management-service";
import { transitionJob, TransitionError } from "@/lib/services/job-service";
import type { ServiceType } from "@prisma/client";

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

    revalidatePath("/app/pekerjaan");
    return { ok: true, data: { id: job.id } };
  } catch (err) {
    return { ok: false, error: toMessage(err, "Gagal membuat pekerjaan. Coba lagi.") };
  }
}

/** Assign/ubah teknisi + jadwal pekerjaan (DRAFT/ASSIGNED). SECURITY: OWNER/ADMIN. */
export async function actionAssignJob(
  jobId: string,
  technicianId: string,
  scheduledDate: string,
  scheduledTime?: string,
): Promise<ActionResult> {
  try {
    const ctx = await getServerContext();
    assertRole(ctx.role, ["OWNER", "ADMIN"]);

    if (!jobId) return { ok: false, error: "Pekerjaan tidak dikenal." };
    if (!technicianId) return { ok: false, error: "Teknisi wajib dipilih." };
    const when = toDate(scheduledDate, scheduledTime);
    if (!when) return { ok: false, error: "Jadwal wajib diisi." };

    await assignJob(ctx.tenantId, jobId, ctx.userId, {
      technicianId,
      scheduledDate: when,
      windowStart: when,
    });

    revalidatePath("/app/pekerjaan");
    revalidatePath(`/app/pekerjaan/${jobId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: toMessage(err, "Gagal menugaskan teknisi. Coba lagi.") };
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
