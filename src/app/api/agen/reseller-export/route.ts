/**
 * Export CSV transfer-massal reseller (AGEN-ONLY, periode berjalan).
 * Kolom siap-transfer: nama · bank · no rekening · atas nama · total komisi.
 * No rekening dibungkus ="..." agar Excel tak buang angka-nol-depan.
 */
import { NextResponse } from "next/server";
import { getPartnerSession } from "@/lib/partner/partner-session";
import { resellerBreakdown } from "@/lib/partner/partner-portal-service";

export async function GET() {
  const sess = await getPartnerSession();
  if (sess?.kind !== "agent") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const now = new Date();
  const rows = await resellerBreakdown(sess.id, now);

  const header = ["Nama Reseller", "Bank", "No Rekening", "Atas Nama", "Total Komisi (Rp)"];
  const csvLines = [header.join(",")];
  for (const r of rows) {
    const cells = [
      r.name, r.bankName,
      `="${r.account}"`, // paksa teks (nol-depan aman)
      r.holder,
      String(r.total),
    ].map((c) => `"${String(c).replace(/"/g, '""')}"`);
    csvLines.push(cells.join(","));
  }
  const csv = "\uFEFF" + csvLines.join("\r\n"); // BOM utk Excel Indonesia

  const period = now.toLocaleDateString("id-ID", { month: "short", year: "numeric" }).replace(/\s/g, "-");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="komisi-reseller-${period}.csv"`,
    },
  });
}
