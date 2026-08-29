/**
 * WIPE DUMMY DEMO — kosongkan seluruh data dummy tenant "AC Jaya Demo".
 * JALANKAN SAAT GO-LIVE PRODUCTION agar tak ada data palsu.
 * Aman: HANYA tenant demo-ac-jaya; tenant lain tidak tersentuh.
 * Pakai: node --env-file=.env scripts/_demo_wipe.mjs
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const cs = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: cs }) });

async function main() {
  const t = await prisma.tenant.findUnique({ where: { slug: "demo-ac-jaya" } });
  if (!t) { console.log("tenant demo tidak ada — tak ada yang dihapus"); return; }
  const tenantId = t.id;

  await prisma.invoiceItem.deleteMany({ where: { invoice: { tenantId } } });
  await prisma.invoice.deleteMany({ where: { tenantId } });
  await prisma.workItem.deleteMany({ where: { tenantId } });
  await prisma.workSession.deleteMany({ where: { tenantId } });
  await prisma.repeatReminder.deleteMany({ where: { tenantId } });
  await prisma.jobAssignment.deleteMany({ where: { tenantId } });
  await prisma.jobProgressEvent.deleteMany({ where: { jobOrder: { tenantId } } }).catch(() => {});
  await prisma.jobPhoto.deleteMany({ where: { jobOrder: { tenantId } } }).catch(() => {});
  await prisma.jobOrder.deleteMany({ where: { tenantId } });
  await prisma.customerPricing.deleteMany({ where: { tenantId } });
  await prisma.serviceCatalog.deleteMany({ where: { tenantId } });
  await prisma.asset.deleteMany({ where: { tenantId } });
  await prisma.customer.deleteMany({ where: { tenantId } });
  const demoUsers = await prisma.user.findMany({ where: { tenantId, phone: { startsWith: "62899000" } }, select: { id: true } });
  const ids = demoUsers.map((u) => u.id);
  await prisma.technician.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });

  console.log("WIPE demo selesai — tenant demo kosong.");
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error("WIPE ERROR:", e.message); await prisma.$disconnect(); process.exit(1); });
