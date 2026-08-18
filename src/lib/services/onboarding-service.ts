/**
 * Onboarding SaaS — pemisahan tegas antara MENGENALI user vs MEMBUAT usaha.
 *
 * Alur baru (bukan auto-provision lama):
 *  1. Setelah login Google, callback memanggil `findDomainUser` — HANYA membaca,
 *     tidak membuat apa pun. Bila user sudah punya usaha → masuk /app.
 *  2. Bila belum, owner diarahkan ke wizard /onboarding. Setelah mengisi form,
 *     `createTenantForOwner` membuat Usaha + owner + defaults secara eksplisit.
 *
 * SECURITY: hanya dipanggil dari server setelah sesi Supabase terverifikasi.
 * Identitas (email/phone) berasal dari sesi, bukan input klien mentah.
 */
import { prisma } from "@/lib/prisma";
import { seedTenantDefaults } from "@/lib/domain/provision";
import { DEFAULT_WA_TEMPLATES } from "@/lib/domain/defaults";
import { computeTrialEnd } from "@/lib/billing/gating";
import { getBillingPolicy } from "@/lib/billing/config";
import type { User } from "@prisma/client";

/** Identitas dari sesi Supabase untuk mencari/membuat user domain. */
interface Identity {
  email: string | null;
  phone: string | null;
}

/**
 * Cari User domain yang cocok dengan identitas ini (email atau phone).
 * TIDAK membuat apa pun. Mengembalikan null bila belum terdaftar.
 * Dipakai callback OAuth untuk memutuskan: masuk /app vs arahkan ke /onboarding.
 */
export async function findDomainUser({ email, phone }: Identity): Promise<User | null> {
  if (!email && !phone) return null;
  return prisma.user.findFirst({
    where: {
      OR: [
        ...(email ? [{ email }] : []),
        ...(phone ? [{ phone }] : []),
      ],
    },
  });
}

/** Buat slug unik dari nama usaha. */
function makeSlug(base: string): string {
  const s = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return s || "usaha";
}

interface CreateTenantInput {
  /** Identitas owner dari sesi Supabase. */
  email: string | null;
  phone: string | null;
  fullName: string | null;
  /** Data dari wizard setup usaha (sudah tervalidasi Zod). */
  businessName: string;
  city: string;
  whatsappPhone: string;
  /** Kode agen/reseller (opsional) — atribusi keagenan permanen. */
  referralCode?: string | null;
}

/**
 * Buat Usaha baru untuk owner (dipanggil dari wizard onboarding).
 * - Tenant: onboardingCompleted=true, status=TRIAL, trialEndsAt=computeTrialEnd(now).
 * - User: role OWNER, terhubung ke Usaha, authProvider GOOGLE.
 * - Seed defaults (checklist + template WhatsApp) via seedTenantDefaults.
 *
 * SECURITY: identitas owner (email/phone) HARUS berasal dari sesi terverifikasi,
 * bukan dari FormData klien. businessName/city/whatsappPhone dari input tervalidasi.
 */
export async function createTenantForOwner(input: CreateTenantInput): Promise<{
  userId: string;
  tenantId: string;
  slug: string;
}> {
  const { email, phone, fullName, businessName, city, whatsappPhone } = input;

  // Guard: cegah owner yang sudah punya usaha membuat lagi (idempoten & aman).
  const existing = await findDomainUser({ email, phone });
  if (existing) {
    return {
      userId: existing.id,
      tenantId: existing.tenantId,
      slug: "",
    };
  }

  const displayName = fullName?.trim() || email?.split("@")[0] || businessName;

  // Slug unik dari nama usaha.
  const baseSlug = makeSlug(businessName);
  let slug = baseSlug;
  for (let i = 0; i < 5; i++) {
    const taken = await prisma.tenant.findUnique({ where: { slug } });
    if (!taken) break;
    slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
  }

  // Nomor WhatsApp usaha (sudah ternormalisasi 62) = phone Tenant (unik).
  const ownerPhone = phone ?? whatsappPhone;
  const now = new Date();
  // Durasi trial DIBACA DARI kebijakan billing (editable admin), bukan hardcode.
  const policy = await getBillingPolicy();
  const trialEnd = computeTrialEnd(now, policy.trialDays);

  const { userId, tenantId } = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        name: businessName,
        slug,
        phone: whatsappPhone,
        plan: "TRIAL",
        status: "TRIAL",
        trialEndsAt: trialEnd,
        nextDueDate: trialEnd,
        onboardingCompleted: true,
        workingHoursDefault: { mon: { start: "08:00", end: "17:00" } },
        serviceArea: { cities: [city] },
      },
    });
    const user = await tx.user.create({
      data: {
        tenantId: tenant.id,
        name: displayName,
        phone: ownerPhone,
        email,
        role: "OWNER",
        authProvider: "GOOGLE",
        status: "ACTIVE",
      },
    });
    return { userId: user.id, tenantId: tenant.id };
  });

  // Seed defaults (checklist + template WhatsApp) di luar transaksi utama.
  await seedTenantDefaults(prisma, tenantId).catch(() => {
    // fallback minimal: pastikan template pengingat servis ada
    return prisma.messageTemplate.upsert({
      where: { tenantId_key: { tenantId, key: "reminder" } },
      create: { tenantId, key: "reminder", body: DEFAULT_WA_TEMPLATES.reminder },
      update: {},
    });
  });

  // Atribusi keagenan (opsional, PERMANEN, gagal-jujur — tak mengganggu onboarding).
  if (input.referralCode?.trim()) {
    try {
      const { attributeTenant } = await import("@/lib/partner/partner-service");
      await attributeTenant(tenantId, input.referralCode.trim());
    } catch (err) {
      console.error("[attribution] gagal (onboarding tetap sukses):", err);
    }
  }

  return { userId, tenantId, slug };
}
