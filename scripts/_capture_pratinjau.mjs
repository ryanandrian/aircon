/**
 * Capture layar aplikasi (owner demo) untuk isi Pratinjau — headless, viewport HP.
 * Mint cookie sesi (aircon_tech) utk owner demo (jalur getServerContext menerima user ACTIVE by id).
 * Hasil PNG di dogfood-output/pratinjau/. Anda tinggal unggah lewat /admin/landing → Pratinjau.
 */
import crypto from "crypto";
import { chromium } from "playwright";
import fs from "fs";

const OWNER_ID = "cmt2bwnfe000g4o72n2oa2qjx";
const SECRET = process.env.SESSION_SECRET || process.env.CRON_SECRET;
const BASE = "http://localhost:3100";
const OUT = "dogfood-output/pratinjau";
const MAX_AGE = 60 * 60 * 24 * 30;

function makeToken(userId) {
  const exp = Date.now() + MAX_AGE * 1000;
  const body = Buffer.from(`${userId}.${exp}`).toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET).update(body).digest("hex");
  return `${body}.${sig}`;
}

// Layar + judul/keterangan (untuk nama file & referensi caption)
const SCREENS = [
  ["/app", "01-dashboard", "Dashboard Ringkas", "Pantau pekerjaan, pengingat & omzet dari satu layar."],
  ["/app/pelanggan", "02-pelanggan", "Daftar Pelanggan", "Semua pelanggan tercatat rapi, siap dihubungi."],
  ["/app/pekerjaan", "03-pekerjaan", "Kelola Pekerjaan", "Jadwalkan & pantau pekerjaan teknisi real-time."],
  ["/app/layanan", "04-layanan", "Katalog Layanan & Harga", "Harga konsisten, termasuk harga khusus pelanggan."],
  ["/app/faktur", "05-faktur", "Invoice & Proforma", "Faktur profesional otomatis, kirim lewat WhatsApp."],
  ["/app/laporan", "06-laporan", "Laporan Keuangan", "Piutang, penerimaan, dan insentif teknisi otomatis."],
  ["/app/teknisi", "07-teknisi", "Kelola Tim Teknisi", "Atur teknisi & lihat performa masing-masing."],
  ["/app/unit", "08-unit", "Unit AC Pelanggan", "Riwayat tiap unit AC lengkap dengan jadwal servis."],
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 402, height: 874 }, // HP modern
    deviceScaleFactor: 2,
    isMobile: true,
  });
  await ctx.addCookies([{ name: "aircon_tech", value: makeToken(OWNER_ID), url: BASE }]);
  const pg = await ctx.newPage();
  const errs = [];
  pg.on("pageerror", (e) => errs.push(String(e)));

  const manifest = [];
  for (const [route, file, title, caption] of SCREENS) {
    try {
      const resp = await pg.goto(`${BASE}${route}`, { waitUntil: "networkidle", timeout: 30000 });
      await pg.waitForTimeout(1200);
      const status = resp?.status();
      // full page agar seluruh isi layar tertangkap
      await pg.screenshot({ path: `${OUT}/${file}.png`, fullPage: true });
      const bodyLen = (await pg.innerText("body")).length;
      manifest.push({ route, file: `${file}.png`, title, caption, status, bodyLen });
      console.log(`  ${file}: HTTP ${status}, teks ${bodyLen} char`);
    } catch (e) {
      console.log(`  ${file}: GAGAL ${e.message}`);
      manifest.push({ route, file: `${file}.png`, title, caption, error: e.message });
    }
  }
  fs.writeFileSync(`${OUT}/manifest.json`, JSON.stringify(manifest, null, 2));
  console.log("exceptions:", errs.length);
  console.log("MANIFEST:", `${OUT}/manifest.json`);
  await browser.close();
})();
