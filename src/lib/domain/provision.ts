/**
 * Provisioning tenant baru: buat checklist templates + WA templates default.
 * Dipakai oleh onboarding (setelah owner login) dan seed script.
 */
import { PrismaClient } from "@prisma/client";
import { DEFAULT_CHECKLISTS, DEFAULT_WA_TEMPLATES } from "@/lib/domain/defaults";

export async function seedTenantDefaults(prisma: PrismaClient, tenantId: string) {
  // Checklist per service type
  const checklistOps = Object.entries(DEFAULT_CHECKLISTS).map(([serviceType, items]) =>
    prisma.checklistTemplate.upsert({
      where: { tenantId_serviceType: { tenantId, serviceType: serviceType as never } },
      create: { tenantId, serviceType: serviceType as never, items: items as never },
      update: { items: items as never },
    }),
  );

  // WA templates
  const waOps = Object.entries(DEFAULT_WA_TEMPLATES).map(([key, body]) =>
    prisma.messageTemplate.upsert({
      where: { tenantId_key: { tenantId, key } },
      create: { tenantId, key, body },
      update: { body },
    }),
  );

  await prisma.$transaction([...checklistOps, ...waOps]);
}
