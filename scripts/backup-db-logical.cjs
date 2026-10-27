// Backup LOGIS read-only seluruh tabel schema public → JSON (satu file per tabel + manifest).
// Dijalankan di VPS sebelum migrasi. Tidak menulis ke DB. Jumlah baris dicatat untuk verifikasi.
// Pemakaian: node backup-db-logical.cjs <outDir>   (DATABASE_URL dari env proses)
const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

(async () => {
  const outDir = process.argv[2];
  if (!outDir) throw new Error("usage: node backup-db-logical.cjs <outDir>");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL kosong");
  fs.mkdirSync(outDir, { recursive: true, mode: 0o700 });
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  try {
    await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const tables = (await c.query(
      `select tablename from pg_tables where schemaname='public' order by tablename`,
    )).rows.map((r) => r.tablename);
    const manifest = { takenAt: new Date().toISOString(), tables: {} };
    for (const t of tables) {
      const rows = (await c.query(`select * from "${t.replace(/"/g, '""')}"`)).rows;
      const file = path.join(outDir, `${t}.json`);
      fs.writeFileSync(file, JSON.stringify(rows), { mode: 0o600 });
      manifest.tables[t] = rows.length;
    }
    await c.query("COMMIT");
    fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2), { mode: 0o600 });
    console.log(JSON.stringify({ ok: true, tables: tables.length, totalRows: Object.values(manifest.tables).reduce((a, b) => a + b, 0), outDir }));
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    await c.end();
  }
})().catch((e) => { console.error("BACKUP_FAIL", e.message); process.exit(1); });
