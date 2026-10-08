/**
 * Server context — SATU-SATUNYA sumber tenantId + role dari session terverifikasi.
 * Semua Server Component / Action / Route ber-auth memakai ini.
 * Lihat docs/Security_Model.md
 */
import { prisma } from "@/lib/prisma";
import { AuthError } from "@/lib/auth/guard";
import { isTenantUsable, tenantBlockedMessage } from "@/lib/billing/gating-pure";
import { getTechSessionUserId } from "@/lib/auth/tech-session";
import { getAuthIdentity } from "@/lib/auth/auth-identity";
import type { Role } from "@prisma/client";

export interface ServerContext {
  userId: string;
  tenantId: string;
  role: Role;
  name: string;
  email: string | null;
}

/**
 * Ambil konteks user aktif. Melempar AuthError UNAUTHORIZED bila tak ada sesi
 * atau user belum terhubung ke tenant.
 */
export async function getServerContext(): Promise<ServerContext> {
  const identity = await getAuthIdentity();

  let domainUser = null;

  if (identity && (identity.email || identity.phone)) {
    // Petakan identitas sesi (by email/phone) ke User domain kita.
    // SECURITY: tenantId berasal dari record server-side, bukan input klien.
    const email = identity.email;
    const phone = identity.phone;
    domainUser = await prisma.user.findFirst({
      where: {
        status: "ACTIVE",
        OR: [
          ...(email ? [{ email }] : []),
          ...(phone ? [{ phone }] : []),
        ],
      },
    });
  }

  // Jalur teknisi (phone+PIN): sesi cookie tertanda. Cookie hanya berisi userId;
  // tenantId/role tetap dibaca dari DB (tak dipercayai dari klien).
  if (!domainUser) {
    const techUserId = await getTechSessionUserId();
    if (techUserId) {
      domainUser = await prisma.user.findFirst({
        where: { id: techUserId, status: "ACTIVE" },
      });
    }
  }

  if (!domainUser) {
    throw new AuthError("UNAUTHORIZED", "Akun belum terhubung ke usaha manapun.");
  }

  // SECURITY: blokir seluruh user bila usaha tidak dapat dipakai (tunggakan / status berhenti).
  // Pesan DIKELUARKAN PER STATUS supaya tidak menyesatkan: SUSPENDED = tunggakan,
  // CANCELLED = diatur admin (bukan tunggakan) → jangan disuruh "perpanjang".
  const tenant = await prisma.tenant.findUnique({
    where: { id: domainUser.tenantId },
    select: { status: true },
  });
  if (!tenant || !isTenantUsable(tenant.status)) {
    throw new AuthError(
      "FORBIDDEN",
      tenant ? tenantBlockedMessage(tenant.status) : "Usaha tidak ditemukan.",
    );
  }

  return {
    userId: domainUser.id,
    tenantId: domainUser.tenantId,
    role: domainUser.role,
    name: domainUser.name,
    email: domainUser.email,
  };
}

/** Versi non-throw untuk pengecekan opsional. */
export async function tryGetServerContext(): Promise<ServerContext | null> {
  try {
    return await getServerContext();
  } catch {
    return null;
  }
}
