/**
 * Server context — SATU-SATUNYA sumber tenantId + role dari session terverifikasi.
 * Semua Server Component / Action / Route ber-auth memakai ini.
 * Lihat docs/Security_Model.md
 */
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { AuthError } from "@/lib/auth/guard";
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new AuthError("UNAUTHORIZED", "Sesi tidak ditemukan. Silakan masuk.");
  }

  // Petakan user Supabase (by email/phone) ke User domain kita.
  // SECURITY: tenantId berasal dari record server-side, bukan input klien.
  const email = user.email ?? null;
  const phone = user.phone ?? null;

  const domainUser = await prisma.user.findFirst({
    where: {
      status: "ACTIVE",
      OR: [
        ...(email ? [{ email }] : []),
        ...(phone ? [{ phone }] : []),
      ],
    },
  });

  if (!domainUser) {
    throw new AuthError("UNAUTHORIZED", "Akun belum terhubung ke usaha manapun.");
  }

  // SECURITY: blokir seluruh user bila usaha dinonaktifkan karena tunggakan.
  const tenant = await prisma.tenant.findUnique({
    where: { id: domainUser.tenantId },
    select: { status: true },
  });
  if (!tenant || (tenant.status !== "TRIAL" && tenant.status !== "ACTIVE" && tenant.status !== "PAST_DUE")) {
    throw new AuthError(
      "FORBIDDEN",
      "Akun usaha dinonaktifkan karena tunggakan langganan. Hubungi pemilik usaha.",
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
