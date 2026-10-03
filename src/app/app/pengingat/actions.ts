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
 * Efek: status SENT + manualSentAt terisi -> listReminderInbox memilih
 * TERKIRIM_MANUAL (fallback setelah pencarian bukti MessageLog).
 * sentAt TIDAK disentuh: kalau memang ada pesan otomatis, buktinya tetap MessageLog.
 * Syarat: reminder masih QUEUED/SENT (bukan CONVERTED/DISMISSED/EXPIRED) — sama dgn
 * actionCloseReminder, agar pengingat terkonversi/tertutup tak bisa dimanipulasi.
 */
export async function actionMarkReminderSentManual(reminderId: unknown): Promise<ReminderActionResult> {
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
    data: { status: "SENT", manualSentAt: new Date() },
  });

  if (updated.count === 0) {
    return { ok: false, error: "Pengingat tidak ditemukan, bukan milik Anda, atau sudah ditutup" };
  }

  revalidatePath("/app/pengingat");
  revalidatePath("/app");
  return { ok: true };
}
