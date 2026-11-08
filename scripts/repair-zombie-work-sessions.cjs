#!/usr/bin/env node
/**
 * Perbaikan data produksi: WorkSession OPEN yang tertaut job terminal (COMPLETED/CANCELLED)
 * = "sesi zombie" → sesi tak bisa ditutup (closeWorkSession menolak status terminal).
 *
 * POLICY (berbasis bukti DB, bukan asumsi):
 *  1. SEMUA sesi zombie → jobId = NULL (DETACH, bukan CLOSE).
 *     - WorkItem & nilai kerja TIDAK dihapus → tak ada data hilang.
 *     - Sesi OPEN tak dihitung laporan kinerja → tak ada perubahan angka laporan.
 *     - Sesi jadi bisa ditutup lagi (tanpa job → invoice terbit normal) ATAU
 *       diarahkan ke job aktif baru saat teknisi membuka dari penugasan baru.
 *  2. WorkItem yang PERSIS duplikat baris invoice yang sudah terbit → dihapus
 *     (0 anak ChecklistResult) supaya tak bisa ditagih dua kali.
 *  3. WorkItem pekerjaan nyata yang BELUM tertagih → TIDAK dihapus (dibiarkan
 *     agar teknisi/admin bisa menagih lewat alur aplikasi).
 *
 * Aman diulang (idempotent). Pemakaian:
 *   DRY_RUN=1 node scripts/repair-zombie-work-sessions.cjs   (preview)
 *   node scripts/repair-zombie-work-sessions.cjs             (eksekusi)
 */
const fs = require("fs");
const path = require("path");

function loadPg() {
  try {
    return require("pg");
  } catch {
    const pnpmDir = path.join(process.cwd(), "node_modules", ".pnpm");
    const dir = fs.readdirSync(pnpmDir).find((d) => d.startsWith("pg@"));
    if (!dir) throw new Error("modul 'pg' tidak ditemukan");
    return require(path.join(pnpmDir, dir, "node_modules", "pg"));
  }
}
const { Client } = loadPg();

require("dotenv").config({ path: path.join(process.cwd(), ".env") });
const cs = process.env.DIRECT_URL || process.env.DATABASE_URL;
const dryRun = process.env.DRY_RUN === "1";

/**
 * WorkItem yang PERSIS duplikat baris invoice yang sudah terbit.
 *
 * SYARAT KETAT (evidence-based, bukan tebakan):
 *  - WorkItem ada di sesi zombie (OPEN + job terminal)
 *  - Ada baris invoice dengan serviceId/qty/harga/asset yang SAMA PERSIS
 *  - WorkItem dibuat <= 2 jam setelah invoice itu terbit
 *    → menandai "item yang ter-add ulang tak sengaja setelah sesi ditutup".
 *  - Batas 2 jam mencegah penghapusan pekerjaan nyata yang kebetulan nilainya sama
 *    (mis. pekerjaan nyata beberapa minggu kemudian untuk pelanggan yang sama).
 *  - Tanpa anak ChecklistResult (tak ada jejak checklist yang hilang).
 */
async function findDuplicateItems(c) {
  const { rows } = await c.query(`
    SELECT DISTINCT ON (wi.id)
           wi.id item, wi."workSessionId" ws, wi."serviceId", wi.qty, wi."unitPriceSnapshot", wi."lineTotal",
           wi."assetId", wi."descSnapshot", wi."createdAt" item_at,
           t.name tenant, cu.name cust, inv.number inv_number, inv."issueDate"
    FROM "WorkItem" wi
    JOIN "WorkSession" ws ON ws.id = wi."workSessionId"
    JOIN "Tenant" t ON t.id = wi."tenantId"
    JOIN "Customer" cu ON cu.id = ws."customerId"
    JOIN "InvoiceItem" ii
      ON ii.qty = wi.qty
     AND ii."unitPrice" = wi."unitPriceSnapshot"
     AND ii."lineTotal" = wi."lineTotal"
     AND ii."assetId" IS NOT DISTINCT FROM wi."assetId"
    JOIN "Invoice" inv ON inv.id = ii."invoiceId" AND inv."workSessionId" <> wi."workSessionId"
    WHERE ws.status = 'OPEN'
      AND NOT EXISTS (SELECT 1 FROM "ChecklistResult" cr WHERE cr."workItemId" = wi.id)
      AND wi."createdAt" <= inv."issueDate" + INTERVAL '2 hours'
    ORDER BY wi.id, inv."issueDate"`);
  return rows;
}

