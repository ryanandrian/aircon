/**
 * SEED PART 2 — pekerjaan + worksession + invoice + pembayaran + pengingat.
 * Baca ctx dari /tmp/seed_ctx.json (hasil part 1).
 */
import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import fs from "fs";

const cs = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: cs }) });
const ctx = JSON.parse(fs.readFileSync("/tmp/seed_ctx.json", "utf8"));
const { tenantId, ownerId, serviceIds, techIds, customers, assets } = ctx;

const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const daysAgo = (d) => { const x = new Date(); x.setDate(x.getDate() - d); x.setHours(rnd(8, 16), rnd(0, 59), 0, 0); return x; };
const daysFromNow = (d) => { const x = new Date(); x.setDate(x.getDate() + d); return x; };
const D = (n) => new Prisma.Decimal(n);

// asset → customerId map
const assetByCust = {};
for (const a of assets) { (assetByCust[a.customerId] ??= []).push(a.id); }

const SERVICE_TYPE_BY_NAME = (name) =>
  name.includes("Cuci") ? "CLEANING" : name.includes("Freon") ? "REFILL_FREON" :
  name.includes("Perbaikan") ? "REPAIR" : name.includes("Bongkar") ? "DISMANTLE" :
  name.includes("Instalasi") ? "INSTALL" : "INSPECTION";

