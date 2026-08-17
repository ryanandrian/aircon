/**
 * API /api/assets — list (GET) & create (POST).
 * GET mendukung filter ?customerId= untuk daftar asset per pelanggan.
 * Validasi Zod di batas API sebelum menyentuh service.
 * Format respons: { data } atau { error: { code, message, details } }.
 *
 * SECURITY: tenantId berasal dari SESSION (requireApiContext), bukan query param.
 */
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { createAssetSchema } from "@/lib/validation/asset";
import {
  createAsset,
  listAssets,
  listAssetsByCustomer,
} from "@/lib/services/asset-service";
import { ServiceError } from "@/lib/services/customer-service";
import { requireApiContext } from "@/lib/auth/api";

interface ErrorBody {
  error: { code: string; message: string; details?: unknown };
}

function errorResponse(
  status: number,
  code: string,
  message: string,
  details?: unknown,
): NextResponse<ErrorBody> {
  return NextResponse.json({ error: { code, message, details } }, { status });
}

function handleServiceError(err: unknown): NextResponse<ErrorBody> {
  if (err instanceof ServiceError) {
    if (err.code === "NOT_FOUND") {
      return errorResponse(404, err.code, err.message, err.details);
    }
    if (err.code === "CONFLICT") {
      return errorResponse(409, err.code, err.message, err.details);
    }
    return errorResponse(500, err.code, err.message, err.details);
  }
  return errorResponse(
    500,
    "UNEXPECTED",
    "Terjadi kesalahan tak terduga",
    err instanceof Error ? err.message : String(err),
  );
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authCtx = await requireApiContext();
  if (authCtx instanceof NextResponse) return authCtx;
  const tenantId = authCtx.tenantId;

  const sp = req.nextUrl.searchParams;
  const customerId = sp.get("customerId");

  try {
    // Filter per pelanggan bila customerId disertakan.
    if (customerId && customerId.trim().length > 0) {
      const data = await listAssetsByCustomer(tenantId, customerId);
      return NextResponse.json({ data, nextCursor: null });
    }

    const search = sp.get("search") ?? undefined;
    const cursor = sp.get("cursor") ?? undefined;
    const limitRaw = sp.get("limit");
    const limit = limitRaw ? Number(limitRaw) : undefined;

    const result = await listAssets(tenantId, { search, cursor, limit });
    return NextResponse.json({
      data: result.data,
      nextCursor: result.nextCursor,
    });
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const authCtx = await requireApiContext();
  if (authCtx instanceof NextResponse) return authCtx;
  const tenantId = authCtx.tenantId;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return errorResponse(422, "VALIDATION", "Body JSON tidak valid");
  }

  try {
    const input = createAssetSchema.parse(json);
    const asset = await createAsset(tenantId, input);
    return NextResponse.json({ data: asset }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return errorResponse(422, "VALIDATION", "Data tidak valid", err.issues);
    }
    return handleServiceError(err);
  }
}