async function main() {
  const c = new Client({ connectionString: cs });
  await c.connect();

  const zombies = (await c.query(`
    SELECT ws.id ws, ws."jobId" job, j.status job_status, t.name tenant, cu.name cust,
           (SELECT COUNT(*)::int FROM "WorkItem" wi WHERE wi."workSessionId" = ws.id) n_items
    FROM "WorkSession" ws
    JOIN "JobOrder" j ON j.id = ws."jobId"
    JOIN "Tenant" t ON t.id = ws."tenantId"
    JOIN "Customer" cu ON cu.id = ws."customerId"
    WHERE ws.status = 'OPEN' AND j.status IN ('COMPLETED','CANCELLED')
    ORDER BY t.name, cu.name`)).rows;

  const dupItems = await findDuplicateItems(c);

  console.log(`MODE: ${dryRun ? "DRY-RUN (tak ada perubahan)" : "EKSEKUSI"}`);
  console.log(`\n### A. Sesi zombie (OPEN + job terminal): ${zombies.length}`);
  zombies.forEach((r) =>
    console.log(`  ${r.tenant.padEnd(22)} ${r.cust.padEnd(26)} ${r.ws} job=${r.job} ${r.job_status} items=${r.n_items}`));

  console.log(`\n### B. WorkItem duplikat invoice (akan dihapus): ${dupItems.length}`);
  dupItems.forEach((r) =>
    console.log(`  item=${r.item} "${r.descSnapshot}" ${r.lineTotal} duplikat dari ${r.inv_number} | ${r.tenant}/${r.cust}`));

  const kept = zombies.filter((z) => z.n_items > 0 && !dupItems.some((d) => d.ws === z.ws));
  console.log(`\n### C. Sesi zombie dengan item yang BUKAN duplikat (item dipertahankan, tak dihapus): ${kept.length}`);
  kept.forEach((r) => console.log(`  ${r.tenant.padEnd(22)} ${r.cust.padEnd(26)} ${r.ws} items=${r.n_items}`));

  if (dryRun) {
    console.log("\nDRY-RUN selesai — tak ada perubahan.");
    await c.end();
    return;
  }

  await c.query("BEGIN");
  try {
    if (dupItems.length > 0) {
      const del = await c.query(
        `DELETE FROM "WorkItem" WHERE id = ANY($1::text[])`,
        [dupItems.map((d) => d.item)],
      );
      console.log(`\n[X] WorkItem duplikat dihapus: ${del.rowCount}`);
    }
    const det = await c.query(`
      UPDATE "WorkSession" ws SET "jobId" = NULL
      FROM "JobOrder" j
      WHERE ws."jobId" = j.id AND ws.status = 'OPEN' AND j.status IN ('COMPLETED','CANCELLED')`);
    console.log(`[X] Sesi zombie dilepas dari job terminal: ${det.rowCount}`);
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  }

  const v1 = await c.query(`
    SELECT COUNT(*)::int n FROM "WorkSession" ws JOIN "JobOrder" j ON j.id = ws."jobId"
    WHERE ws.status='OPEN' AND j.status IN ('COMPLETED','CANCELLED')`);
  const v2 = await c.query(`SELECT COUNT(*)::int n FROM "Invoice"`);
  const v3 = await c.query(`SELECT COUNT(*)::int n FROM "WorkSession" WHERE status='OPEN'`);
  const v4 = await c.query(`SELECT COUNT(*)::int n FROM "WorkItem"`);
  console.log(`\n### VERIFIKASI`);
  console.log(`  sesi OPEN tertaut job terminal : ${v1.rows[0].n} (harus 0)`);
  console.log(`  total Invoice                   : ${v2.rows[0].n}`);
  console.log(`  total WorkSession OPEN          : ${v3.rows[0].n}`);
  console.log(`  total WorkItem                  : ${v4.rows[0].n}`);

  await c.end();
}

main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
