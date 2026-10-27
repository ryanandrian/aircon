/**
 * Template Center platform — copy notifikasi yang bisa diedit admin.
 * Sumber copy aktif: baris `PlatformTemplate` bila ada; selain itu default kode.
 * Eligibilitas/policy TIDAK diatur di sini (lihat platform-templates.ts).
 */
import "server-only";
import { prisma } from "@/lib/prisma";
import {
  PLATFORM_TEMPLATES,
  validateTemplateCopy,
  type PlatformTemplateKey,
  type TemplateCopy,
} from "@/lib/domain/platform-templates";

export interface ActiveTemplate extends TemplateCopy {
  key: PlatformTemplateKey;
  version: number;
  isDefault: boolean;
}

/** Copy aktif satu key (DB bila ada, selain itu default kode). */
export async function getActiveTemplate(key: PlatformTemplateKey): Promise<ActiveTemplate> {
  const row = await prisma.platformTemplate.findUnique({ where: { key } });
  if (row) return { key, subject: row.subject, body: row.body, version: row.version, isDefault: false };
  const d = PLATFORM_TEMPLATES[key];
  return { key, subject: d.subject, body: d.body, version: 0, isDefault: true };
}

/** Semua copy aktif (untuk editor). */
export async function listActiveTemplates(): Promise<ActiveTemplate[]> {
  const keys = Object.keys(PLATFORM_TEMPLATES) as PlatformTemplateKey[];
  return Promise.all(keys.map((k) => getActiveTemplate(k)));
}

export type SaveTemplateResult =
  | { ok: true; version: number }
  | { ok: false; errors: string[] };

/**
 * Simpan copy baru. Validasi ketat (placeholder dikenal + requiredVars).
 * Setiap simpan menaikkan `version`. Antrean tidak terpengaruh: row PlatformNotification
 * menyimpan body-nya sendiri (snapshot saat enqueue).
 */
export async function saveTemplate(
  key: PlatformTemplateKey,
  copy: TemplateCopy,
  actorEmail: string,
): Promise<SaveTemplateResult> {
  if (!(key in PLATFORM_TEMPLATES)) return { ok: false, errors: ["Template tidak dikenal"] };
  const check = validateTemplateCopy(key, copy);
  if (!check.ok) return { ok: false, errors: check.errors };
  const subject = PLATFORM_TEMPLATES[key].subject ? copy.subject : "";
  const row = await prisma.platformTemplate.upsert({
    where: { key },
    create: { key, subject, body: copy.body, version: 1, updatedBy: actorEmail },
    update: { subject, body: copy.body, version: { increment: 1 }, updatedBy: actorEmail },
  });
  await prisma.platformAuditLog.create({
    data: {
      actor: actorEmail,
      action: "PLATFORM_TEMPLATE_SAVE",
      target: `platform-template:${key}`,
      metadata: { version: row.version },
    },
  });
  return { ok: true, version: row.version };
}

/** Kembalikan ke default kode: hapus baris override. */
export async function resetTemplate(key: PlatformTemplateKey, actorEmail: string): Promise<void> {
  await prisma.platformTemplate.deleteMany({ where: { key } });
  await prisma.platformAuditLog.create({
    data: { actor: actorEmail, action: "PLATFORM_TEMPLATE_RESET", target: `platform-template:${key}`, metadata: {} },
  });
}
