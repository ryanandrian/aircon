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
import type { Role, TenantStatus } from "@prisma/client";

export interface ServerContext {
  userId: string;
  tenantId: string;
  role: Role;
  name: string;
  email: string | null;
}

export interface BillingRecoveryContext extends ServerContext {
  tenantStatus: TenantStatus;
}

type ResolvedContext = {
  context: ServerContext;
  tenantStatus: TenantStatus | null;
};

/** Resolve verified identity, domain user, and tenant exactly once for both APIs. */
async function resolveContext(): Promise<ResolvedContext> {
  const identity = await getAuthIdentity();
  let domainUser = null;

  if (identity && (identity.email || identity.phone)) {
    // Map session identity to our domain User. Tenant ownership comes from the DB.
    const email = identity.email;
    const phone = identity.phone;
    domainUser = await prisma.user.findFirst({
      where: {
        status: "ACTIVE",
        OR: [...(email ? [{ email }] : []), ...(phone ? [{ phone }] : [])],
      },
    });
  }

  // Technician (phone+PIN) session cookie contains only userId; tenant/role are read from DB.
  if (!domainUser) {
    const techUserId = await getTechSessionUserId();
    if (techUserId) {
      domainUser = await prisma.user.findFirst({
        where: { id: techUserId, status: "ACTIVE" },
      });
    }
  }

  if (!domainUser) {
    throw new AuthError(
      "UNAUTHORIZED",
      "Akun belum terhubung ke usaha manapun.",
      "NO_SESSION",
    );
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: domainUser.tenantId },
    select: { status: true },
  });

  return {
    context: {
      userId: domainUser.id,
      tenantId: domainUser.tenantId,
      role: domainUser.role,
      name: domainUser.name,
      email: domainUser.email,
    },
    tenantStatus: tenant?.status ?? null,
  };
}

/**
 * Ambil konteks user aktif. Melempar AuthError UNAUTHORIZED bila tak ada sesi
 * atau user belum terhubung ke tenant, dan FORBIDDEN untuk tenant tak usable.
 */
export async function getServerContext(): Promise<ServerContext> {
  const { context, tenantStatus } = await resolveContext();
  if (!tenantStatus || !isTenantUsable(tenantStatus)) {
    throw new AuthError(
      "FORBIDDEN",
      tenantStatus ? tenantBlockedMessage(tenantStatus) : "Usaha tidak ditemukan.",
      "TENANT_BLOCKED",
      tenantStatus ?? undefined,
    );
  }
  return context;
}

/**
 * Konteks billing-recovery: mengembalikan konteks + status tenant TANPA melempar
 * untuk status non-usable (SUSPENDED maupun CANCELLED). Konsumen (halaman/aksi
 * Langganan) yang memutuskan apakah status itu boleh membayar: SUSPENDED boleh,
 * CANCELLED tidak. Melempar hanya bila sesi/user/tenant tak ada — tanpa identitas
 * tak ada yang bisa diverifikasi, jadi tak ada alasan membuka halaman apa pun.
 */
export async function getBillingRecoveryContext(): Promise<BillingRecoveryContext> {
  const { context, tenantStatus } = await resolveContext();
  if (!tenantStatus) {
    throw new AuthError("FORBIDDEN", "Usaha tidak ditemukan.", "TENANT_BLOCKED");
  }
  return { ...context, tenantStatus };
}

/** Versi non-throw untuk pengecekan opsional. */
export async function tryGetServerContext(): Promise<ServerContext | null> {
  try {
    return await getServerContext();
  } catch {
    return null;
  }
}
