/** Seed 4-5 testimoni DUMMY + aktifkan showTestimonials. Admin bisa edit/hapus via /admin/landing.
 * Idempoten: skip bila sudah ada testimoni. */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const cs = process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: cs }) });

const DUMMY = [
  { name: "Budi Santoso", business: "Budi Jaya AC — Bekasi", rating: 5, sortOrder: 0, published: true,
    quote: "Sejak pakai Aircon, pelanggan lama otomatis dihubungi saat waktunya cuci AC. Servis ulang naik, saya tak perlu catat manual lagi." },
  { name: "Siti Rahayu", business: "Sejuk Teknik — Depok", rating: 5, sortOrder: 1, published: true,
    quote: "Dulu jadwal teknisi berantakan di grup WhatsApp. Sekarang semua rapi dalam satu aplikasi, teknisi tinggal buka HP." },
  { name: "Andi Pratama", business: "Andi Cool Service — Tangerang", rating: 5, sortOrder: 2, published: true,
    quote: "Booking online dari pelanggan langsung masuk. Kartu perawatan tiap unit AC bikin pelanggan gedung percaya sama kami." },
  { name: "Dewi Lestari", business: "Dewi AC Mandiri — Jakarta", rating: 5, sortOrder: 3, published: true,
    quote: "Gratis buat mulai, jadi saya berani coba. Setelah pelanggan makin banyak, saya upgrade — worth it." },
  { name: "Rizal Hakim", business: "Hakim Dingin Teknik — Bogor", rating: 4, sortOrder: 4, published: true,
    quote: "Reminder WhatsApp otomatis ke pelanggan itu fitur andalan. Pelanggan merasa diperhatikan, saya dapat repeat order." },
];

const count = await prisma.testimonial.count();
if (count > 0) {
  console.log("SKIP: sudah ada", count, "testimoni (tak menimpa).");
} else {
  await prisma.testimonial.createMany({ data: DUMMY });
  console.log("SEEDED", DUMMY.length, "testimoni dummy");
}

// aktifkan showTestimonials di LandingContent singleton
const lc = await prisma.landingContent.findFirst();
if (lc) {
  await prisma.landingContent.update({ where: { id: lc.id }, data: { showTestimonials: true } });
  console.log("showTestimonials = true (id", lc.id + ")");
} else {
  await prisma.landingContent.create({ data: { id: "singleton", showTestimonials: true } });
  console.log("created LandingContent singleton + showTestimonials=true");
}
await prisma.$disconnect();
