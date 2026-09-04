/**
 * Tenant Profile Service — update branding/pajak/rekening/QRIS milik tenant.
 * SECURITY: tenant-scoped (id dari session, bukan input). Whitelist field (anti mass-assignment).
 */
import type { Tenant, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ServiceError } from "@/lib/services/customer-service";
import { normalizePhone } from "@/lib/wa/gateway";
import type { TenantProfileInput } from "@/lib/validation/tenant-profile";

/** Ambil profil usaha (field yang relevan untuk pengaturan). */
export async function getTenantProfile(tenantId: string) {
  const t = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      name: true, phone: true, address: true, tagline: true,
      logoUrl: true, isPkp: true, npwp: true, taxPercent: true,
      bankName: true, bankAccountNo: true, bankAccountName: true, qrisImageUrl: true,
      teamIncentiveMode: true, incentiveBasis: true, incentiveEnabled: true,
    },
  });
  if (!t) throw new ServiceError("NOT_FOUND", "Usaha tidak ditemukan");
  return t;
}

/** Perbarui profil usaha (whitelist eksplisit). */
export async function updateTenantProfile(
  tenantId: string,
  input: TenantProfileInput,
): Promise<Tenant> {
  const data: Prisma.TenantUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.phone !== undefined) data.phone = input.phone ? normalizePhone(input.phone) : input.phone;
  if (input.address !== undefined) data.address = input.address;
  if (input.tagline !== undefined) data.tagline = input.tagline;
  if (input.logoUrl !== undefined) data.logoUrl = input.logoUrl;
  if (input.isPkp !== undefined) data.isPkp = input.isPkp;
  if (input.npwp !== undefined) data.npwp = input.npwp;
  if (input.taxPercent !== undefined) data.taxPercent = input.taxPercent;
  if (input.bankName !== undefined) data.bankName = input.bankName;
  if (input.bankAccountNo !== undefined) data.bankAccountNo = input.bankAccountNo;
  if (input.bankAccountName !== undefined) data.bankAccountName = input.bankAccountName;
  if (input.qrisImageUrl !== undefined) data.qrisImageUrl = input.qrisImageUrl;
  if (input.teamIncentiveMode !== undefined) data.teamIncentiveMode = input.teamIncentiveMode;
  if (input.incentiveBasis !== undefined) data.incentiveBasis = input.incentiveBasis;
  if (input.incentiveEnabled !== undefined) data.incentiveEnabled = input.incentiveEnabled;
  try {
    return await prisma.tenant.update({ where: { id: tenantId }, data });
  } catch (err) {
    throw new ServiceError(
      "UNEXPECTED",
      "Gagal menyimpan profil usaha",
      err instanceof Error ? err.message : String(err),
    );
  }
}
