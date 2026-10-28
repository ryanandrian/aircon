/**
 * Platform Notification Engine (Lumite → tenant) — AUTOPILOT lintas-SaaS.
 *
 * TERPISAH TOTAL dari MessageLog (tenant → pelanggan). Alur:
 *   event (billing/trial/wa-putus/welcome) → notifyPlatform() tulis PlatformNotification(QUEUED, dedupeKey)
 *   → dispatchPlatformNotifications() kirim via WA (sesi lumite-platform) / EMAIL (SMTP) → SENT/FAILED.
 *
 * Idempoten: dedupeKey unik cegah kirim ganda utk event sama (mis. tagihan hari yang sama).
 * Channel-agnostic: WA + EMAIL. SaaS lain reuse pola ini (ganti templat + event).
 */
import "server-only";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/wa/gateway";
import type { TenantPlan } from "@prisma/client";
import {
  PLATFORM_TEMPLATES,
  renderPlatformTemplate,
  isPartnerTemplate,
  type PlatformTemplateKey,
} from "@/lib/domain/platform-templates";
import { getActiveTemplate } from "@/lib/services/platform-template-service";

export { PLATFORM_TEMPLATES };
export type { PlatformTemplateKey };

export interface NotifyInput {
  tenantId: string;
  /** null = welcome: dipilih otomatis berdasar PlanConfig.autoReminder. */
  templateKey: PlatformTemplateKey | null;
  channels?: ("WA" | "EMAIL")[]; // default: keduanya bila tersedia
  vars?: Record<string, string>;
  dedupeKey?: string;            // idempotensi; bila kosong → tak dedupe
}

const appBase = () =>
  (process.env.NEXT_PUBLIC_APP_URL || "https://app.airconet.id").replace(/\/+$/, "");

/**
 * Pilih template sambutan dari PLAN (policy), bukan dari copy:
 * paket autoReminder=false → varian manual (tanpa CTA sambung WA / tanpa klaim otomatis).
 * Kunci disimpan pada dedupeKey `welcome:<tenantId>` agar tetap sekali seumur hidup
 * walaupun nama template berubah.
 */
export async function resolveWelcomeTemplateKey(tenantId: string): Promise<PlatformTemplateKey> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { plan: true },
  });
  if (!tenant) throw new Error(`tenant ${tenantId} tidak ditemukan saat memilih template welcome`);
  const planConfig = await prisma.planConfig.findUnique({ where: { plan: tenant.plan } });
  return planConfig?.autoReminder === true ? "welcome_paid" : "welcome_basic";
}

/** Apakah paket tenant diizinkan otomasi WhatsApp (CTA sambung WA & klaim otomatis). */
export async function isAutoReminderPlan(plan: TenantPlan): Promise<boolean> {
  const planConfig = await prisma.planConfig.findUnique({ where: { plan } });
  if (!planConfig) return false;
  return planConfig.autoReminder === true;
}

/**
 * Antre notifikasi platform ke tenant. Menulis PlatformNotification(QUEUED) per channel.
 * Return jumlah baris yang dibuat (0 bila dedupe menahan / penerima tak tersedia).
 */
