"use server";

/**
 * Server action modul Pengingat Perawatan AC (FASE 2).
 * Menulis RepeatReminder -> DISMISSED (enum sudah ada, sebelumnya tak pernah ditulis
 * oleh siapa pun — terverifikasi 2026-10-03).
 *
 * SECURITY (mengikat):
 * - role OWNER/ADMIN saja (assertRole);
 * - tenantId SELALU dari sesi terverifikasi, tidak pernah dari input;
 * - updateMany atomik dengan filter status -> tidak bisa menutup pengingat yang
 *   sudah CONVERTED (sudah jadi pekerjaan) maupun milik tenant lain.
 */
import { revalidatePath } from "next/cache";
import { tryGetServerContext } from "@/lib/auth/context";
import { assertRole, AuthError } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";

export type ReminderActionResult = { ok: boolean; error?: string };

/** Status yang boleh ditutup manual oleh tenant (bukan CONVERTED/DISMISSED/EXPIRED). */
const CLOSABLE = ["QUEUED", "SENT"] as const;

export async function actionCloseReminder(reminderId: unknown): Promise<ReminderActionResult> {
  if (typeof reminderId !== "string" || reminderId.trim() === "") {
    return { ok: false, error: "Pengingat tidak valid" };
  }

  const ctx = await tryGetServerContext();
  if (!ctx?.tenantId) return { ok: false, error: "Sesi tidak valid" };

  try {
    assertRole(ctx.role, ["OWNER", "ADMIN"]);
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.message };
    throw e;
  }

  const updated = await prisma.repeatReminder.updateMany({
    where: { id: reminderId, tenantId: ctx.tenantId, status: { in: [...CLOSABLE] } },
    data: { status: "DISMISSED" },
  });

  if (updated.count === 0) {
    return { ok: false, error: "Pengingat tidak ditemukan, bukan milik Anda, atau sudah ditutup" };
  }

  revalidatePath("/app/pengingat");
  revalidatePath("/app");
  return { ok: true };
}

/**
 * Rencana A — tandai pengingat TERKIRIM MANUAL.
 * Tenant sudah mengirim pesan sendiri via WhatsApp (tombol "Kirim Pengingat" membuka
 * wa.me; aplikasi TIDAK bisa memverifikasi pengiriman itu sendiri), lalu mengonfirmasi.
 * Maka action ini MENCATAT KONFIRMASI TENANT — bukan klaim bahwa gateway mengirim.
 *
 * Dua kasus (data live: 84 kartu, hanya 5 yang punya RepeatReminder):
 * 1. reminderId ada -> tandai baris itu (guard status QUEUED/SENT, tenant-scoped).
 * 2. reminderId null (unit due yg belum pernah punya pengingat) -> BUAT baris dulu
 *    via unique key (tenantId, assetId, dueDate) lalu tandai. leadTimeDays diambil dari
 *    pengaturan tenant (konsisten dgn jalur job-service). upsert unique-key membuat
 *    panggilan ulang idempoten dan TIDAK PERNAH menyentuh baris tenant lain.
 *
 * Efek: status SENT + manualSentAt -> listReminderInbox memilih TERKIRIM_MANUAL.
 * sentAt TIDAK disentuh: kalau ada pesan otomatis, buktinya tetap MessageLog.
 */
export type MarkSentManualFallback = { assetId?: unknown; dueDate?: unknown };

async function markExisting(reminderId: string, tenantId: string): Promise<boolean> {
  const updated = await prisma.repeatReminder.updateMany({
    where: { id: reminderId, tenantId, status: { in: [...CLOSABLE] } },
    data: { status: "SENT", manualSentAt: new Date() },
  });
  return updated.count > 0;
}

export async function actionMarkReminderSentManual(
  reminderId: unknown,
  fallback?: MarkSentManualFallback,
): Promise<ReminderActionResult> {
  const hasId = typeof reminderId === "string" && reminderId.trim() !== "";
  const ctx = await tryGetServerContext();
  if (!ctx?.tenantId) return { ok: false, error: "Sesi tidak valid" };

  let assetId: string | null = null;
  let dueDate: Date | null = null;
  if (!hasId) {
    // Kasus unit tanpa baris pengingat: wajib ada sasaran yang tervalidasi.
    if (typeof fallback?.assetId !== "string" || fallback.assetId.trim() === "") {
      return { ok: false, error: "Pengingat tidak valid" };
    }
    const raw = fallback.dueDate;
    const due = raw instanceof Date ? raw : typeof raw === "string" ? new Date(raw) : null;
    if (!due || Number.isNaN(due.getTime())) {
      return { ok: false, error: "Jadwal servis tidak valid" };
    }
    assetId = fallback.assetId.trim();
    dueDate = due;
  }

  try {
    assertRole(ctx.role, ["OWNER", "ADMIN"]);
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.message };
    throw e;
  }

  if (hasId) {
    if (!(await markExisting(reminderId as string, ctx.tenantId))) {
      return { ok: false, error: "Pengingat tidak ditemukan, bukan milik Anda, atau sudah ditutup" };
    }
  } else {
    // Cari dulu (unique key tenant+asset+due) — kalau ada & masih QUEUED/SENT, tandai;
    // kalau tertutup (DISMISSED/CONVERTED/EXPIRED), tolak tanpa menimpa.
    const existing = await prisma.repeatReminder.findUnique({
      where: { tenantId_assetId_dueDate: { tenantId: ctx.tenantId, assetId: assetId!, dueDate: dueDate! } },
      select: { id: true, status: true },
    });
    if (existing) {
      if (!(["QUEUED", "SENT"] as string[]).includes(existing.status)) {
        return { ok: false, error: "Pengingat sudah ditutup atau dikonversi" };
      }
      if (!(await markExisting(existing.id, ctx.tenantId))) {
        return { ok: false, error: "Pengingat tidak ditemukan, bukan milik Anda, atau sudah ditutup" };
      }
    } else {
      const tenant = await prisma.tenant.findUnique({
        where: { id: ctx.tenantId },
        select: { reminderLeadDays: true },
      });
      if (!tenant) return { ok: false, error: "Usaha tidak ditemukan" };
      try {
        await prisma.repeatReminder.create({
          data: {
            tenantId: ctx.tenantId,
            assetId: assetId!,
            dueDate: dueDate!,
            leadTimeDays: tenant.reminderLeadDays,
            status: "SENT",
            manualSentAt: new Date(),
          },
        });
      } catch (err) {
        // Unique race (cron membuat baris di antara findUnique & create) -> ulangi jalur tandai.
        const raced = await prisma.repeatReminder.findUnique({
          where: { tenantId_assetId_dueDate: { tenantId: ctx.tenantId, assetId: assetId!, dueDate: dueDate! } },
          select: { id: true },
        });
        if (!raced || !(await markExisting(raced.id, ctx.tenantId))) {
          console.error("[markSentManual] gagal:", err);
          return { ok: false, error: "Gagal menandai pengingat" };
        }
      }
    }
  }

  revalidatePath("/app/pengingat");
  revalidatePath("/app");
  return { ok: true };
}
