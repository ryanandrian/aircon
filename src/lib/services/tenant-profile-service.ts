/**
 * Tenant Profile Service — update branding/pajak/rekening/QRIS milik tenant.
 * SECURITY: tenant-scoped (id dari session, bukan input). Whitelist field (anti mass-assignment).
 */
import type { Tenant, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ServiceError } from "@/lib/services/customer-service";
import { normalizePhone } from "@/lib/wa/gateway";
import type { TenantProfileInput } from "@/lib/validation/tenant-profile";
import { parsePublicProfile, parseServiceArea } from "@/lib/domain/public-profile";

/** Ambil profil usaha (field yang relevan untuk pengaturan). */
export async function getTenantProfile(tenantId: string) {
  const t = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      name: true, slug: true, phone: true, address: true, tagline: true,
      logoUrl: true, isPkp: true, npwp: true, taxPercent: true,
      bankName: true, bankAccountNo: true, bankAccountName: true, qrisImageUrl: true,
      teamIncentiveMode: true, incentiveBasis: true, incentiveEnabled: true,
      publicProfile: true, serviceArea: true,
    },
  });
  if (!t) throw new ServiceError("NOT_FOUND", "Usaha tidak ditemukan");
  const pub = parsePublicProfile(t.publicProfile);
  const area = parseServiceArea(t.serviceArea);
  return {
    name: t.name, slug: t.slug, phone: t.phone, address: t.address, tagline: t.tagline,
    logoUrl: t.logoUrl, isPkp: t.isPkp, npwp: t.npwp, taxPercent: t.taxPercent,
    bankName: t.bankName, bankAccountNo: t.bankAccountNo, bankAccountName: t.bankAccountName,
    qrisImageUrl: t.qrisImageUrl,
    teamIncentiveMode: t.teamIncentiveMode, incentiveBasis: t.incentiveBasis, incentiveEnabled: t.incentiveEnabled,
    publicDescription: pub.description ?? "",
    services: pub.services ?? [],
    operatingHours: pub.operatingHours ?? "",
    trustBadges: (pub.trustBadges ?? []).map((b) => b.label),
    instagram: pub.instagram ?? "",
    mapUrl: pub.mapUrl ?? "",
    areaCities: area.cities ?? [],
    areaDistricts: area.districts ?? [],
  };
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

  // Halaman publik: gabung ke publicProfile (Json) — pertahankan field lain (mis. customers) yang
  // belum diedit di form ini. serviceArea (Json) di-set dari areaCities/areaDistricts.
  const touchesPublic =
    input.publicDescription !== undefined || input.services !== undefined ||
    input.operatingHours !== undefined || input.trustBadges !== undefined ||
    input.instagram !== undefined || input.mapUrl !== undefined;
  const touchesArea = input.areaCities !== undefined || input.areaDistricts !== undefined;

  if (touchesPublic || touchesArea) {
    const current = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { publicProfile: true, serviceArea: true },
    });
    if (touchesPublic) {
      const base = parsePublicProfile(current?.publicProfile);
      const merged: Record<string, unknown> = {
        ...current?.publicProfile as object,
        ...(input.publicDescription !== undefined ? { description: input.publicDescription } : {}),
        ...(input.services !== undefined ? { services: input.services } : {}),
        ...(input.operatingHours !== undefined ? { operatingHours: input.operatingHours } : {}),
        ...(input.trustBadges !== undefined ? { trustBadges: input.trustBadges.map((label) => ({ label })) } : {}),
        ...(input.instagram !== undefined ? { instagram: input.instagram } : {}),
        ...(input.mapUrl !== undefined ? { mapUrl: input.mapUrl } : {}),
      };
      // pertahankan customers bila ada (Prioritas 3, belum diedit di sini)
      if (base.customers && merged.customers === undefined) merged.customers = base.customers;
      data.publicProfile = merged as Prisma.InputJsonValue;
    }
    if (touchesArea) {
      const baseArea = parseServiceArea(current?.serviceArea);
      data.serviceArea = {
        cities: input.areaCities ?? baseArea.cities ?? [],
        districts: input.areaDistricts ?? baseArea.districts ?? [],
      } as Prisma.InputJsonValue;
    }
  }
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
