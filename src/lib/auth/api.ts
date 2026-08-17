/**
 * Helper auth untuk Route Handlers (API).
 * Menyediakan tenantId + role dari SESSION terverifikasi (bukan query param).
 * Menutup lubang: tenantId tidak boleh berasal dari input klien pada jalur ber-auth.
 * Lihat docs/Security_Model.md
 */
import { NextResponse } from "next/server";
import { getServerContext, type ServerContext } from "@/lib/auth/context";
import { AuthError } from "@/lib/auth/guard";

interface ErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export function apiError(
  status: number,
  code: string,
  message: string,
  details?: unknown,
): NextResponse<ErrorBody> {
  return NextResponse.json({ error: { code, message, details } }, { status });
}

/**
 * Ambil konteks untuk API. Melempar NextResponse 401 bila tak ada sesi.
 * Pemakaian:
 *   const ctx = await requireApiContext();
 *   if (ctx instanceof NextResponse) return ctx; // 401
 */
export async function requireApiContext(): Promise<ServerContext | NextResponse<ErrorBody>> {
  try {
    return await getServerContext();
  } catch (err) {
    if (err instanceof AuthError) {
      return apiError(401, err.code, err.message);
    }
    return apiError(401, "UNAUTHORIZED", "Sesi tidak valid");
  }
}