export async function notifyPlatform(input: NotifyInput): Promise<{ created: number; skipped: string[]; ids: string[]; suppressed?: number }> {
  const { tenantId } = input;
  const skipped: string[] = [];
  /** Baris yang DITAHAN karena penerima kosong (G28) — tercatat, bukan hilang. */
  let suppressed = 0;
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true, phone: true, plan: true } });
  if (!tenant) return { created: 0, skipped: ["tenant tak ditemukan"], ids: [] };
  const owner = await prisma.user.findFirst({
    where: { tenantId, role: "OWNER" }, select: { email: true, phone: true },
  });

  const templateKey = input.templateKey ?? (await resolveWelcomeTemplateKey(tenantId));
  const tpl = PLATFORM_TEMPLATES[templateKey];
  if (!tpl) return { created: 0, skipped: [`template tak dikenal: ${templateKey}`], ids: [] };
  // Template MITRA (F4) hanya boleh dirender oleh partner-notification-service:
  // penerima bukan tenant, jadi notifyPlatform tak boleh menaruhnya.
  if (isPartnerTemplate(templateKey)) {
    return { created: 0, skipped: ["template mitra hanya boleh dikirim lewat service notifikasi mitra"], ids: [] };
  }
  const planConfig = await prisma.planConfig.findUnique({ where: { plan: tenant.plan } });
  const langganan = `${appBase()}/app/langganan`;
  const pengaturan = `${appBase()}/app/pengaturan`;
  // Hanya template TENANT. Template mitra ditolak lebih dulu (lihat guard),
  // jadi tak pernah butuh link di sini.
  const DEFAULT_LINK: Partial<Record<PlatformTemplateKey, string>> = {
    welcome_basic: langganan,
    welcome_paid: pengaturan,
    subscription_activated: pengaturan,
    subscription_due: langganan,
    subscription_overdue: langganan,
    // Gagal/kedaluwarsa: tautan yang masih berlaku = halaman Langganan
    // (menampilkan riwayat transaksi + tombol Bayar Lagi untuk order tsb).
    payment_failed: langganan,
    payment_expired: langganan,
    wa_connected: pengaturan,
    wa_disconnected: pengaturan,
    booking_inapp: pengaturan,
  };
  const vars = {
    app: "Aircon",
    tenant: tenant.name,
    paket: planConfig?.displayName ?? tenant.plan,
    link: DEFAULT_LINK[templateKey] ?? langganan,
    ...(input.vars ?? {}),
  };
  let rendered: { subject: string; body: string };
  try {
    const active = await getActiveTemplate(templateKey);
    rendered = renderPlatformTemplate(templateKey, vars, { subject: active.subject, body: active.body });
  } catch (error) {
    const message = error instanceof Error ? error.message : "template gagal dirender";
    console.error(`[platform-notification] render gagal tenant=${tenantId} template=${templateKey}: ${message}`);
    return { created: 0, skipped: [message], ids: [] };
  }
  const { subject, body } = rendered;
  const channels = input.channels ?? ["WA", "EMAIL"];

  let created = 0;
  const ids: string[] = [];
  for (const channel of channels) {
    const toAddress = channel === "WA"
      ? normalizePhone(tenant.phone || owner?.phone || "")
      : (owner?.email ?? "");
    if (!toAddress) {
      // G28: penerima kosong tak boleh hilang diam-diam. Catat sebagai baris
      // SUPPRESSED (bukan FAILED: tak ada attempt, tak akan dikirim ulang,
      // operator bisa melihat & menindaklanjuti).
      const reason = channel === "WA"
        ? "nomor WhatsApp penerima kosong"
        : "email penerima kosong";
      try {
        const row = await prisma.platformNotification.create({
          data: {
            tenantId,
            channel,
            templateKey,
            toAddress: channel === "WA" ? "" : "",
            subject: channel === "EMAIL" ? subject : null,
            body,
            status: "SUPPRESSED",
            suppressedReason: reason,
            dedupeKey: input.dedupeKey ? `${input.dedupeKey}:${channel}` : null,
          },
        });
        ids.push(row.id);
        suppressed += 1;
      } catch (e) {
        if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2002") {
          skipped.push(`${channel}: dedupe (sudah tercatat)`);
        } else {
          skipped.push(`${channel}: ${e instanceof Error ? e.message : "gagal"}`);
        }
      }
      skipped.push(`${channel}: penerima kosong (dicatat SUPPRESSED)`);
      continue;
    }

    const dedupeKey = input.dedupeKey ? `${input.dedupeKey}:${channel}` : null;
    try {
      const row = await prisma.platformNotification.create({
        data: { tenantId, channel, templateKey, toAddress, subject: channel === "EMAIL" ? subject : null, body, dedupeKey },
      });
      created += 1;
      ids.push(row.id);
    } catch (e) {
      // Unique dedupeKey → sudah pernah diantre → aman diabaikan (idempoten).
      if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2002") {
        skipped.push(`${channel}: dedupe (sudah diantre)`);
      } else {
        skipped.push(`${channel}: ${e instanceof Error ? e.message : "gagal"}`);
      }
    }
  }
  return { created, skipped, ids, suppressed };
}
