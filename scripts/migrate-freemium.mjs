/** Migrasi ke model gratis-permanen:
 *  1. PlanConfig TRIAL: displayName->"Basic", tagline gratis-selamanya (DB = sumber kebenaran).
 *  2. Semua tenant plan=TRIAL & status TRIAL/ACTIVE tanpa langganan berbayar -> ACTIVE, nextDueDate null, trialEndsAt null.
 * Idempoten & aman: hanya sentuh tenant yang belum berbayar (plan TRIAL). */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const cs = process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: cs }) });

// 1) PlanConfig TRIAL -> Basic (bila belum)
const tc = await prisma.planConfig.findUnique({ where: { plan: "TRIAL" } });
if (tc) {
  await prisma.planConfig.update({
    where: { plan: "TRIAL" },
    data: { displayName: "Basic", tagline: "Gratis selamanya untuk usaha AC kecil" },
  });
  console.log("PlanConfig TRIAL -> displayName=Basic");
} else {
  console.log("PlanConfig TRIAL tak ada (akan dibuat saat seed)");
}

// 2) Tenant TRIAL -> gratis permanen
const res = await prisma.tenant.updateMany({
  where: { plan: "TRIAL", status: { in: ["TRIAL", "ACTIVE", "PAST_DUE"] } },
  data: { status: "ACTIVE", nextDueDate: null, trialEndsAt: null },
});
console.log("Tenant TRIAL -> Basic permanen (ACTIVE, no due):", res.count);
await prisma.$disconnect();
