/**
 * Auth guard — RBAC & tenant access enforcement.
 * Pure logic (mudah diuji). Dipakai service layer & route handlers.
 * Lihat docs/Security_Model.md
 */
import type { Role } from "@prisma/client";

export type AuthErrorCode = "UNAUTHORIZED" | "FORBIDDEN";

export class AuthError extends Error {
  code: AuthErrorCode;
  constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.name = "AuthError";
    this.code = code;
  }
}

/** Lempar AuthError FORBIDDEN bila role tidak termasuk daftar yang diizinkan. */
export function assertRole(role: Role, allowed: Role[]): void {
  if (!allowed.includes(role)) {
    throw new AuthError("FORBIDDEN", `Akses ditolak untuk peran ${role}`);
  }
}

/** True bila konteks tenant sama dengan tenant milik resource. */
export function canAccessTenant(sessionTenantId: string, resourceTenantId: string): boolean {
  return sessionTenantId === resourceTenantId;
}

/** Lempar bila tenant tidak cocok (dipakai saat memuat resource by id). */
export function assertTenant(sessionTenantId: string, resourceTenantId: string): void {
  if (!canAccessTenant(sessionTenantId, resourceTenantId)) {
    throw new AuthError("FORBIDDEN", "Resource bukan milik tenant Anda");
  }
}
