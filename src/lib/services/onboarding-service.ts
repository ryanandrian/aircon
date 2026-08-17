/**
 * Onboarding otomatis: pastikan user Supabase punya tenant + record User domain.
 * Dipanggil setelah OAuth berhasil (callback). Idempoten.
 * Untuk pilot: owner pertama = auto-provision tenant baru dengan defaults.
 */
import { prisma } from "@/lib/prisma";
import { seedTenantDefaults } from "@/lib/domain/provision";
import { DEFAULT_WA_TEMPLATES } from "@/lib/domain/defaults";

interface EnsureInput {
  email: string | null;
  phone: string | null;
  fullName: string | null;
}

/** Buat slug unik dari nama/email. */
function makeSlug(base: string): string {
  const s = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return s || "usaha";
}

/**
 * Pastikan ada User domain untuk identitas ini. Bila belum ada, provision
 * tenant baru + owner. Mengembalikan userId + tenantId.
 * SECURITY: hanya dipanggil dari server setelah sesi Supabase terverifikasi.
 */
export async function ensureUserProvisioned(input: EnsureInput): Promise<{
  userId: string;
  tenantId: string;
  created: boolean;
}> {
  const { email, phone, fullName } = input;

  // Cari user domain yang cocok (email atau phone).
  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        ...(email ? [{ email }] : []),
        ...(phone ? [{ phone }] : []),
      ],
    },
  });
  if (existing) {
    return { userId: existing.id, tenantId: existing.tenantId, created: false };
  }

  // Provision tenant baru + owner (transaksi).
  const displayName = fullName?.trim() || email?.split("@")[0] || "Usaha AC Saya";
  const baseSlug = makeSlug(email?.split("@")[0] ?? displayName);

  // slug unik
  let slug = baseSlug;
  for (let i = 0; i < 5; i++) {
    const taken = await prisma.tenant.findUnique({ where: { slug } });
    if (!taken) break;
    slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
  }

  const ownerPhone = phone ?? `pending-${Date.now()}`;

  const { userId, tenantId } = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        name: `${displayName}`,
        slug,
        phone: ownerPhone,
        workingHoursDefault: { mon: { start: "08:00", end: "17:00" } },
        serviceArea: {},
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

  // Seed defaults (checklist + WA templates) di luar transaksi utama.
  await seedTenantDefaults(prisma, tenantId).catch(() => {
    // fallback minimal: pastikan template reminder ada
    return prisma.messageTemplate.upsert({
      where: { tenantId_key: { tenantId, key: "reminder" } },
      create: { tenantId, key: "reminder", body: DEFAULT_WA_TEMPLATES.reminder },
      update: {},
    });
  });

  return { userId, tenantId, created: true };
}
