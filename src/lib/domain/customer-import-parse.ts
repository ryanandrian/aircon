/**
 * Parser MURNI baris impor pelanggan (tanpa exceljs/prisma) → aman diuji vitest.
 * Mengubah baris mentah (array sel) menjadi record kanonik + validasi + alasan tolak.
 * normalizePhone diambil dari domain/phone-pure agar konsisten & bebas server-only.
 */
import type { ImportColumn, ImportProfile } from "./customer-import-spec";
import { columnsFor } from "./customer-import-spec";

/** Normalisasi nomor ke format WA (62…). Sinkron dgn src/lib/wa/gateway.normalizePhone. */
export function normalizePhoneLocal(raw: string): string {
  let p = String(raw ?? "").replace(/[^0-9]/g, "");
  if (p.startsWith("0")) p = "62" + p.slice(1);
  if (p.startsWith("620")) p = "62" + p.slice(3);
  return p;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ParsedRow {
  /** Nomor baris di Excel (untuk pesan error yang menunjuk baris). */
  excelRow: number;
  /** Record kanonik siap dikirim ke createCustomer (bila valid). */
  data: Record<string, string | undefined>;
  /** Nomor ternormalisasi (kunci dedup). */
  phoneNorm: string;
  /** Nama untuk tampil di pratinjau. */
  name: string;
  status: "valid" | "error";
  /** Alasan bila error (Bahasa Indonesia, menunjuk kolom). */
  errors: string[];
}

/** Cocokkan input tenant ke nilai enum kanonik (terima label ATAU nilai kanonik, case-insensitive). */
export function matchEnum(col: ImportColumn, raw: string): string | null {
  const v = String(raw ?? "").trim();
  if (!v) return col.default ?? null;
  const lc = v.toLowerCase();
  for (const [canon, label] of col.options ?? []) {
    if (lc === canon.toLowerCase() || lc === label.toLowerCase()) return canon;
  }
  return null; // tak cocok → error (biar tenant perbaiki, bukan diam-diam salah)
}

/**
 * Parse satu baris (array sel sesuai urutan kolom profil).
 * excelRow = nomor baris asli untuk pesan.
 */
export function parseRow(profile: ImportProfile, cells: unknown[], excelRow: number): ParsedRow {
  const cols = columnsFor(profile);
  const data: Record<string, string | undefined> = {};
  const errors: string[] = [];
  let phoneNorm = "";

  cols.forEach((col, i) => {
    const raw = cells[i] == null ? "" : String(cells[i]).trim();

    if (col.kind === "phone") {
      const norm = normalizePhoneLocal(raw);
      if (col.required && !raw) errors.push(`${col.header} wajib diisi`);
      else if (raw && (norm.length < 10 || !norm.startsWith("62"))) errors.push(`${col.header} tidak valid ("${raw}")`);
      if (col.key === "phone") phoneNorm = norm;
      data[col.key] = norm || undefined;
      return;
    }

    if (col.kind === "email") {
      if (raw && !EMAIL_RE.test(raw)) errors.push(`${col.header} bukan email valid ("${raw}")`);
      data[col.key] = raw || undefined;
      return;
    }

    if (col.kind === "enum") {
      const matched = matchEnum(col, raw);
      if (col.required && !matched && !raw) errors.push(`${col.header} wajib dipilih`);
      else if (raw && matched === null) errors.push(`${col.header} tak dikenal ("${raw}") — pilih dari daftar`);
      if (matched) data[col.key] = matched;
      return;
    }

    // text / longtext
    if (col.required && !raw) errors.push(`${col.header} wajib diisi`);
    data[col.key] = raw || undefined;
  });

  // Profil TEMPO → paksa customerType BADAN (institusi) — profil TUNAI biarkan default PERORANGAN.
  if (profile === "TEMPO") data.customerType = "BADAN";

  return {
    excelRow,
    data,
    phoneNorm,
    name: data.name || "(tanpa nama)",
    status: errors.length ? "error" : "valid",
    errors,
  };
}

/** Apakah baris benar-benar kosong (semua sel kosong) → dilewati diam-diam, bukan error. */
export function isBlankRow(cells: unknown[]): boolean {
  return cells.every((c) => c == null || String(c).trim() === "");
}
