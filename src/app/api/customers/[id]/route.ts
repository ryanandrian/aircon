/**
 * API /api/customers/[id] — get (GET), update (PATCH), soft delete (DELETE).
 * Validasi Zod di batas API sebelum menyentuh service.
 * Format respons: { data } atau { error: { code, message, details } }.
 *
 * SECURITY: tenantId berasal dari SESSION (requireApiContext), bukan query param.
 */
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { updateCustomerSchema } from "@/lib/validation/customer";
import {
  getCustomer,
  updateCustomer,
  softDeleteCustomer,
  ServiceError,
} from "@/lib/services/customer-service";
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

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(
  req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  const authCtx = await requireApiContext();
  if (authCtx instanceof NextResponse) return authCtx;
  const tenantId = authCtx.tenantId;
  const { id } = await ctx.params;
  try {
    const customer = await getCustomer(tenantId, id);
    return NextResponse.json({ data: customer });
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function PATCH(
  req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  const authCtx = await requireApiContext();
  if (authCtx instanceof NextResponse) return authCtx;
  const tenantId = authCtx.tenantId;
  const { id } = await ctx.params;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return errorResponse(422, "VALIDATION", "Body JSON tidak valid");
  }

  try {
    const input = updateCustomerSchema.parse(json);
    const customer = await updateCustomer(tenantId, id, input);
    return NextResponse.json({ data: customer });
  } catch (err) {
    if (err instanceof ZodError) {
      return errorResponse(422, "VALIDATION", "Data tidak valid", err.issues);
    }
    return handleServiceError(err);
  }
}

export async function DELETE(
  req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  const authCtx = await requireApiContext();
  if (authCtx instanceof NextResponse) return authCtx;
  const tenantId = authCtx.tenantId;
  const { id } = await ctx.params;
  try {
    const customer = await softDeleteCustomer(tenantId, id);
    return NextResponse.json({ data: customer });
  } catch (err) {
    return handleServiceError(err);
  }
}
