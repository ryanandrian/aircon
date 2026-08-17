import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import { PLAN_SEEDS, IOT_PRODUCT_SEED } from "../src/lib/billing/plans";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL }) });

async function main() {
  // 1) Paket langganan (editable admin nanti)
  for (const p of PLAN_SEEDS) {
    await prisma.planConfig.upsert({
      where: { plan: p.plan },
      create: {
        plan: p.plan, displayName: p.displayName, priceMonthly: p.priceMonthly,
        taxable: p.taxable, tagline: p.tagline, sortOrder: p.sortOrder, active: true,
        maxAdmins: p.maxAdmins, maxTechnicians: p.maxTechnicians,
        maxCustomers: p.maxCustomers, maxAcUnits: p.maxAcUnits,
      },
      update: {
        displayName: p.displayName, priceMonthly: p.priceMonthly, taxable: p.taxable,
        tagline: p.tagline, sortOrder: p.sortOrder,
        maxAdmins: p.maxAdmins, maxTechnicians: p.maxTechnicians,
        maxCustomers: p.maxCustomers, maxAcUnits: p.maxAcUnits,
      },
    });
  }
  console.log("PlanConfig di-seed:", PLAN_SEEDS.map((p) => p.plan).join(", "));

  // 2) Kebijakan billing global (singleton)
  await prisma.billingPolicy.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton", taxPercent: 11, trialDays: 14,
      graceDaysBeforeSuspend: 1, daysBeforeDelete: 7,
      dunningReminderDays: "0,1,3", deleteWarningDay: 3,
    },
    update: {},
  });
  console.log("BillingPolicy di-seed (PPN 11%, suspend H+1, hapus H+7)");

  // 3) Produk IoT (jual putus)
  await prisma.iotProduct.upsert({
    where: { sku: IOT_PRODUCT_SEED.sku },
    create: IOT_PRODUCT_SEED,
    update: {
      name: IOT_PRODUCT_SEED.name, description: IOT_PRODUCT_SEED.description,
      priceUnit: IOT_PRODUCT_SEED.priceUnit, warrantyDays: IOT_PRODUCT_SEED.warrantyDays,
    },
  });
  console.log("IotProduct di-seed:", IOT_PRODUCT_SEED.sku, "harga", IOT_PRODUCT_SEED.priceUnit);

  // 4) Platform admin (tim kita)
  await prisma.platformAdmin.upsert({
    where: { email: "ryan.andrian.diputra@gmail.com" },
    create: { email: "ryan.andrian.diputra@gmail.com", name: "Ryan Andrian Diputra", active: true },
    update: { active: true },
  });
  console.log("PlatformAdmin siap: ryan.andrian.diputra@gmail.com");

  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); process.exit(1); });
