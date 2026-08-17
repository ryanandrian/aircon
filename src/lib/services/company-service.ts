/**
 * Company Profile (Lumite) — profil perusahaan penyedia, DB-driven (no hardcode).
 * Dipakai untuk invoice/kwitansi + data merchant di transaksi Midtrans.
 * PKP menentukan apakah PPN boleh dipungut (jika bukan PKP → pajak efektif 0).
 */
import { prisma } from "@/lib/prisma";
import type { CompanyProfile } from "@prisma/client";
import type { CompanyProfileInput } from "@/lib/validation/admin-config";
import { effectiveTaxPercent } from "@/lib/billing/gating-pure";

export type { CompanyProfileInput };
export { effectiveTaxPercent };

/** Ambil profil perusahaan (singleton). Buat default bila belum ada. */
export async function getCompanyProfile(): Promise<CompanyProfile> {
  const existing = await prisma.companyProfile.findUnique({ where: { id: "singleton" } });
  if (existing) return existing;
  return prisma.companyProfile.create({ data: { id: "singleton" } });
}

/** PLATFORM-ADMIN-ONLY. Perbarui profil perusahaan. */
export async function updateCompanyProfile(
  data: CompanyProfileInput,
  adminEmail: string,
): Promise<CompanyProfile> {
  return prisma.companyProfile.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...data, updatedBy: adminEmail },
    update: { ...data, updatedBy: adminEmail },
  });
}
