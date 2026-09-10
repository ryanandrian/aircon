"use server";

import { revalidatePath } from "next/cache";
import { tryGetServerContext } from "@/lib/auth/context";
import { previewCustomerImport, commitCustomerImport } from "@/lib/services/customer-import-service";

/** Ringkasan pratinjau yang aman dikirim ke klien (tanpa objek berat). */
export type ImportPreviewResult =
  | {
      ok: true;
      validCount: number;
      existingCount: number;
      dupInFileCount: number;
      errorCount: number;
      totalRows: number;
      // Sampel untuk ditampilkan (maks 8 tiap kategori).
      sampleValid: Array<{ name: string; phone: string }>;
      sampleErrors: Array<{ excelRow: number; name: string; reason: string }>;
      sampleExisting: Array<{ name: string; phone: string }>;
    }
  | { ok: false; error: string };

const MAX_BYTES = 8 * 1024 * 1024;

function guardFile(file: unknown): { ok: true; file: File } | { ok: false; error: string } {
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "File tidak ditemukan. Pilih file .xlsx dari template." };
  if (file.size > MAX_BYTES) return { ok: false, error: "File terlalu besar (maks 8MB)." };
  const name = file.name.toLowerCase();
  if (!name.endsWith(".xlsx")) return { ok: false, error: "Format harus .xlsx (gunakan template yang diunduh)." };
  return { ok: true, file };
}

/** Pratinjau impor: validasi + dedup, TANPA menyimpan. */
export async function actionImportPreview(formData: FormData): Promise<ImportPreviewResult> {
  const ctx = await tryGetServerContext();
  if (!ctx) return { ok: false, error: "Sesi tidak valid." };
  if (ctx.role !== "OWNER" && ctx.role !== "ADMIN") return { ok: false, error: "Tidak berwenang." };

  const g = guardFile(formData.get("file"));
  if (!g.ok) return g;

  try {
    const buf = Buffer.from(await g.file.arrayBuffer());
    const p = await previewCustomerImport(ctx.tenantId, buf);
    return {
      ok: true,
      validCount: p.valid.length,
      existingCount: p.existing.length,
      dupInFileCount: p.duplicatesInFile.length,
      errorCount: p.errors.length,
      totalRows: p.totalRows,
      sampleValid: p.valid.slice(0, 8).map((r) => ({ name: r.name, phone: r.data.phone ?? "" })),
      sampleErrors: p.errors.slice(0, 8).map((r) => ({ excelRow: r.excelRow, name: r.name, reason: r.errors.join("; ") })),
      sampleExisting: p.existing.slice(0, 8).map((r) => ({ name: r.name, phone: r.data.phone ?? "" })),
    };
  } catch (err) {
    console.error("[actionImportPreview] gagal:", err);
    return { ok: false, error: "Gagal membaca file. Pastikan memakai template Excel yang benar." };
  }
}

export type ImportCommitResult =
  | { ok: true; created: number; skipped: number; failed: number }
  | { ok: false; error: string };

/** Simpan impor: buat pelanggan dari baris valid (re-parse server-side, tak percaya klien). */
export async function actionImportCommit(formData: FormData): Promise<ImportCommitResult> {
  const ctx = await tryGetServerContext();
  if (!ctx) return { ok: false, error: "Sesi tidak valid." };
  if (ctx.role !== "OWNER" && ctx.role !== "ADMIN") return { ok: false, error: "Tidak berwenang." };

  const g = guardFile(formData.get("file"));
  if (!g.ok) return g;

  try {
    const buf = Buffer.from(await g.file.arrayBuffer());
    const res = await commitCustomerImport(ctx.tenantId, buf);
    revalidatePath("/app/pelanggan");
    return { ok: true, ...res };
  } catch (err) {
    console.error("[actionImportCommit] gagal:", err);
    return { ok: false, error: "Gagal menyimpan. Coba lagi atau periksa file." };
  }
}
