"use server";

import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { prisma } from "@/lib/prisma";
import { notifyPlatform } from "@/lib/services/platform-notification-service";
import { dispatchPlatformNotifications } from "@/lib/services/platform-notification-dispatch";
import { runPlatformNotifyCycle } from "@/lib/services/platform-notify-cycle";
import {
  gatewayInitSession, gatewaySessionStatus, gatewayLogoutSession,
} from "@/lib/wa/gateway-relay";
import { PARTNER_TEMPLATE_KEYS, type PlatformTemplateKey } from "@/lib/domain/platform-templates";
import { saveTemplate, resetTemplate } from "@/lib/services/platform-template-service";
import { replayPlatformNotification } from "@/lib/services/platform-notification-admin";
import { rollbackTemplate } from "@/lib/services/platform-template-service";
import { isNotifySendEnabled, setNotifySendEnabled, isWaSendEnabled, setWaSendEnabled } from "@/lib/services/infra-config-service";
import { runNotificationReconcile, type ReconcileReport } from "@/lib/services/notify-reconcile-service";
import { revalidatePath } from "next/cache";

/** externalId sesi WA platform Lumite (1 nomor, lintas SaaS). */
const LUMITE_SESSION = "lumite-platform";

type Result = { ok: boolean; error?: string; info?: string; errors?: string[] };

/** Template khusus event: hanya diproduksi dari transaksi terkait, tidak boleh dikirim manual tanpa konteks. */
const EVENT_ONLY_TEMPLATE_KEYS: readonly string[] = [
  "subscription_activated",
  "payment_failed",
  "payment_expired",
  // Butuh `nama` pemesan & dikirim ke inbox in-app tenant (bukan antrean platform).
  "booking_inapp",
  // Template mitra (F4): penerima agen/reseller, terbit dari event lifecycle
  // mitra (registrasi, approval, komisi, payout). Tak bisa dikirim manual.
  ...PARTNER_TEMPLATE_KEYS,
];

