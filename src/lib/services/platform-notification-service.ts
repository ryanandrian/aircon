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
import { renderTemplate, normalizePhone } from "@/lib/wa/gateway";
import { PLATFORM_TEMPLATES, type PlatformTemplateKey } from "@/lib/domain/platform-templates";

export { PLATFORM_TEMPLATES };
export type { PlatformTemplateKey };

export interface NotifyInput {
  tenantId: string;
  templateKey: PlatformTemplateKey;
  channels?: ("WA" | "EMAIL")[]; // default: keduanya bila tersedia
  vars?: Record<string, string>;
  dedupeKey?: string;            // idempotensi; bila kosong → tak dedupe
}

/**
 * Antre notifikasi platform ke tenant. Menulis PlatformNotification(QUEUED) per channel.
 * Return jumlah baris yang dibuat (0 bila dedupe menahan / penerima tak tersedia).
 */
export async function notifyPlatform(input: NotifyInput): Promise<{ created: number; skipped: string[] }> {
  const { tenantId, templateKey } = input;
  const tpl = PLATFORM_TEMPLATES[templateKey];
  const skipped: string[] = [];
  if (!tpl) return { created: 0, skipped: [`template tak dikenal: ${templateKey}`] };

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true, phone: true } });
  if (!tenant) return { created: 0, skipped: ["tenant tak ditemukan"] };
  const owner = await prisma.user.findFirst({
    where: { tenantId, role: "OWNER" }, select: { email: true, phone: true },
  });

  const vars = { app: "Aircon", tenant: tenant.name, ...(input.vars ?? {}) };
  const subject = renderTemplate(tpl.subject, vars);
  const body = renderTemplate(tpl.body, vars);
  const channels = input.channels ?? ["WA", "EMAIL"];

  let created = 0;
  for (const channel of channels) {
    const toAddress = channel === "WA"
      ? normalizePhone(tenant.phone || owner?.phone || "")
      : (owner?.email ?? "");
    if (!toAddress) { skipped.push(`${channel}: penerima kosong`); continue; }

    const dedupeKey = input.dedupeKey ? `${input.dedupeKey}:${channel}` : null;
    try {
      await prisma.platformNotification.create({
        data: { tenantId, channel, templateKey, toAddress, subject: channel === "EMAIL" ? subject : null, body, dedupeKey },
      });
      created += 1;
    } catch (e) {
      // Unique dedupeKey → sudah pernah diantre → aman diabaikan (idempoten).
      if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2002") {
        skipped.push(`${channel}: dedupe (sudah diantre)`);
      } else {
        skipped.push(`${channel}: ${e instanceof Error ? e.message : "gagal"}`);
      }
    }
  }
  return { created, skipped };
}
