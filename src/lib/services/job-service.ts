/**
 * Job Service — orkestrasi transisi + efek money loop.
 * Menutup loop: COMPLETED -> next_service_date -> RepeatReminder.
 */
import { prisma } from "@/lib/prisma";
import { canTransition } from "@/lib/domain/job-state-machine";
import { computeNextServiceDate } from "@/lib/domain/money-loop";
import { REPEAT_DEFAULTS } from "@/lib/domain/money-loop";
import type { JobStatus, Role } from "@prisma/client";

export class TransitionError extends Error {
  code: string;
  details?: unknown;
  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

interface TransitionInput {
  tenantId: string;
  jobId: string;
  toStatus: JobStatus;
  actorId: string;
  role: Role;
  clientEventId?: string;
  meta?: Record<string, unknown>;
}

/**
 * Transisi job dengan validasi state machine + guard + efek samping.
 * Idempoten via clientEventId.
 */
export async function transitionJob(input: TransitionInput) {
  const { tenantId, jobId, toStatus, actorId, role, clientEventId, meta } = input;

  // Idempotency: kalau event sudah pernah diproses, kembalikan job apa adanya
  if (clientEventId) {
    const dup = await prisma.jobProgressEvent.findUnique({
      where: { tenantId_clientEventId: { tenantId, clientEventId } },
    });
    if (dup) {
      const job = await prisma.jobOrder.findFirst({ where: { id: jobId, tenantId } });
      return { job, idempotentReplay: true };
    }
  }

  const job = await prisma.jobOrder.findFirst({ where: { id: jobId, tenantId } });
  if (!job) throw new TransitionError("NOT_FOUND", "Job tidak ditemukan");

  // Validasi transisi + role
  const check = canTransition(job.status, toStatus, role);
  if (!check.ok) {
    const code = check.reason?.startsWith("FORBIDDEN") ? "FORBIDDEN" : "ILLEGAL_TRANSITION";
    throw new TransitionError(code, check.reason ?? "Transisi tidak valid");
  }

  // Guard khusus COMPLETED: checklist required + foto after
  if (toStatus === "COMPLETED") {
    await assertCompletionGuards(tenantId, job.id, job.serviceType);
  }

  // Guard reason untuk WAITING/CANCELLED/RESCHEDULED
  if ((toStatus === "WAITING" || toStatus === "CANCELLED" || toStatus === "RESCHEDULED") && !meta?.reason && toStatus === "WAITING") {
    throw new TransitionError("GUARD_FAILED", "Alasan wajib diisi", { missing: ["reason"] });
  }

  // Eksekusi transisi + efek dalam satu transaksi
  const result = await prisma.$transaction(async (tx) => {
    const fromStatus = job.status;
    const data: Record<string, unknown> = { status: toStatus };
    let nextServiceDate: Date | null = null;

    if (toStatus === "COMPLETED") {
      const completedAt = new Date();
      data.completedAt = completedAt;

      // Ambil interval dari asset (fallback tenant)
      const asset = job.assetId
        ? await tx.asset.findUnique({ where: { id: job.assetId } })
        : null;
      const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });
      nextServiceDate = computeNextServiceDate(
        completedAt,
        asset?.maintenanceIntervalDays,
        tenant?.maintenanceIntervalDays,
      );
      data.nextServiceDate = nextServiceDate;

      // Update asset next_service_date + buat reminder (INTI money loop)
      if (asset) {
        await tx.asset.update({
          where: { id: asset.id },
          data: { nextServiceDate },
        });
        const leadDays = tenant?.reminderLeadDays ?? REPEAT_DEFAULTS.reminderLeadDays;
        await tx.repeatReminder.upsert({
          where: { tenantId_assetId_dueDate: { tenantId, assetId: asset.id, dueDate: nextServiceDate } },
          create: { tenantId, assetId: asset.id, dueDate: nextServiceDate, leadTimeDays: leadDays, status: "QUEUED" },
          update: {},
        });
      }

      // Review request otomatis
      await tx.reviewRequest.create({
        data: { tenantId, jobId: job.id, channel: "WA", status: "REQUESTED" },
      });
    }

    const updated = await tx.jobOrder.update({ where: { id: job.id }, data });

    await tx.jobProgressEvent.create({
      data: {
        tenantId, jobId: job.id, fromStatus, toStatus, actorId,
        clientEventId: clientEventId ?? null, meta: (meta ?? {}) as never,
      },
    });

    return { updated, nextServiceDate };
  });

  return { job: result.updated, nextServiceDate: result.nextServiceDate, idempotentReplay: false };
}

/** Guard COMPLETED: semua item checklist required terisi + foto after bila diminta template. */
async function assertCompletionGuards(tenantId: string, jobId: string, serviceType: string) {
  const template = await prisma.checklistTemplate.findUnique({
    where: { tenantId_serviceType: { tenantId, serviceType: serviceType as never } },
  });
  if (!template) return; // tidak ada template = tidak ada guard

  const items = (template.items as { key: string; required: boolean; type: string }[]) ?? [];
  const requiredKeys = items.filter((i) => i.required).map((i) => i.key);
  if (requiredKeys.length === 0) return;

  const results = await prisma.checklistResult.findMany({ where: { tenantId, jobId } });
  const resultMap = new Map(results.map((r) => [r.itemKey, r]));

  const missing: string[] = [];
  for (const item of items.filter((i) => i.required)) {
    const r = resultMap.get(item.key);
    if (!r) { missing.push(item.key); continue; }
    if (item.type === "bool" && !r.checked) missing.push(item.key);
    if ((item.type === "number" || item.type === "text") && !r.value) missing.push(item.key);
    if (item.type === "photo" && !r.value) missing.push(item.key);
  }

  // foto after: cek JobPhoto bila template minta photo_after
  if (items.some((i) => i.key === "photo_after" && i.required)) {
    const hasAfter = await prisma.jobPhoto.count({ where: { tenantId, jobId, kind: "after" } });
    if (hasAfter === 0 && !resultMap.get("photo_after")?.value) {
      if (!missing.includes("photo_after")) missing.push("photo_after");
    }
  }

  if (missing.length > 0) {
    throw new TransitionError("GUARD_FAILED", "Checklist wajib belum lengkap", { missing });
  }
}
