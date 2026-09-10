import { tryGetServerContext } from "@/lib/auth/context";
import { generateCustomerTemplate } from "@/lib/services/customer-import-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Unduh template Excel impor pelanggan (3 tab: Panduan + Tunai + Tempo). */
export async function GET() {
  const ctx = await tryGetServerContext();
  if (!ctx) return new Response("Tidak berwenang", { status: 401 });
  if (ctx.role !== "OWNER" && ctx.role !== "ADMIN") return new Response("Tidak berwenang", { status: 403 });

  const buf = await generateCustomerTemplate();
  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="Template_Impor_Pelanggan_Aircon.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
