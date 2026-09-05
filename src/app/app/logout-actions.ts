"use server";

import { clearOwnerSession } from "@/lib/auth/owner-session";

/** Logout server-side: bersihkan cookie sesi owner (driver google). Aman dipanggil di driver apa pun. */
export async function logoutOwner(): Promise<void> {
  await clearOwnerSession();
}
