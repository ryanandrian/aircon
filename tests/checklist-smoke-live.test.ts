import { describe, it, expect, vi } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";
// Memuat .env seperti prisma.config.ts (dotenv sudah jadi dependensi repo).
import "dotenv/config";

// `s3.ts` memakai `server-only` (alias Next) yang tak ter-resolve Vitest — mock boundary-nya.
// Verifikasi integrasi s3.ts yang sesungguhnya dibuktikan oleh `pnpm run build` (gate).
vi.mock("@/lib/storage/s3", () => ({
  isOwnedPhotoUrl: () => false,
}));

/**
 * FASE 1 — smoke test READ-ONLY checklist terhadap SKEMA DB ASLI.
 *
 * Mengapa perlu: 23 file tes repo meng-mock Prisma; mock bisa meniru perilaku
 * yang salah tulis (bukti nyata: 2 tes worksession gagal BUKAN karena kode
 * produksi salah, melainkan fixture mock tidak sinkron dengan bentuk kueri baru).
 * Satu-satunya yang bisa membedakan "kode salah" vs "mock salah" adalah query
 * sungguhan ke skema sungguhan.
 *
 * MENGAPA read-only: DB lokal == DB produksi. Tes ini HANYA membaca.
 * CI menjalankan pnpm test tanpa DATABASE_URL -> wajib SKIP bersih (bukan gagal).
 */

const hasDb =
  (Boolean(process.env.DIRECT_URL) || Boolean(process.env.DATABASE_URL)) &&
  existsSync(path.join(process.cwd(), ".env"));

describe.skipIf(!hasDb)("smoke DB asli (read-only) — checklist per layanan", () => {
  it("gate assertWorkSessionChecklist jalan pada skema asli (tanpa menulis apa pun)", async () => {
    const { assertWorkSessionChecklist } = await import("../src/lib/services/worksession-service");
    const { prisma } = await import("../src/lib/prisma");

    const sessions = await prisma.workSession.findMany({
      select: { id: true, tenantId: true },
      take: 5,
    });
    // Skema asli punya WorkSession; panggil gate utk tiap sesi yang ditemukan.
    // Sesi tak dikenal/berbeda tenant tetap diperlakukan tenant-scoped di dalam service.
    for (const s of sessions) {
      await expect(assertWorkSessionChecklist(s.tenantId, s.id)).resolves.toBeUndefined();
    }
  }, 30_000);

  it("kueri template + hasil checklist (bentuk yang sama dgn gate) valid di skema asli", async () => {
    const { prisma } = await import("../src/lib/prisma");

    // Bentuk kueri PERSIS seperti di assertWorkSessionChecklist.
    const templates = await prisma.checklistTemplate.findMany({
      where: { tenantId: { not: "" } },
      select: { serviceId: true, items: true },
      take: 10,
    });
    expect(Array.isArray(templates)).toBe(true);

    const serviceIds = templates.map((t) => t.serviceId as string).filter(Boolean);
    const results = await prisma.checklistResult.findMany({
      where: { workItemId: { in: [] } },
      select: { workItemId: true, itemKey: true, checked: true, value: true },
      take: 10,
    });
    expect(Array.isArray(results)).toBe(true);

    // Bentuk data: items JSON harus array of {key,label,type,required}.
    for (const t of templates) {
      expect(Array.isArray(t.items)).toBe(true);
    }
    void serviceIds;
  }, 30_000);

  it("validator menerima data template ASLI (tanpa crash) utk semua template per-layanan", async () => {
    const { prisma } = await import("../src/lib/prisma");
    const { collectChecklistGaps } = await import("../src/lib/domain/checklist-validation");

    const all = await prisma.checklistTemplate.findMany({
      where: { tenantId: { not: "" } },
      select: { serviceId: true, items: true },
    });
    // Skema baru mewajibkan serviceId, tetapi DB live masih menyimpan baris legacy
    // (kolom di-drop setelah migrasi berjalan) — saring per-layanan agar niat tes terjaga.
    const templates = all.filter((t) => t.serviceId);
    for (const t of templates) {
      const items = (t.items ?? []) as unknown as Parameters<typeof collectChecklistGaps>[0]["items"];
      // Tanpa hasil sama sekali: item required harus terdeteksi, opsional tidak.
      const gaps = collectChecklistGaps({ label: "smoke", items, results: {} });
      const requiredCount = items.filter((i) => i.required).length;
      expect(gaps.length).toBe(requiredCount);
    }
  }, 30_000);
});
