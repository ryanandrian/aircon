import { describe, it, expect, vi } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";
// Memuat .env seperti prisma.config.ts (dotenv sudah jadi dependensi repo).
import "dotenv/config";

// `customer-import-service` memakai `server-only` (alias Next) — mock boundary-nya.
// Prisma TIDAK dimock di file ini: yang dicek adalah query bentuk asli terhadap skema asli.
vi.mock("server-only", () => ({}));

/**
 * Smoke READ-ONLY impor pelanggan terhadap SKEMA DB ASLI.
 *
 * Mengapa perlu: tests/customer-import-roundtrip.test.ts memakai prisma mock (boleh menulis
 * tanpa menyentuh DB), tests/customer-import.test.ts hanya parser murni. Yang belum
 * terbukti sebelumnya: apakah bentuk query dedup (previewCustomerImport) dan query kuota
 * (assertQuota) benar-benar jalan di skema Supabase produksi.
 *
 * MENGAPA read-only: DB lokal == DB produksi (Supabase pooler). Tes ini HANYA membaca.
 * CI tanpa DATABASE_URL → wajib SKIP bersih (bukan gagal).
 */
const hasDb =
  (Boolean(process.env.DIRECT_URL) || Boolean(process.env.DATABASE_URL)) &&
  existsSync(path.join(process.cwd(), ".env"));

describe.skipIf(!hasDb)("smoke DB asli (read-only) — impor pelanggan", () => {
  it("previewCustomerImport jalan terhadap DB asli (dedup vs data nyata, tanpa tulis)", async () => {
    const { generateCustomerTemplate, previewCustomerImport } = await import(
      "../src/lib/services/customer-import-service"
    );
    const { prisma } = await import("../src/lib/prisma");

    const tenants = await prisma.tenant.findMany({ select: { id: true, name: true }, take: 5 });
    expect(tenants.length).toBeGreaterThan(0);

    const buf = await generateCustomerTemplate();
    // Template mentah → 0 baris valid; query dedup tetap dieksekusi (phones kosong = dilewati),
    // jadi yang dibuktikan di sini kebacaan workbook + skema tenant.
    for (const t of tenants) {
      const p = await previewCustomerImport(t.id, buf);
      expect(p.totalRows).toBe(0);
      expect(p.errors).toHaveLength(0);
    }
  }, 30_000);

  it("isi template (baris dummy nomor tak terpakai) → query dedup asli terhadap nomor nyata", async () => {
    const { generateCustomerTemplate, previewCustomerImport } = await import(
      "../src/lib/services/customer-import-service"
    );
    const { prisma } = await import("../src/lib/prisma");
    const ExcelJS = (await import("exceljs")).default;

    const tenant = await prisma.tenant.findFirst({ select: { id: true } });
    expect(tenant).toBeTruthy();

    const buf = await generateCustomerTemplate();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    const ws = wb.getWorksheet("Pelanggan Tunai")!;
    // Nomor dummy 12 digit — hampir pasti tak ada di DB; tak menulis apa pun.
    ws.getRow(5).getCell(1).value = "Verifikasi Impor";
    ws.getRow(5).getCell(2).value = "0899000111222";

    const p = await previewCustomerImport(tenant!.id, Buffer.from(await wb.xlsx.writeBuffer()));
    expect(p.totalRows).toBe(1);
    expect(p.valid).toHaveLength(1);
    expect(p.existing).toHaveLength(0);
    expect(p.valid[0].phoneNorm).toBe("62899000111222");
  }, 30_000);

  it("query kuota (assertQuota jalur) jalan di skema asli", async () => {
    const { assertQuota } = await import("../src/lib/services/quota-guard");
    const { prisma } = await import("../src/lib/prisma");
    const tenant = await prisma.tenant.findFirst({ select: { id: true, plan: true } });
    expect(tenant).toBeTruthy();
    // Bila kuota sudah penuh akan melempar QuotaError — keduanya membuktikan query jalan.
    try {
      await assertQuota(tenant!.id, "customers");
    } catch (e) {
      expect((e as { code?: string }).code).toBe("QUOTA_EXCEEDED");
    }
  }, 30_000);
});
