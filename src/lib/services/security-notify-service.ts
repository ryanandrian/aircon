/**
 * Notifikasi KEAMANAN untuk owner tenant (G16).
 *
 * Event: login baru staf, PIN diubah/reset, staf mengaktifkan akun.
 * Kanal: in-app (TenantNotification) + WA (MessageLog QUEUED via sesi tenant)
 * — keduanya idempoten per event, kegagalan satu kanal tak memengaruhi lain.
 *
 * PRINSIP G16: aktivitas sensitif akun TIDAK boleh diam-diam. Owner harus tahu
 * bila akun timnya dimasuki/diubah — termasuk saat BUKAN dia yang melakukannya.
 *
 * TIDAK termasuk: percobaan login gagal (rate-limit sudah menangani itu),
 * informasi credential, alamat IP internal.
 */
import "server-only";
import { prisma } from "@/lib/prisma";
import { getActiveTemplate } from "@/lib/services/platform-template-service";
import { renderPlatformTemplate, type PlatformTemplateKey } from "@/lib/domain/platform-templates";
import { normalizePhone } from "@/lib/wa/gateway";

export type SecurityEventType = "new_login" | "pin_reset" | "staff_activated";

const TEMPLATE_BY_EVENT: Record<SecurityEventType, PlatformTemplateKey> = {
  new_login: "security_new_login",
  pin_reset: "security_pin_reset",
  staff_activated: "security_staff_activated",
};

const TYPE_CODE: Record<SecurityEventType, string> = {
  new_login: "SECURITY_NEW_LOGIN",
  pin_reset: "SECURITY_PIN_RESET",
  staff_activated: "SECURITY_STAFF_ACTIVATED",
};

/**
 * Catat event keamanan ke owner tenant.
 *
 * Granularitas `dedupeKey`:
 *  - `new_login`: per-JAM (login berulang dalam jam sama = satu event — cegah
 *    spam tanpa kolom `device`);
 *  - `pin_reset` / `staff_activated`: per-kejadian (timestamp 36-base).
 */
export async function notifySecurityEvent(params: {
  tenantId: string;
  /** Nama staf yang beraktivitas. */
  actorName: string;
  type: SecurityEventType;
}): Promise<{ inapp: boolean; waQueued: boolean }> {
  const template = TEMPLATE_BY_EVENT[params.type];
  const tenant = await prisma.tenant.findUnique({
    where: { id: params.tenantId },
    select: { name: true, waVerifiedPhone: true, phone: true },
  });
  if (!tenant) return { inapp: false, waQueued: false };

  const active = await getActiveTemplate(template);
  const rendered = renderPlatformTemplate(template, {
    tenant: tenant.name,
    nama: params.actorName,
  }, { subject: active.subject, body: active.body });

  const stamps =
    params.type === "new_login"
      ? new Date().toISOString().slice(0, 13) // per-jam: cegah spam login rapat
      : Date.now().toString(36);
  const out = { inapp: false, waQueued: false };

  // ── In-app (TenantNotification) ──────────────────────────────────────────
  try {
    await prisma.tenantNotification.create({
      data: {
        tenantId: params.tenantId,
        type: TYPE_CODE[params.type],
        title: rendered.subject,
        body: rendered.body,
        entityId: params.tenantId,
        dedupeKey: `sec:${params.type}:${stamps}`,
      },
    });
    out.inapp = true;
  } catch (e) {
    if (e && typeof e === "object" && (e as { code?: string }).code === "P2002") {
      // sudah ada → idempoten
    } else {
      console.error("[security-notify] in-app gagal:", e instanceof Error ? e.message : e);
    }
  }

  // ── WA ke owner (antrean MessageLog tenant) ──────────────────────────────
  const phone = normalizePhone(tenant.phone || "");
  if (phone && tenant.waVerifiedPhone) {
    try {
      await prisma.messageLog.create({
        data: {
          tenantId: params.tenantId,
          channel: "WA",
          direction: "OUTBOUND",
          status: "QUEUED",
          templateKey: TYPE_CODE[params.type],
          toPhone: phone,
          body: rendered.body,
        },
      });
      out.waQueued = true;
    } catch (e) {
      console.error("[security-notify] antrean WA gagal:", e instanceof Error ? e.message : e);
    }
  }

  return out;
}

/**
 * Login staf (dipanggil setelah `loginTechnician` sukses). Dedupe per-jam:
 * satu owner tidak di-spam oleh login tiap menit, tetapi tetap terlihat.
 */
export async function notifySecurityNewLogin(params: {
  tenantId: string;
  actorName: string;
}): Promise<{ inapp: boolean; waQueued: boolean }> {
  try {
    return await notifySecurityEvent({ ...params, type: "new_login" });
  } catch (e) {
    console.error("[security-notify] login gagal:", e instanceof Error ? e.message : e);
    return { inapp: false, waQueued: false };
  }
}

/**
 * PIN anggota tim diubah/reset (owner melakukan reset ATAU staf mengaktifkan
 * undangan). Dipanggil SETELAH perubahan commit di DB.
 */
export async function notifySecurityPinChanged(params: {
  tenantId: string;
  actorName: string;
}): Promise<{ inapp: boolean; waQueued: boolean }> {
  try {
    return await notifySecurityEvent({ ...params, type: "pin_reset" });
  } catch (e) {
    console.error("[security-notify] pin reset gagal:", e instanceof Error ? e.message : e);
    return { inapp: false, waQueued: false };
  }
}