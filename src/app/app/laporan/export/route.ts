import { tryGetServerContext } from "@/lib/auth/context";
import { prisma } from "@/lib/prisma";
import { getReceiptHistory, exportReceiptHistoryCsv } from "@/lib/services/ar-service";
import { parseMonthKey } from "@/lib/domain/tenant-timezone";

export const dynamic = "force-dynamic";

/**
 * Unduh CSV PENERIMAAN (L10/K16c) — pola persis `/app/layanan/export`:
 * guard OWNER/ADMIN + tenant dari sesi (bukan input), BOM UTF-8 utk Excel.
 *
 * Query:
 *  - ?bulan=YYYY-MM → riwayat hanya bulan itu (baris per bulan + rincian invoice)
 *  - tanpa `bulan`   → seluruh riwayat (baris per bulan saja)
 *  - ?detail=1       → ikut sertakan rincian per invoice (hanya bila bulan ditentukan
 *                      atau seluruh riwayat — keduanya sah utk kebutuhan akuntansi)
 * Nilai `bulan` tidak valid DITOLAK 400 (bukan diam-diam mengunduh bulan lain).
 */
export async function GET(req: Request) {
  const ctx = await tryGetServerContext();
  if (!ctx?.tenantId) return new Response("Unauthorized", { status: 401 });
  if (ctx.role !== "OWNER" && ctx.role !== "ADMIN") return new Response("Forbidden", { status: 403 });

  const url = new URL(req.url);
  const rawBulan = url.searchParams.get("bulan");
  const detail = url.searchParams.get("detail") === "1";

  let monthKey: string | null = null;
  if (rawBulan !== null) {
    monthKey = parseMonthKey(rawBulan);
    if (!monthKey) return new Response("Parameter bulan tidak valid (pakai YYYY-MM).", { status: 400 });
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: ctx.tenantId },
    select: { timezone: true },
  });
  const history = await getReceiptHistory(ctx.tenantId, tenant?.timezone);

  // Tanpa `bulan` → seluruh riwayat; dengan `bulan` → hanya bulan itu.
  const rows = monthKey ? history.filter((r) => r.month === monthKey) : history;
  const csv = exportReceiptHistoryCsv(rows, tenant?.timezone, { detail });
  const today = new Date().toISOString().slice(0, 10);
  const name = monthKey
    ? `penerimaan-${monthKey}-${today}.csv`
    : `penerimaan-semua-bulan-${today}.csv`;
  // BOM agar Excel membaca UTF-8 dengan benar.
  return new Response("\uFEFF" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
    },
  });
}