async function main() {
  const year = new Date().getFullYear();
  let invSeq = 0, proSeq = 0;

  // === 60 pekerjaan; ~40 selesai, ~8 berjalan, ~12 terjadwal ===
  const N = 60;
  let nCompleted = 0, nPaid = 0, nProforma = 0, nIssued = 0, nReminder = 0, nWorkSessions = 0;

  for (let i = 0; i < N; i++) {
    const cust = pick(customers);
    const custAssets = assetByCust[cust.id] ?? [];
    if (custAssets.length === 0) continue;
    const assetId = pick(custAssets);
    const svc = pick(serviceIds);
    const serviceType = SERVICE_TYPE_BY_NAME(svc.name);

    // distribusi status
    const roll = i / N;
    let status, scheduledDate, completedAt;
    if (roll < 0.66) { status = "COMPLETED"; completedAt = daysAgo(rnd(2, 120)); scheduledDate = completedAt; }
    else if (roll < 0.80) { status = "IN_PROGRESS"; scheduledDate = daysAgo(0); }
    else { status = "ASSIGNED"; scheduledDate = daysFromNow(rnd(1, 21)); }

    const leadTech = pick(techIds);
    const useTeam = Math.random() < 0.35;
    const kernet = useTeam ? pick(techIds.filter((t) => t !== leadTech)) : null;

    const job = await prisma.jobOrder.create({
      data: {
        tenantId, customerId: cust.id, assetId, technicianId: leadTech,
        serviceType, status, source: pick(["MANUAL","REPEAT","WHATSAPP","WEBSITE"].filter(Boolean).map((s)=> s==="WHATSAPP"?"LEAD":s)),
        scheduledDate, completedAt, estDurationMin: rnd(45, 120),
        price: D(svc.price), createdById: ownerId,
        createdAt: scheduledDate ?? daysAgo(rnd(2, 120)),
        assignmentType: "SPESIFIK",
      },
    });
    // assignments
    await prisma.jobAssignment.create({ data: { tenantId, jobId: job.id, personId: leadTech, roleOnJob: "TECHNICIAN", isLead: true } });
    if (kernet) await prisma.jobAssignment.create({ data: { tenantId, jobId: job.id, personId: kernet, roleOnJob: "KERNET", isLead: false } });

    if (status === "COMPLETED") {
      nCompleted++;
      // work session + items (1-3 item)
      const ws = await prisma.workSession.create({
        data: { tenantId, jobId: job.id, customerId: cust.id, status: "CLOSED", openedById: ownerId, closedAt: completedAt, createdAt: completedAt },
      });
      nWorkSessions++;
      const nItems = rnd(1, 3);
      let subtotal = 0;
      const invItems = [];
      for (let k = 0; k < nItems; k++) {
        const s = k === 0 ? svc : pick(serviceIds);
        const qty = rnd(1, 3);
        const line = s.price * qty;
        subtotal += line;
        await prisma.workItem.create({
          data: {
            tenantId, workSessionId: ws.id, assetId, serviceId: s.id,
            descSnapshot: s.name, category: s.cat, qty: D(qty), unit: "unit",
            unitPriceSnapshot: D(s.price), lineTotal: D(line),
            techIds: [leadTech], kernetIds: kernet ? [kernet] : [],
            createdAt: completedAt,
          },
        });
        invItems.push({ assetId, desc: s.name, cat: s.cat, qty, price: s.price, line });
      }

      // invoice: tempo → proforma piutang; cash → invoice lunas
      const isTempo = cust.top !== "CASH";
      if (isTempo && Math.random() < 0.6) {
        // PROFORMA (piutang)
        proSeq++;
        const number = `PRO/${year}/${String(proSeq).padStart(4, "0")}`;
        const overdue = Math.random() < 0.5;
        const inv = await prisma.invoice.create({
          data: {
            tenantId, docType: "PROFORMA", number, customerId: cust.id, workSessionId: ws.id, jobId: job.id,
            status: overdue ? "OVERDUE" : "ISSUED", issueDate: completedAt,
            dueDate: overdue ? daysAgo(rnd(1, 20)) : daysFromNow(rnd(3, 20)),
            subtotal: D(subtotal), total: D(subtotal), createdById: ownerId, createdAt: completedAt,
          },
        });
        for (const it of invItems) await prisma.invoiceItem.create({ data: { invoiceId: inv.id, assetId: it.assetId, descSnapshot: it.desc, category: it.cat, qty: D(it.qty), unit: "unit", unitPrice: D(it.price), lineTotal: D(it.line) } });
        nProforma++;
      } else {
        // INVOICE cash — mayoritas PAID
        invSeq++;
        const number = `INV/${year}/${String(invSeq).padStart(4, "0")}`;
        const paid = Math.random() < 0.85;
        const inv = await prisma.invoice.create({
          data: {
            tenantId, docType: "INVOICE", number, customerId: cust.id, workSessionId: ws.id, jobId: job.id,
            status: paid ? "PAID" : "ISSUED", issueDate: completedAt,
            dueDate: completedAt,
            subtotal: D(subtotal), total: D(subtotal),
            payMethod: paid ? pick(["CASH","TRANSFER","QRIS"]) : null,
            paidAt: paid ? completedAt : null,
            cashRemitStatus: paid ? pick(["HELD_BY_TECH","REMITTED"]) : null,
            createdById: ownerId, createdAt: completedAt,
          },
        });
        for (const it of invItems) await prisma.invoiceItem.create({ data: { invoiceId: inv.id, assetId: it.assetId, descSnapshot: it.desc, category: it.cat, qty: D(it.qty), unit: "unit", unitPrice: D(it.price), lineTotal: D(it.line) } });
        if (paid) nPaid++; else nIssued++;
      }
    }
  }

  // === pengingat servis (~50 unit, jatuh tempo tersebar) ===
  const someAssets = assets.slice(0, 55);
  for (const a of someAssets) {
    await prisma.repeatReminder.create({
      data: {
        tenantId, assetId: a.id, dueDate: daysFromNow(rnd(-5, 40)),
        leadTimeDays: 7, status: pick(["QUEUED","QUEUED","SENT"]),
      },
    });
    nReminder++;
  }

  console.log(JSON.stringify({ nCompleted, nPaid, nProforma, nIssued, nWorkSessions, nReminder }, null, 0));
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error("PART2 ERROR:", e.message); await prisma.$disconnect(); process.exit(1); });
