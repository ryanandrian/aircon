/**
 * Landing Content Service — konten landing EDITABLE ADMIN (no hardcode).
 * getLandingContent() mengembalikan nilai DB DIGABUNG default kode: kolom kosong -> default.
 * Jadi landing tak pernah kosong meski admin belum mengisi apa pun.
 */
import { prisma } from "@/lib/prisma";
import type { Testimonial } from "@prisma/client";

/** Default kode (fallback). Sama dengan copy yang tampil sekarang. */
export const LANDING_DEFAULTS = {
  heroBadge: "Software usaha servis AC — dari HP, tanpa ribet",
  heroTitle: "Pelanggan servis AC Anda",
  heroTitleAccent: "datang lagi otomatis",
  heroSubtitle:
    "Terima booking online, atur pekerjaan teknisi, dan ingatkan pelanggan servis berkala lewat WhatsApp — semua otomatis. Fokus kerja, biar Aircon yang jaga usaha Anda tetap ramai.",
  heroCtaPrimary: "Coba Gratis",
  heroCtaSecondary: "Lihat Demo Dulu",
  heroMicrocopy: "Tanpa kartu kredit · Bisa langsung dipakai · Berhenti kapan saja",
  heroImageUrl: "",
  logoUrl: "",
  ogImageUrl: "",
  howTitle: "Cara kerjanya sederhana",
  howSubtitle: "Dirancang untuk teknisi & pemilik usaha.",
  featuresTitle: "Semua yang usaha AC Anda butuhkan, dalam satu aplikasi",
  featuresSubtitle: "Dari mencatat pekerjaan sampai uang masuk — rapi, otomatis, dan terlihat profesional.",
  ctaTitle: "Siap bikin usaha AC Anda lebih ramai?",
  ctaSubtitle: "Coba gratis, tak perlu kartu kredit. Bisa langsung dipakai hari ini.",
  ctaButton: "Mulai Sekarang — Gratis",
  footerTagline: "Aircon — Operating System untuk usaha servis AC. Dari Lumite.",
  showRoi: true,
  showHow: true,
  showFeatures: true,
  showSegments: true,
  showPricing: true,
  showTestimonials: false,
  showFaq: true,
};

export type LandingContentResolved = typeof LANDING_DEFAULTS;

/** Gabung DB + default: string kosong -> default. Boolean & gambar dari DB apa adanya bila ada baris. */
export async function getLandingContent(): Promise<LandingContentResolved> {
  const row = await prisma.landingContent.findUnique({ where: { id: "singleton" } });
  if (!row) return { ...LANDING_DEFAULTS };
  const merged: Record<string, unknown> = { ...LANDING_DEFAULTS };
  for (const [k, def] of Object.entries(LANDING_DEFAULTS)) {
    const v = (row as Record<string, unknown>)[k];
    if (typeof def === "boolean") {
      merged[k] = typeof v === "boolean" ? v : def;
    } else {
      merged[k] = typeof v === "string" && v.trim() !== "" ? v : def;
    }
  }
  return merged as LandingContentResolved;
}

/** Raw row untuk editor admin (tanpa merge default, agar admin lihat apa yang tersimpan). */
export async function getLandingRaw() {
  const row = await prisma.landingContent.findUnique({ where: { id: "singleton" } });
  return row ?? null;
}

export type LandingUpdateInput = Partial<{
  heroBadge: string; heroTitle: string; heroTitleAccent: string; heroSubtitle: string;
  heroCtaPrimary: string; heroCtaSecondary: string; heroMicrocopy: string; heroImageUrl: string;
  logoUrl: string; ogImageUrl: string; howTitle: string; howSubtitle: string;
  featuresTitle: string; featuresSubtitle: string;
  ctaTitle: string; ctaSubtitle: string; ctaButton: string; footerTagline: string;
  showRoi: boolean; showHow: boolean; showFeatures: boolean; showSegments: boolean; showPricing: boolean;
  showTestimonials: boolean; showFaq: boolean;
}>;

export async function updateLandingContent(data: LandingUpdateInput, adminEmail: string) {
  return prisma.landingContent.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...data, updatedBy: adminEmail },
    update: { ...data, updatedBy: adminEmail },
  });
}

// ---- Testimoni ----
export async function listTestimonials(onlyPublished = false): Promise<Testimonial[]> {
  return prisma.testimonial.findMany({
    where: onlyPublished ? { published: true } : undefined,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });
}

export type TestimonialInput = {
  name: string; business: string; quote: string; photoUrl: string; rating: number; sortOrder: number; published: boolean;
};

export async function createTestimonial(data: TestimonialInput) {
  return prisma.testimonial.create({ data });
}

export async function updateTestimonial(id: string, data: Partial<TestimonialInput>) {
  return prisma.testimonial.update({ where: { id }, data });
}

export async function deleteTestimonial(id: string) {
  return prisma.testimonial.delete({ where: { id } });
}
