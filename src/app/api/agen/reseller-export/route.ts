/**
 * Export CSV transfer-massal reseller (AGEN-ONLY, periode berjalan).
 * Kolom siap-transfer: nama · bank · no rekening · atas nama · total komisi.
 * SECURITY: field reseller (name/bank/holder/account) di-escape anti formula-injection
 * (CWE-1236) — sel diawali = + - @ / tab / CR diberi prefix ' agar Excel tak eksekusi rumus.
 * Prefix ' juga menjaga nol-depan nomor rekening sebagai teks.
 */
import { NextResponse } from "next/server";
import { getPartnerSession } from "@/lib/partner/partner-session";
import { resellerBreakdown } from "@/lib/partner/partner-portal-service";

/** Amankan satu sel CSV: netralkan formula + quoting standar. */
function csvCell(value: string | number): string {
  let s = String(value);
  // Anti formula-injection: karakter pemicu rumus di awal → prefix apostrof.
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET() {
  const sess = await getPartnerSession();
  if (sess?.kind !== "agent") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const now = new Date();
  const rows = await resellerBreakdown(sess.id, now);

  const header = ["Nama Reseller", "Bank", "No Rekening", "Atas Nama", "Total Komisi (Rp)"];
  const csvLines = [header.map(csvCell).join(",")];
  for (const r of rows) {
    // Nomor rekening: prefix ' menjaga nol-depan + netralkan formula.
    const account = r.account ? "'" + r.account : "";
    csvLines.push([csvCell(r.name), csvCell(r.bankName), csvCell(account), csvCell(r.holder), csvCell(r.total)].join(","));
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
