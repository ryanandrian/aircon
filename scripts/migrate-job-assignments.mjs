/**
 * MIGRASI DATA one-shot (idempoten) — F3.1:
 * Isi JobAssignment dari JobOrder.technicianId lama (1 baris TECHNICIAN isLead per job berteknisi).
 * Aman diulang: skip job yang sudah punya assignment (unique [jobId, personId]).
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const cs = process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: cs }) });

const jobs = await prisma.jobOrder.findMany({
  where: { technicianId: { not: null } },
  select: { id: true, tenantId: true, technicianId: true },
});

let created = 0, skipped = 0;
for (const j of jobs) {
  const personId = j.technicianId;
  const exists = await prisma.jobAssignment.findFirst({
    where: { jobId: j.id, personId },
    select: { id: true },
  });
  if (exists) { skipped++; continue; }
  await prisma.jobAssignment.create({
    data: { tenantId: j.tenantId, jobId: j.id, personId, roleOnJob: "TECHNICIAN", isLead: true },
  });
  created++;
}
const total = await prisma.jobAssignment.count();
console.log(JSON.stringify({ jobsWithTech: jobs.length, created, skipped, totalAssignments: total }));
await prisma.$disconnect();
