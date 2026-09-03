"use server";

import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { notifyPlatform } from "@/lib/services/platform-notification-service";
import { dispatchPlatformNotifications } from "@/lib/services/platform-notification-dispatch";
import { runPlatformNotifyCycle } from "@/lib/services/platform-notify-cycle";
import type { PlatformTemplateKey } from "@/lib/domain/platform-templates";
import { revalidatePath } from "next/cache";

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
