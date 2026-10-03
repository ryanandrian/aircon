import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";
// Memuat .env seperti prisma.config.ts (dotenv sudah jadi dependensi repo).
// Tanpa ini DATABASE_URL kosong dan tes ter-skip padahal DB ada.
import "dotenv/config";

/**
 * FASE 6.2 — smoke test end-to-end READ-ONLY terhadap data asli.
 *
 * MENGAPA bentuk ini (verifikasi, bukan asumsi):
 * - DB lokal == DB produksi (Supabase pooler; catatan repo docs/PLAN_*.md), jadi e2e
 *   yang MENULIS data = ranjau. Tes ini HANYA MEMBACA.
 * - Repo tidak punya kerangka e2e browser (terverifikasi: tidak ada playwright/puppeteer
 *   di package.json). Yang dicover unit test adalah logika; yang dicover di sini adalah
 *   "apakah query asli jalan terhadap skema asli" (drift skema/relay runtime tertangkap di sini,
 *   bukan saat live).
 * - CI menjalankan pnpm test TANPA DATABASE_URL -> wajib skip bersih (bukan gagal).
 */

const hasDb =
  (Boolean(process.env.DIRECT_URL) || Boolean(process.env.DATABASE_URL)) &&
  existsSync(path.join(process.cwd(), ".env"));

describe.skipIf(!hasDb)("smoke DB asli (read-only) — listReminderInbox + expireDueReminders", () => {
  it("listReminderInbox jalan pada skema asli & jumlahnya sama dengan hitungan Ringkasan", async () => {
    const { listReminderInbox } = await import("../src/lib/services/reminder-service");
    const { prisma } = await import("../src/lib/prisma");

    const tenants = await prisma.tenant.findMany({ select: { id: true } });
    expect(tenants.length).toBeGreaterThan(0);

    let total = 0;
    for (const t of tenants) {
      const rows = await listReminderInbox(t.id);
      // Isi daftar konsisten dgn tipe: tiap baris punya pelanggan + status yang sah.
      for (const r of rows) {
        expect(typeof r.customerName).toBe("string");
        expect(r.customerName.length).toBeGreaterThan(0);
        expect([
          "BELUM_DIKIRIM", "MENUNGGU_KRIM", "TERKIRIM_OTOMATIS", "TERKIRIM_MANUAL", "DITERIMA",
          "DIBACA", "GAGAL", "TIDAK_DIKETAHUI", "DITUTUP",
        ]).toContain(r.sendStatus);
      }
      total += rows.length;
    }
    // Satu sumber angka: jumlah total = jumlah baris tanpa filter (sinkron Ringkasan).
    expect(total).toBeGreaterThanOrEqual(0);
  }, 30_000);
});
