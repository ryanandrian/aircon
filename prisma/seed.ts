/**
 * Seed script — buat 1 tenant demo + defaults + sample data untuk verifikasi money loop.
 * Jalankan: node --import tsx prisma/seed.ts   (atau via npx tsx)
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import { DEFAULT_CHECKLISTS, DEFAULT_WA_TEMPLATES } from "../src/lib/domain/defaults";

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const slug = "demo-ac-jaya";
  // Bersihkan tenant demo lama (idempoten)
  const existing = await prisma.tenant.findUnique({ where: { slug } });
  if (existing) {
    console.log("Tenant demo sudah ada:", existing.id, "-> hapus & buat ulang");
    await prisma.tenant.delete({ where: { id: existing.id } }).catch(() => {});
  }

  const tenant = await prisma.tenant.create({
    data: {
      name: "AC Jaya Demo",
      slug,
      phone: "628111000001",
      workingHoursDefault: { mon: { start: "08:00", end: "17:00" } },
      serviceArea: { cities: ["Jakarta"] },
    },
  });
  console.log("Tenant dibuat:", tenant.id);

  // defaults
  for (const [serviceType, items] of Object.entries(DEFAULT_CHECKLISTS)) {
    await prisma.checklistTemplate.create({
      data: { tenantId: tenant.id, serviceType: serviceType as never, items: items as never },
    });
  }
  for (const [key, body] of Object.entries(DEFAULT_WA_TEMPLATES)) {
    await prisma.messageTemplate.create({ data: { tenantId: tenant.id, key, body } });
  }
  console.log("Defaults: checklist", Object.keys(DEFAULT_CHECKLISTS).length, "+ WA", Object.keys(DEFAULT_WA_TEMPLATES).length);

  // Owner
  const owner = await prisma.user.create({
    data: { tenantId: tenant.id, name: "Pak Budi", phone: "628111000001", email: "budi@demo.com", role: "OWNER", authProvider: "GOOGLE", status: "ACTIVE" },
  });
  // Teknisi
  const techUser = await prisma.user.create({
    data: { tenantId: tenant.id, name: "Andi Teknisi", phone: "628111000002", role: "TECHNICIAN", authProvider: "PIN", status: "ACTIVE" },
  });
  const tech = await prisma.technician.create({
    data: { tenantId: tenant.id, userId: techUser.id, skills: ["CLEANING", "REFILL_FREON", "REPAIR"] },
  });

  // Customer + asset
  const cust = await prisma.customer.create({
    data: { tenantId: tenant.id, name: "Ibu Sari", phone: "628222000001", address: "Jl. Melati No.1", source: "REFERRAL", geoLat: -6.2, geoLng: 106.8 },
  });
  const asset = await prisma.asset.create({
    data: { tenantId: tenant.id, customerId: cust.id, brand: "Daikin", type: "SPLIT", capacityPk: 1, roomLocation: "Ruang Tamu", maintenanceIntervalDays: 90 },
  });

  // Job selesai kemarin -> money loop
  const completedAt = new Date(); completedAt.setDate(completedAt.getDate() - 1);
  const nextService = new Date(completedAt); nextService.setDate(nextService.getDate() + 90);
  const job = await prisma.jobOrder.create({
    data: {
      tenantId: tenant.id, customerId: cust.id, assetId: asset.id, technicianId: tech.id,
      serviceType: "CLEANING", status: "COMPLETED", source: "MANUAL",
      price: 150000, completedAt, nextServiceDate: nextService, createdById: owner.id,
    },
  });
  await prisma.asset.update({ where: { id: asset.id }, data: { nextServiceDate: nextService } });
  console.log("Job COMPLETED:", job.id, "-> next service:", nextService.toISOString().slice(0, 10));

  // RepeatReminder yang JATUH TEMPO hari ini (agar bagian Money Loop di /demo terisi).
  const dueRem = new Date(); dueRem.setDate(dueRem.getDate() - 1); // due kemarin
  await prisma.repeatReminder.create({
    data: { tenantId: tenant.id, assetId: asset.id, dueDate: dueRem, leadTimeDays: 0, status: "QUEUED" },
  });

  // Customer & unit kedua + pekerjaan berjalan (agar daftar job & metrik lebih hidup).
  const cust2 = await prisma.customer.create({
    data: { tenantId: tenant.id, name: "Bpk. Hendra", phone: "628222000002", address: "Jl. Anggrek No.7", source: "WEBSITE", geoLat: -6.21, geoLng: 106.82 },
  });
  const asset2 = await prisma.asset.create({
    data: { tenantId: tenant.id, customerId: cust2.id, brand: "Panasonic", type: "SPLIT", capacityPk: 2, roomLocation: "Kantor", maintenanceIntervalDays: 90 },
  });
  await prisma.jobOrder.create({
    data: {
      tenantId: tenant.id, customerId: cust2.id, assetId: asset2.id, technicianId: tech.id,
      serviceType: "REPAIR", status: "ASSIGNED", source: "WEBSITE", price: 250000, createdById: owner.id,
    },
  });
  console.log("Data tambahan: customer+unit+job kedua, 1 pengingat due.");

  console.log("\nSEED OK. Tenant demo siap untuk uji money loop.");
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
