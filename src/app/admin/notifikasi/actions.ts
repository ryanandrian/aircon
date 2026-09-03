"use server";

import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { notifyPlatform } from "@/lib/services/platform-notification-service";
import { dispatchPlatformNotifications } from "@/lib/services/platform-notification-dispatch";
import { runPlatformNotifyCycle } from "@/lib/services/platform-notify-cycle";
import {
  gatewayInitSession, gatewaySessionStatus, gatewayLogoutSession,
} from "@/lib/wa/gateway-relay";
import type { PlatformTemplateKey } from "@/lib/domain/platform-templates";
import { revalidatePath } from "next/cache";

/** externalId sesi WA platform Lumite (1 nomor, lintas SaaS). */
const LUMITE_SESSION = "lumite-platform";

type Result = { ok: boolean; error?: string; info?: string };

/** Kirim event notifikasi platform manual ke 1 tenant (uji / pengumuman terarah). */
export async function actionSendPlatformNotif(
  tenantId: string, templateKey: PlatformTemplateKey, channel: "WA" | "EMAIL",
): Promise<Result> {
  try {
    await requirePlatformAdmin();
    if (!tenantId) return { ok: false, error: "Tenant wajib dipilih" };
    const r = await notifyPlatform({ tenantId, templateKey, channels: [channel] });
    if (r.created === 0) return { ok: false, error: r.skipped.join("; ") || "Tak ada yang diantre" };
    // Langsung dispatch supaya admin lihat hasil seketika.
    const d = await dispatchPlatformNotifications();
    revalidatePath("/admin/notifikasi");
    return { ok: true, info: `Antre ${r.created}, terkirim ${d.sent}, gagal ${d.failed}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal" };
  }
}

/** Jalankan siklus notif + dispatch sekarang (tak menunggu cron harian). */
export async function actionRunPlatformNotifyNow(): Promise<Result> {
  try {
    await requirePlatformAdmin();
    const cycle = await runPlatformNotifyCycle();
    const d = await dispatchPlatformNotifications();
    revalidatePath("/admin/notifikasi");
    return { ok: true, info: `Event: due ${cycle.due}, overdue ${cycle.overdue}, trial ${cycle.trialEnding}. Kirim: ${d.sent} ok, ${d.failed} gagal, ${d.skipped} ditahan.` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal" };
  }
}

/** Dispatch antrean tertahan sekarang (mis. sesudah SMTP/WA platform dikonfigurasi). */
export async function actionDispatchPlatformNow(): Promise<Result> {
  try {
    await requirePlatformAdmin();
    const d = await dispatchPlatformNotifications();
    revalidatePath("/admin/notifikasi");
    return { ok: true, info: `Terkirim ${d.sent}, gagal ${d.failed}, ditahan ${d.skipped}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal" };
  }
}

/** Mulai/bangunkan sesi WA Lumite (nomor platform) → balikkan QR / ready. */
export async function actionLumiteWaInit(): Promise<{ ok: boolean; qr?: string | null; ready?: boolean; error?: string }> {
  try {
    await requirePlatformAdmin();
    return await gatewayInitSession(LUMITE_SESSION);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal" };
  }
}

/** Status sesi WA Lumite (untuk polling QR → ready). */
export async function actionLumiteWaStatus(): Promise<{ ok: boolean; exists?: boolean; ready?: boolean; qr?: string | null; error?: string }> {
  try {
    await requirePlatformAdmin();
    return await gatewaySessionStatus(LUMITE_SESSION);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal" };
  }
}

/** Putuskan sesi WA Lumite. */
export async function actionLumiteWaLogout(): Promise<Result> {
  try {
    await requirePlatformAdmin();
    const r = await gatewayLogoutSession(LUMITE_SESSION);
    return r.ok ? { ok: true } : { ok: false, error: r.error };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal" };
  }
}
