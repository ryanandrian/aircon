/**
 * SEED DUMMY "REAL" — tenant demo "AC Jaya Demo" (slug demo-ac-jaya).
 * Tujuan: kesan bisnis RAMAI & sudah lama jalan untuk screenshot Pratinjau + testing dev.
 * SIFAT: idempoten (hapus data demo lama lalu isi ulang), HANYA tenant demo.
 * HAPUS saat go-live: jalankan scripts/_demo_wipe.mjs.
 *
 * Skala: ~40 pelanggan, ~90 unit, 8 layanan, 5 teknisi, ~60 pekerjaan,
 *        ~45 invoice (mayoritas lunas), ~50 pengingat. Tanggal tersebar 4 bulan ke belakang.
 */
import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import crypto from "crypto";

const cs = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: cs }) });

function hashPin(pin) {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(pin, salt, 32);
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const daysAgo = (d) => { const x = new Date(); x.setDate(x.getDate() - d); return x; };
const daysFromNow = (d) => { const x = new Date(); x.setDate(x.getDate() + d); return x; };
const D = (n) => new Prisma.Decimal(n);

const FIRST = ["Ibu Sari","Bpk Andre","Ibu Rina","Bpk Hendra","Ibu Dewi","Bpk Joko","Ibu Maya","Bpk Rudi","Ibu Lina","Bpk Agus","Ibu Wati","Bpk Bayu","Ibu Nita","Bpk Eko","Ibu Fitri","Bpk Gunawan","Ibu Hesti","Bpk Irfan","Ibu Kartika","Bpk Lukman"];
const INSTANSI = ["Kantor PT Maju Jaya","Kos Melati","Ruko Sentra Niaga","Restoran Nusantara","Klinik Sehat Bunda","Kos Putri Anggrek","Kantor Notaris Wijaya","Toko Elektronik Cahaya","Apotek Sehat","Warung Kopi Senja","Kos Bahagia","Kantor Desa Sukamaju","Salon Cantik","Bimbel Cerdas","Gudang Logistik Prima","Masjid Al-Ikhlas","Sekolah Tunas Bangsa","Hotel Melati Indah","Cafe Kopi Kita","Dealer Motor Jaya"];
const BRANDS = ["Daikin","Panasonic","Sharp","LG","Samsung","Gree","Midea","Changhong"];

/** Kategori pelanggan diturunkan dari NAMA (agar masuk akal di UI, bukan acak). */
function catFromName(name) {
  const n = name.toLowerCase();
  if (n.includes("masjid") || n.includes("mushola")) return "MASJID_MUSHOLA";
  if (n.includes("sekolah") || n.includes("bimbel") || n.includes("kampus")) return "SEKOLAH_KAMPUS";
  if (n.includes("ruko") || n.includes("notaris") || n.includes("dealer")) return "RUKO_RUKAN";
  if (n.includes("toko") || n.includes("apotek") || n.includes("salon") || n.includes("warung") ||
      n.includes("cafe") || n.includes("kopi") || n.includes("restoran")) return "TOKO_OUTLET";
  if (n.includes("kantor") || n.includes("pt ") || n.includes("gudang") || n.includes("logistik") ||
      n.includes("kos") || n.includes("hotel") || n.includes("klinik") || n.includes("desa")) return "KANTOR_PERUSAHAAN";
  return "LAINNYA";
}
const ROOMS = ["R. Tamu","R. Keluarga","Kamar Utama","Kamar 1","Kamar 2","Kamar 3","R. Kerja","R. Meeting","Lobby","Dapur","Kasir","Gudang"];
const PKS = [0.5, 0.75, 1, 1.5, 2, 2.5];

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: "demo-ac-jaya" } });
  if (!tenant) throw new Error("tenant demo-ac-jaya tidak ada");
  const tenantId = tenant.id;
  console.log("tenant:", tenantId);

  // ---- profil tenant (biar invoice profesional) ----
  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      bankName: "BCA", bankAccountNo: "1234567890", bankAccountName: "AC Jaya Demo",
      phone: "628121000000",
    },
  }).catch(() => {});

  // ---- WIPE data demo lama (urut FK aman) ----
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
  // teknisi: hapus yang DEMO- (biar Andi asli tetap bila ada)
  const demoUsers = await prisma.user.findMany({ where: { tenantId, phone: { startsWith: "62899000" } }, select: { id: true } });
  const demoUserIds = demoUsers.map((u) => u.id);
  await prisma.technician.deleteMany({ where: { userId: { in: demoUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: demoUserIds } } });
  console.log("wipe demo lama: OK");

  // ---- owner (createdById) ----
  let owner = await prisma.user.findFirst({ where: { tenantId, role: "OWNER" } });
  if (!owner) owner = await prisma.user.findFirst({ where: { tenantId } });
  const ownerId = owner?.id ?? "seed-owner";

  // ---- katalog layanan (8) ----
  const svcDefs = [
    ["CUC-075","Cuci AC Split ¾–1 PK","SERVICE",75000,20000,10000],
    ["CUC-150","Cuci AC Split 1,5–2 PK","SERVICE",100000,25000,12000],
    ["FRE-R32","Isi Freon R32","SERVICE",150000,30000,15000],
    ["FRE-R22","Isi Freon R22","SERVICE",130000,28000,14000],
    ["RPR-DNG","Perbaikan AC Tidak Dingin","SERVICE",200000,50000,20000],
    ["BKP-PSG","Bongkar–Pasang AC","SERVICE",350000,80000,40000],
    ["INS-BRU","Instalasi AC Baru","SERVICE",300000,70000,35000],
    ["SVC-KTR","Servis Rutin (Kontrak)","MAINTENANCE",65000,15000,8000],
  ];
  const services = [];
  for (const [code, name, cat, price, ti, ki] of svcDefs) {
    const s = await prisma.serviceCatalog.create({
      data: {
        tenantId, code, name, category: cat, standardPrice: D(price), unit: "unit",
        techIncentiveType: "VALUE", techIncentiveValue: D(ti),
        kernetIncentiveType: "VALUE", kernetIncentiveValue: D(ki),
      },
    });
    services.push(s);
  }
  console.log("layanan:", services.length);

  // ---- teknisi (5) ----
  const techNames = ["Andi Saputra","Budi Hartono","Coki Pratama","Dedi Kurnia","Eko Wahyudi"];
  const techs = [];
  for (let i = 0; i < techNames.length; i++) {
    const u = await prisma.user.create({
      data: {
        tenantId, name: techNames[i], phone: `6289900000${i + 1}`, role: "TECHNICIAN",
        authProvider: "PIN", pinHash: hashPin(`00000${i + 1}`), status: "ACTIVE",
      },
    });
    const t = await prisma.technician.create({
      data: { tenantId, userId: u.id, skills: ["CLEANING", "REPAIR"], active: true },
    });
    techs.push(t);
  }
  console.log("teknisi:", techs.length);

  // ---- pelanggan (~40) + unit (~90) ----
  const custNames = [...FIRST, ...INSTANSI];
  const customers = [];
  const assets = [];
  for (let i = 0; i < custNames.length; i++) {
    const name = custNames[i];
    const isBadan = i >= FIRST.length;
    const cat = isBadan ? catFromName(name) : "RUMAH";
    const top = isBadan ? pick(["CASH","TEMPO_14","TEMPO_30"]) : "CASH";
    const c = await prisma.customer.create({
      data: {
        tenantId, name, phone: `62812${String(1000000 + i * 7777).slice(0, 7)}`,
        address: `Jl. ${pick(["Merdeka","Sudirman","Melati","Kenanga","Cempaka","Diponegoro"])} No. ${rnd(1,199)}, ${pick(["Jakarta","Bekasi","Depok","Tangerang","Bogor"])}`,
        source: pick(["REFERRAL","WHATSAPP","WALK_IN","WEBSITE","REPEAT"]),
        customerType: isBadan ? "BADAN" : "PERORANGAN",
        category: cat, topType: top,
        createdAt: daysAgo(rnd(30, 130)),
      },
    });
    customers.push(c);
    // unit: instansi 3-8, rumah 1-3
    const nUnits = isBadan ? rnd(3, 8) : rnd(1, 3);
    for (let u = 0; u < nUnits; u++) {
      const pk = pick(PKS);
      const lastSvc = daysAgo(rnd(20, 110));
      const a = await prisma.asset.create({
        data: {
          tenantId, customerId: c.id, brand: pick(BRANDS), type: "SPLIT",
          capacityPk: pk, roomLocation: pick(ROOMS), quantity: 1,
          maintenanceIntervalDays: 90, nextServiceDate: daysFromNow(rnd(-10, 60)),
          installedAt: daysAgo(rnd(200, 700)),
        },
      });
      assets.push({ ...a, customerId: c.id, lastSvc });
    }
  }
  console.log("pelanggan:", customers.length, "| unit:", assets.length);

  // ---- harga khusus (3 pelanggan langganan) ----
  for (let i = 0; i < 3; i++) {
    const c = customers[FIRST.length + i]; // instansi
    const s = services[0]; // cuci ¾-1PK
    await prisma.customerPricing.create({
      data: { tenantId, customerId: c.id, serviceId: s.id, price: D(60000) },
    }).catch(() => {});
  }
  console.log("harga khusus: 3");

  return { tenantId, ownerId, services, techs, customers, assets };
}

main()
  .then(async (ctx) => {
    // simpan ctx untuk part 2
    const fs = await import("fs");
    fs.writeFileSync("/tmp/seed_ctx.json", JSON.stringify({
      tenantId: ctx.tenantId, ownerId: ctx.ownerId,
      serviceIds: ctx.services.map((s) => ({ id: s.id, price: Number(s.standardPrice), cat: s.category, name: s.name, ti: Number(s.techIncentiveValue), ki: Number(s.kernetIncentiveValue) })),
      techIds: ctx.techs.map((t) => t.id),
      customers: ctx.customers.map((c) => ({ id: c.id, top: c.topType, type: c.customerType })),
      assets: ctx.assets.map((a) => ({ id: a.id, customerId: a.customerId })),
    }));
    console.log("PART1 OK → /tmp/seed_ctx.json");
    await prisma.$disconnect();
  })
  .catch(async (e) => { console.error("SEED ERROR:", e.message); await prisma.$disconnect(); process.exit(1); });
