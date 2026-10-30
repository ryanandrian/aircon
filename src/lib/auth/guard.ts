/**
 * Auth guard — RBAC & tenant access enforcement.
 * Pure logic (mudah diuji). Dipakai service layer & route handlers.
 * Lihat docs/Security_Model.md
 */
import type { Role, TenantStatus } from "@prisma/client";

export type AuthErrorCode = "UNAUTHORIZED" | "FORBIDDEN";

/**
 * Alasan penolakan yang bisa ditindaklanjuti (opsional).
 * - "NO_SESSION"  : tak ada sesi / user belum terhubung ke usaha → suruh masuk.
 * - "TENANT_BLOCKED": usaha berstatus tak bisa dipakai → alasan = status tenant itu sendiri
 *   (SUSPENDED = tunggakan & bisa bayar; CANCELLED = diatur admin, bukan jalur bayar).
 * Bedakan lewat nilai status, BUKAN lewat mengurai teks pesan.
 */
export type AuthErrorReason = "NO_SESSION" | "TENANT_BLOCKED";

export class AuthError extends Error {
  code: AuthErrorCode;
  /** Alasan opsional — memungkinkan pemanggil membedakan jenis kegagalan tanpa mengurai teks pesan. */
  reason?: AuthErrorReason;
  /** Status tenant bila reason = "TENANT_BLOCKED". */
  tenantStatus?: TenantStatus;
  constructor(code: AuthErrorCode, message: string, reason?: AuthErrorReason, tenantStatus?: TenantStatus) {
    super(message);
    this.name = "AuthError";
    this.code = code;
    if (reason) this.reason = reason;
    if (tenantStatus) this.tenantStatus = tenantStatus;
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
