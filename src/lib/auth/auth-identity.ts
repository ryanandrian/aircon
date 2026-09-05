/**
 * Sumber identitas sesi (email/phone) yang ABSTRAK terhadap driver auth.
 * - AUTH_DRIVER=google → baca cookie owner (self-host Google OAuth).
 * - AUTH_DRIVER=supabase (default) → baca sesi Supabase.
 *
 * Ini SATU titik percabangan agar getServerContext & platform-admin tak tahu driver-nya.
 * Rollback = flip env AUTH_DRIVER (tanpa ubah kode). Identitas = email (cocok di kedua driver →
 * findDomainUser by email tetap mengenali owner lama).
 */
import "server-only";
import { isGoogleAuthDriver } from "@/lib/auth/google-oauth";
import { getOwnerSessionEmail } from "@/lib/auth/owner-session";

export interface AuthIdentity {
  email: string | null;
  phone: string | null;
}

/** Identitas dari sesi owner/admin sesuai driver aktif (null bila tak ada sesi). */
export async function getAuthIdentity(): Promise<AuthIdentity | null> {
  if (isGoogleAuthDriver()) {
    const email = await getOwnerSessionEmail();
    return email ? { email, phone: null } : null;
  }
  // Driver Supabase (default) — lazy import agar bundle google tak menyeret supabase & sebaliknya.
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { email: user.email ?? null, phone: user.phone ?? null };
}
