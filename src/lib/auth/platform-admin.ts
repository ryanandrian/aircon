/**
 * Platform Admin guard — super-admin tim internal, LINTAS tenant.
 * TERPISAH dari User tenant: dicek via tabel PlatformAdmin (by email, harus active).
 * Lihat docs/Security_Model.md
 */
import { prisma } from "@/lib/prisma";
import { AuthError } from "@/lib/auth/guard";
import { getAuthIdentity } from "@/lib/auth/auth-identity";

export interface PlatformAdminContext {
  email: string;
  name: string;
}

/** True bila email terdaftar sebagai PlatformAdmin yang aktif. */
export async function isPlatformAdmin(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  const admin = await prisma.platformAdmin.findUnique({ where: { email } });
  return admin?.active === true;
}

/**
 * Wajib panggil di SETIAP entry admin platform (layout + tiap action).
 * Ambil email dari sesi Supabase terverifikasi, cek tabel PlatformAdmin.
 * Melempar AuthError UNAUTHORIZED bila bukan admin platform aktif.
 */
export async function requirePlatformAdmin(): Promise<PlatformAdminContext> {
  const identity = await getAuthIdentity();

  const email = identity?.email ?? null;
  if (!email) {
    throw new AuthError("UNAUTHORIZED", "Sesi tidak ditemukan. Silakan masuk.");
  }

  // SECURITY: keanggotaan admin diambil dari record server-side, bukan input klien.
  const admin = await prisma.platformAdmin.findUnique({ where: { email } });
  if (!admin || !admin.active) {
    throw new AuthError("UNAUTHORIZED", "Akses khusus admin platform.");
  }

  return { email: admin.email, name: admin.name };
}
