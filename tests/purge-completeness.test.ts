import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * T3b — Test KELENGKAPAN purging tenant (anti-fosil, anti-kelewat).
 *
 * Mengapa perlu: purgeTenantData dahulu menutup 15 dari 19 anak FK RESTRICT ke Tenant —
 * 3 di antaranya (CouponRedemption, TenantAttribution, JobPhoto) terlewat dan membuat
 * tenant.delete DITOLAK Postgres → transaksi rollback total → purge tak pernah berhasil.
 * Tanpa test ini, tabel anak BARU yang ditambahkan ke schema akan terlewat diam-diam.
 *
 * Sumber kebenaran = prisma/schema.prisma (dibaca sebagai teks, tanpa DB/Prisma client):
 *   1. Setiap model berkolom `tenantId` (wajib atau optional) harus ditangani oleh
 *      purgeTenantData — kecuali whitelist COMMISSION_LEDGER (buku besar append-only).
 *   2. `tenant.delete` harus perintah TERAKHIR (FK anak → Tenant).
 *   3. Baris kritis urutan-derajat harus hadir: JobPhoto SEBELUM jobOrder,
 *      telemetry/commandLog SEBELUM device.
 *
 * Jika ada model baru terlewat → test GAGAL → ketahuan sebelum deploy, bukan saat purge nyata.
 */

const ROOT = path.resolve(__dirname, "..");
const SCHEMA = readFileSync(path.join(ROOT, "prisma/schema.prisma"), "utf8");
const DUNNING = readFileSync(path.join(ROOT, "src/lib/services/dunning-service.ts"), "utf8");

/**
 * Pengecualian SATU-SATUNYA yang disetujui pemilik: CommissionLedger adalah buku besar
 * komisi APPEND-ONLY (audit keuangan; koreksi via baris reversal). Dibiarkan sebagai arsip.
 * Whitelist ini harus eksplisit — test gagal kalau seseorang menambah pengecualian sembarangan.
 */
const COMMISSION_LEDGER = "CommissionLedger";

/** Parse schema: semua model yang punya kolom `tenantId` (required ATAU optional). */
function modelsWithTenantColumn(): string[] {
  const out: string[] = [];
  const blocks = SCHEMA.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm);
  for (const m of blocks) {
    const [, name, body] = m;
    if (/(^|\n)\s*tenantId\s+String/.test(body)) out.push(name);
  }
  return out;
}

/** Ekstrak model yang benar-benar disentuh purgeTenantData dari source code. */
function modelsPurgedByService(): string[] {
  const start = DUNNING.indexOf("export async function purgeTenantData");
  const end = DUNNING.indexOf("export async function purgeMarkedTenants");
  if (start < 0 || end <= start) {
    throw new Error("fungsi purgeTenantData/purgeMarkedTenants tidak ditemukan utuh di source");
  }
  const body = DUNNING.slice(start, end);
  return [...body.matchAll(/prisma\.(\w+)\.deleteMany/g)].map((m) => m[1]);
}

/** prisma client field (camelCase) → nama model schema (PascalCase). */
function toPascal(camel: string): string {
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

describe("purge tenant — kelengkapan terhadap schema (anti-fosil)", () => {
  it("SEMUA model berkolom tenantId ditangani purge (kecuali whitelist resmi)", () => {
    const required = modelsWithTenantColumn();
    const purged = new Set(modelsPurgedByService().map(toPascal));
    const missed = required.filter((m) => m !== COMMISSION_LEDGER && !purged.has(m));
    if (missed.length) {
      throw new Error(
        `Model berkolom tenantId terlewat dari purgeTenantData: ${missed.join(", ")}`,
      );
    }
    expect(missed).toEqual([]);
  });

  it("whitelist tepat satu: CommissionLedger (append-only) — dan memang berkolom tenantId", () => {
    const white = [COMMISSION_LEDGER];
    expect(white).toEqual(["CommissionLedger"]);
    expect(modelsWithTenantColumn()).toContain(COMMISSION_LEDGER);
    // whitelist tidak boleh dipakai menutupi model lain
    expect(modelsPurgedByService().map(toPascal)).not.toContain(COMMISSION_LEDGER);
  });

  it("tenant.delete = perintah TERAKHIR (FK anak → Tenant pasti terhapus dulu)", () => {
    const start = DUNNING.indexOf("export async function purgeTenantData");
    const end = DUNNING.indexOf("export async function purgeMarkedTenants");
    const body = DUNNING.slice(start, end);
    const last = body.lastIndexOf("prisma.");
    expect(body.slice(last).startsWith("prisma.tenant.delete")).toBe(true);
  });

  it("urutan FK-derajat kritis: JobPhoto SEBELUM jobOrder; telemetry/commandLog SEBELUM device", () => {
    const start = DUNNING.indexOf("export async function purgeTenantData");
    const end = DUNNING.indexOf("export async function purgeMarkedTenants");
    const body = DUNNING.slice(start, end);
    const at = (m: string) => body.indexOf(`prisma.${m}.deleteMany`);
    expect(at("jobPhoto")).toBeGreaterThan(-1);
    expect(at("jobPhoto")).toBeLessThan(at("jobOrder"));
    expect(at("telemetry")).toBeGreaterThan(-1);
    expect(at("telemetry")).toBeLessThan(at("device"));
    expect(at("commandLog")).toBeLessThan(at("device"));
  });

  it("tiga bloker asli sebelumnya kini tercakup (regresi-guard)", () => {
    const purged = new Set(modelsPurgedByService().map(toPascal));
    for (const blocker of ["CouponRedemption", "TenantAttribution", "JobPhoto"]) {
      expect(purged.has(blocker), `${blocker} (FK RESTRICT) wajib dihapus`).toBe(true);
    }
  });
});
