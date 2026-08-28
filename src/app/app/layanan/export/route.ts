import { tryGetServerContext } from "@/lib/auth/context";
import { exportCustomerPricingCsv } from "@/lib/services/service-catalog-service";

export const dynamic = "force-dynamic";

/** Unduh CSV semua harga khusus pelanggan (K22 audit). Owner/admin tenant. */
export async function GET() {
  const ctx = await tryGetServerContext();
  if (!ctx?.tenantId) return new Response("Unauthorized", { status: 401 });
  if (ctx.role !== "OWNER" && ctx.role !== "ADMIN") return new Response("Forbidden", { status: 403 });

  const csv = await exportCustomerPricingCsv(ctx.tenantId);
  const today = new Date().toISOString().slice(0, 10);
  // BOM agar Excel membaca UTF-8 dengan benar.
  return new Response("\uFEFF" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="harga-khusus-${today}.csv"`,
    },
  });
}