/** Kirim event notifikasi platform manual ke 1 tenant (uji / pengumuman terarah). */
export async function actionSendPlatformNotif(
  tenantId: string, templateKey: PlatformTemplateKey, channel: "WA" | "EMAIL",
): Promise<Result> {
  try {
    await requirePlatformAdmin();
    if (!tenantId) return { ok: false, error: "Tenant wajib dipilih" };
    if (EVENT_ONLY_TEMPLATE_KEYS.includes(templateKey)) {
      return {
        ok: false,
        error: "Template ini hanya terbit otomatis dari transaksi terkait — pilih template lain untuk kirim manual.",
      };
    }
    const r = await notifyPlatform({ tenantId, templateKey, channels: [channel] });
    if (r.created === 0) return { ok: false, error: r.skipped.join("; ") || "Tak ada yang diantre" };
    // Dispatch TERARAH: hanya baris yang barusan dibuat (G20). Versi lama
    // menyedot seluruh antrean global sehingga satu klik ikut mengirim antrean
    // milik tenant lain.
    const d = await dispatchPlatformNotifications(r.ids.length, r.ids);
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
    return { ok: true, info: `Event: due ${cycle.due}, overdue ${cycle.overdue}, paket gratis dilewati ${cycle.skippedFreePlan}. Kirim: ${d.sent} ok, ${d.failed} gagal, ${d.skipped} ditahan.` };
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
    return { ok: true, info: `Terkirim ${d.sent}, gagal ${d.failed}, ditahan ${d.skipped}${d.stale ? `, hasil tak pasti (UNKNOWN) ${d.stale}` : ""}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal" };
  }
}

/** Kill switch pengiriman platform (G30): admin-only, audit-logged. */
export async function actionSetNotifySendEnabled(enabled: boolean): Promise<Result> {
  try {
    const admin = await requirePlatformAdmin();
    await setNotifySendEnabled(enabled, admin.email);
    revalidatePath("/admin/notifikasi");
    return { ok: true, info: enabled ? "Pengiriman platform DIAKTIFKAN" : "Pengiriman platform DITAHAN (antrean menunggu)" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal" };
  }
}

/**
 * Jalankan rekonsiliasi antrean notifikasi (G29): READ-ONLY, admin-only.
 * Menemukan pesan yang hilang/ditahan/tak pasti & tenant menunggak tanpa pengingat.
 */
export async function actionReconcileNotifications(): Promise<Result & { report?: ReconcileReport }> {
  try {
    const admin = await requirePlatformAdmin();
    const report = await runNotificationReconcile();
    await prisma.platformAuditLog.create({
      data: {
        actor: admin.email,
        action: "NOTIFY_RECONCILE",
        target: "antrean-notifikasi",
        metadata: { findings: report.findings.length, ok: report.ok },
      },
    });
    revalidatePath("/admin/notifikasi");
    return { ok: true, info: report.ok ? "Tidak ada temuan — antrean sehat" : `${report.findings.length} temuan perlu ditinjau`, report };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal" };
  }
}

/** Kill switch WA tenant -> pelanggan (G30): admin-only, audit-logged. */
export async function actionSetWaSendEnabled(enabled: boolean): Promise<Result> {
  try {
    const admin = await requirePlatformAdmin();
    await setWaSendEnabled(enabled, admin.email);
    revalidatePath("/admin/notifikasi");
    return { ok: true, info: enabled ? "WA tenant ke pelanggan DIAKTIFKAN" : "WA tenant ke pelanggan DITAHAN (antrean tetap menunggu)" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal" };
  }
}

/** Rollback copy template ke versi lama (F5): admin-only, validasi + audit log. */
export async function actionRollbackPlatformTemplate(key: PlatformTemplateKey, targetVersion: number): Promise<Result> {
  try {
    const admin = await requirePlatformAdmin();
    const r = await rollbackTemplate(key, targetVersion, admin.email);
    if (!r.ok) return { ok: false, error: r.errors[0], errors: r.errors };
    revalidatePath("/admin/notifikasi");
    return { ok: true, info: `Dikembalikan ke versi ${targetVersion} (sekarang versi ${r.version})` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal" };
  }
}

/** Replay manual 1 notifikasi UNKNOWN/FAILED (G30): admin-only + audit log. */
export async function actionReplayPlatformNotification(id: string): Promise<Result> {
  try {
    const admin = await requirePlatformAdmin();
    const r = await replayPlatformNotification(id, admin.email);
    if (!r.ok) return { ok: false, error: r.error };
    // Dispatch tertunda → admin lihat hasil seketika (tetap terarah ke baris ini).
    const d = await dispatchPlatformNotifications(1, [id]);
    revalidatePath("/admin/notifikasi");
    return { ok: true, info: `Di-antre ulang; terkirim ${d.sent}, gagal ${d.failed}${d.skipped ? `, ditahan ${d.skipped}` : ""}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal" };
  }
}

/** Simpan copy template platform (admin-only). Validasi di service. */
export async function actionSavePlatformTemplate(
  key: PlatformTemplateKey, subject: string, body: string,
): Promise<Result & { errors?: string[] }> {
  try {
    const admin = await requirePlatformAdmin();
    const r = await saveTemplate(key, { subject, body }, admin.email);
    if (!r.ok) return { ok: false, error: r.errors[0], errors: r.errors };
    revalidatePath("/admin/notifikasi");
    return { ok: true, info: `Tersimpan (versi ${r.version})` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal" };
  }
}

/** Kembalikan copy template ke default kode (admin-only). */
export async function actionResetPlatformTemplate(key: PlatformTemplateKey): Promise<Result> {
  try {
    const admin = await requirePlatformAdmin();
    await resetTemplate(key, admin.email);
    revalidatePath("/admin/notifikasi");
    return { ok: true, info: "Dikembalikan ke default" };
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
export async function actionLumiteWaStatus(): Promise<{ ok: boolean; exists?: boolean; ready?: boolean; qr?: string | null; phone?: string | null; authenticating?: boolean; error?: string }> {
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
