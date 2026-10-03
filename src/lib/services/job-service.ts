/**
 * Job Service — orkestrasi transisi status NON-FINAL + efek money loop.
 * Keputusan FASE 5 (2026-10-03): PELENGSAIAN DIAKUJI HANYA oleh closeWorkSession.
 * transitionJob MENOLAK toStatus COMPLETED — tidak ada jalan pintas status final yang
 * menghasilkan job selesai tanpa dokumen/reminder/review (bukti live: 1 job COMPLETED
 * tanpa invoice berasal dari jalur paralel lama).
 */
import { prisma } from "@/lib/prisma";
import { canTransition } from "@/lib/domain/job-state-machine";
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
 * Transisi job NON-FINAL dengan validasi state machine.
 * Idempoten via clientEventId.
 * @throws TransitionError NOT_FOUND | ILLEGAL_TRANSITION | FORBIDDEN | GUARD_FAILED (alasan WAITING)
 */
export async function transitionJob(input: TransitionInput) {
  const { tenantId, jobId, toStatus, actorId, role, clientEventId, meta } = input;

  // FASE 5: penyelesaian = closeWorkSession (atomik dgn sesi+dokumen+efek).
  if (toStatus === "COMPLETED") {
    throw new TransitionError(
      "ILLEGAL_TRANSITION",
      "Penyelesaian hanya melalui Catat Pekerjaan (tutup sesi & terbitkan tagihan).",
    );
  }

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

  // Guard reason untuk WAITING
  if (toStatus === "WAITING" && !meta?.reason) {
    throw new TransitionError("GUARD_FAILED", "Alasan wajib diisi", { missing: ["reason"] });
  }

  // Eksekusi transisi dalam satu transaksi (tanpa blok COMPLETED — lihat catatan di atas)
  const result = await prisma.$transaction(async (tx) => {
    const fromStatus = job.status;
    const data: Record<string, unknown> = { status: toStatus };

    const updated = await tx.jobOrder.update({ where: { id: job.id }, data });

    await tx.jobProgressEvent.create({
      data: {
        tenantId, jobId: job.id, fromStatus, toStatus, actorId,
        clientEventId: clientEventId ?? null, meta: (meta ?? {}) as never,
      },
    });

    return { updated };
  });

  return { job: result.updated, nextServiceDate: null, idempotentReplay: false };
}
