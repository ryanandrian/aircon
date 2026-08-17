/**
 * Access Guard — cegah login/operasi bila usaha (tenant) dinonaktifkan karena tunggakan.
 * Berlaku untuk SEMUA user tenant (owner, admin, teknisi) dan customer tenant.
 */
import { prisma } from "@/lib/prisma";
import { AuthError } from "@/lib/auth/guard";
import { isTenantUsable } from "@/lib/billing/gating-pure";

/**
 * Lempar AuthError FORBIDDEN bila status tenant tidak dapat dipakai
 * (SUSPENDED/CANCELLED). Dipanggil di alur login & pemuatan konteks.
 * SECURITY: tenantId dari record server-side.
 */
export async function assertTenantLoginAllowed(tenantId: string): Promise<void> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { status: true },
  });
  if (!tenant) {
    throw new AuthError("FORBIDDEN", "Usaha tidak ditemukan.");
  }
  if (!isTenantUsable(tenant.status)) {
    throw new AuthError(
      "FORBIDDEN",
      "Akun usaha dinonaktifkan karena tunggakan langganan. Hubungi pemilik usaha untuk memperpanjang.",
    );
  }
}
