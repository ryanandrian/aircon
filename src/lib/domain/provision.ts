/**
 * Provisioning tenant baru: buat WA templates default.
 *
 * CHECKLIST = OPT-IN (keputusan owner 2026-09-08): tenant baru TIDAK lagi diseed checklist
 * otomatis. Checklist servis kosong secara default; admin tenant membuatnya sendiri per layanan
 * bila memang ingin diterapkan (menghindari checklist wajib yang tak relevan di lapangan).
 * Contoh item bawaan tetap tersedia di `DEFAULT_CHECKLISTS` sebagai "template contoh" yang bisa
 * dipakai admin dari layar Checklist — bukan dipaksakan saat provisioning.
 */
import { PrismaClient } from "@prisma/client";
import { DEFAULT_WA_TEMPLATES } from "@/lib/domain/defaults";

export async function seedTenantDefaults(prisma: PrismaClient, tenantId: string) {
  // WA templates (tetap diseed — dibutuhkan alur pengingat/otomasi sejak hari pertama).
  const waOps = Object.entries(DEFAULT_WA_TEMPLATES).map(([key, body]) =>
    prisma.messageTemplate.upsert({
      where: { tenantId_key: { tenantId, key } },
      create: { tenantId, key, body },
      update: { body },
    }),
  );

  await prisma.$transaction(waOps);
}
