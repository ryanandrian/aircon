/**
 * UnitCode Service — kelola kode fisik (QR sticker): generate batch, export, bind ke unit.
 * Kode POOL bisa dipesan tenant (tenantId terisi) atau pool global Lumite (tenantId null).
 * Bind = kawinkan kode ke Asset milik tenant (tenant-scoped, aman).
 */
import { prisma } from "@/lib/prisma";
import { generateCode } from "@/lib/unit-code/code";

export class UnitCodeError extends Error {
  code: string;
  constructor(code: string, message: string) { super(message); this.code = code; this.name = "UnitCodeError"; }
}

const MAX_BATCH = 1000;

/**
 * Generate N kode POOL unik untuk tenant (atau global bila tenantId null).
 * Retry saat tabrakan PK (sangat jarang). Kembalikan daftar kode + batchId.
 */
export async function generateBatch(
  tenantId: string | null,
  count: number,
): Promise<{ batchId: string; codes: string[] }> {
  const n = Math.max(1, Math.min(Math.floor(count), MAX_BATCH));
  const batchId = `B${Date.now().toString(36).toUpperCase()}`;
  const codes: string[] = [];

  for (let i = 0; i < n; i++) {
    let inserted = false;
    for (let attempt = 0; attempt < 5 && !inserted; attempt++) {
      const code = generateCode();
      try {
        await prisma.unitCode.create({
          data: { code, status: "POOL", tenantId, batchId },
        });
        codes.push(code);
        inserted = true;
      } catch {
        // tabrakan PK → coba kode lain
      }
    }
    if (!inserted) throw new UnitCodeError("GENERATE_FAILED", "Gagal menghasilkan kode unik, coba lagi");
  }
  return { batchId, codes };
}

export interface UnitCodeRow {
  code: string;
  status: "POOL" | "BOUND";
  assetId: string | null;
  assetLabel: string | null;
  batchId: string | null;
  createdAt: Date;
}

/** Daftar kode milik tenant (POOL yg dipesan + yg sudah BOUND ke unitnya). */
export async function listCodes(tenantId: string): Promise<UnitCodeRow[]> {
  const rows = await prisma.unitCode.findMany({
    where: { tenantId },
    include: { asset: { select: { brand: true, roomLocation: true } } },
    orderBy: { createdAt: "desc" },
    take: 2000,
  });
  return rows.map((r) => ({
    code: r.code,
    status: r.status,
    assetId: r.assetId,
    assetLabel: r.asset ? `${r.asset.brand ?? "AC"}${r.asset.roomLocation ? ` — ${r.asset.roomLocation}` : ""}` : null,
    batchId: r.batchId,
    createdAt: r.createdAt,
  }));
}

/** Export CSV kode (untuk tenant besar cetak sendiri). baseUrl utk kolom URL QR. */
export async function exportCodesCsv(tenantId: string, baseUrl: string, batchId?: string): Promise<string> {
  const rows = await prisma.unitCode.findMany({
    where: { tenantId, ...(batchId ? { batchId } : {}) },
    orderBy: { createdAt: "asc" },
    take: 5000,
  });
  const header = "code,url,status,batchId,createdAt";
  const base = baseUrl.replace(/\/$/, "");
  const lines = rows.map((r) =>
    [r.code, `${base}/u/${r.code}`, r.status, r.batchId ?? "", r.createdAt.toISOString()].join(","),
  );
  return [header, ...lines].join("\n");
}

/**
 * BIND kode ke unit (Asset) milik tenant. tenant-scoped & aman:
 * - kode harus ada, status POOL (belum terikat), dan (tenantId null=pool global ATAU milik tenant ini).
 * - asset harus milik tenant & belum punya kode lain.
 */
export async function bindCode(tenantId: string, rawCode: string, assetId: string): Promise<void> {
  const code = rawCode.trim().toUpperCase();
  const uc = await prisma.unitCode.findUnique({ where: { code } });
  if (!uc) throw new UnitCodeError("NOT_FOUND", "Kode tidak dikenal");
  if (uc.status === "BOUND") throw new UnitCodeError("ALREADY_BOUND", "Kode sudah terpasang ke unit lain");
  if (uc.tenantId !== null && uc.tenantId !== tenantId) {
    throw new UnitCodeError("FORBIDDEN", "Kode milik usaha lain");
  }

  const asset = await prisma.asset.findFirst({
    where: { id: assetId, tenantId, deletedAt: null },
    include: { unitCode: true },
  });
  if (!asset) throw new UnitCodeError("ASSET_NOT_FOUND", "Unit tidak ditemukan");
  if (asset.unitCode) throw new UnitCodeError("ASSET_HAS_CODE", "Unit ini sudah punya kode");

  await prisma.unitCode.update({
    where: { code },
    data: { status: "BOUND", tenantId, assetId, boundAt: new Date() },
  });
}

/** Lepas kode dari unit (kembali ke POOL milik tenant). */
export async function unbindCode(tenantId: string, rawCode: string): Promise<void> {
  const code = rawCode.trim().toUpperCase();
  const uc = await prisma.unitCode.findUnique({ where: { code } });
  if (!uc || uc.tenantId !== tenantId) throw new UnitCodeError("NOT_FOUND", "Kode tidak ditemukan");
  await prisma.unitCode.update({
    where: { code },
    data: { status: "POOL", assetId: null, boundAt: null },
  });
}
