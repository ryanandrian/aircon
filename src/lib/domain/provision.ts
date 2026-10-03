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
