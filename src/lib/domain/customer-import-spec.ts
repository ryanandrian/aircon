/**
 * SATU SUMBER definisi impor pelanggan (anti-fosil): dipakai untuk MEMBUAT template .xlsx
 * DAN untuk MEM-PARSE unggahan. Jangan definisikan kolom di dua tempat — ubah di sini saja.
 *
 * Dua "profil" pelanggan berdasarkan CARA BAYAR (bukan menebak profil tenant):
 *  - TUNAI  : pelanggan bayar di tempat (rumahan/sederhana). Kolom ringkas.
 *  - TEMPO  : pelanggan ditagih/transfer (institusi: perusahaan, yayasan, sekolah, dll).
 *             Kolom penuh (PIC keuangan, kantor pusat, NPWP, termin).
 * Tenant BAUR memakai kedua sheet; tenant murni salah satu memakai sheet yang relevan.
 *
 * PURE: tak impor prisma/server-only → aman diuji vitest (import relatif dari test).
 */

export type ImportProfile = "TUNAI" | "TEMPO";

/** Jenis nilai kolom → menentukan validasi + dropdown di Excel. */
export type ColKind = "text" | "phone" | "email" | "enum" | "longtext";

export interface ImportColumn {
  /** key kanonik dipetakan ke field service createCustomer. */
  key: string;
  /** Judul kolom yang tampil di Excel (Bahasa Indonesia, ramah). */
  header: string;
  kind: ColKind;
  required: boolean;
  /** Untuk kind=enum: pasangan [nilaiKanonik, labelTampil]. Label yang ditulis tenant di Excel. */
  options?: Array<[string, string]>;
  /** Default nilai kanonik bila sel kosong (mis. Tipe kosong → PERORANGAN). */
  default?: string;
  /** Lebar kolom Excel. */
  width: number;
  /** Penjelasan singkat (masuk komentar sel + panduan). */
  purpose: string;
  /** Contoh isian benar (untuk panduan). */
  example: string;
}

// ── Opsi enum (SELARAS dgn src/lib/validation/customer.ts — jangan diubah sepihak) ──
export const CATEGORY_OPTS: Array<[string, string]> = [
  ["RUMAH", "Rumah / Perorangan"],
  ["SEKOLAH_KAMPUS", "Sekolah / Kampus"],
  ["MASJID_MUSHOLA", "Masjid / Mushola"],
  ["TOKO_OUTLET", "Toko / Outlet"],
  ["RUKO_RUKAN", "Ruko / Rukan"],
  ["KANTOR_PERUSAHAAN", "Kantor / Perusahaan"],
  ["LAINNYA", "Lainnya"],
];

export const SOURCE_OPTS: Array<[string, string]> = [
  ["REFERRAL", "Referensi"],
  ["WHATSAPP", "WhatsApp"],
  ["WALK_IN", "Datang langsung"],
  ["MARKETING", "Marketing"],
  ["WEBSITE", "Booking online"],
  ["REPEAT", "Servis ulang"],
  ["OTHER", "Lainnya"],
];

/** Termin TEMPO saja (CASH tak ditawarkan di sheet Tempo — sheet ini khusus non-tunai). */
export const TEMPO_OPTS: Array<[string, string]> = [
  ["TEMPO_7", "Tempo 7 hari"],
  ["TEMPO_14", "Tempo 14 hari"],
  ["TEMPO_30", "Tempo 30 hari"],
  ["TEMPO_45", "Tempo 45 hari"],
  ["TEMPO_60", "Tempo 60 hari"],
  ["TEMPO_90", "Tempo 90 hari"],
];

// ── Kolom sheet TUNAI (ringkas) ──
export const TUNAI_COLUMNS: ImportColumn[] = [
  { key: "name", header: "Nama", kind: "text", required: true, width: 26,
    purpose: "WAJIB. Nama pelanggan (orang atau rumah tangga).", example: "Budi Santoso" },
  { key: "phone", header: "No. WhatsApp / HP", kind: "phone", required: true, width: 22,
    purpose: "WAJIB. Nomor untuk kirim faktur & pengingat servis. Boleh 0812… / +62… / 62… — dirapikan otomatis.", example: "081234567890" },
  { key: "address", header: "Alamat", kind: "longtext", required: false, width: 34,
    purpose: "Opsional. Alamat lengkap agar teknisi mudah datang.", example: "Jl. Melati No. 12, Depok" },
  { key: "category", header: "Kategori", kind: "enum", required: false, options: CATEGORY_OPTS, default: "RUMAH", width: 20,
    purpose: "Opsional. Jenis lokasi. Kosong = Rumah / Perorangan.", example: "Rumah / Perorangan" },
  { key: "source", header: "Sumber", kind: "enum", required: false, options: SOURCE_OPTS, default: "OTHER", width: 18,
    purpose: "Opsional. Dari mana pelanggan ini datang (untuk analisa).", example: "Referensi" },
  { key: "notes", header: "Catatan", kind: "longtext", required: false, width: 28,
    purpose: "Opsional. Info tambahan bebas.", example: "Servis 3 bulan sekali" },
];

// ── Kolom sheet TEMPO (institusi / non-tunai, penuh) ──
export const TEMPO_COLUMNS: ImportColumn[] = [
  { key: "name", header: "Nama Institusi", kind: "text", required: true, width: 28,
    purpose: "WAJIB. Nama perusahaan / yayasan / instansi.", example: "PT Sejuk Abadi" },
  { key: "phone", header: "No. WhatsApp / HP", kind: "phone", required: true, width: 22,
    purpose: "WAJIB. Nomor kontak utama institusi.", example: "0215558899" },
  { key: "address", header: "Alamat", kind: "longtext", required: false, width: 32,
    purpose: "Opsional. Alamat lokasi/kantor.", example: "Gedung Menara Lt. 4, Jakarta" },
  { key: "category", header: "Kategori", kind: "enum", required: false, options: CATEGORY_OPTS, default: "KANTOR_PERUSAHAAN", width: 20,
    purpose: "Opsional. Jenis institusi. Kosong = Kantor / Perusahaan.", example: "Kantor / Perusahaan" },
  { key: "topType", header: "Termin Pembayaran", kind: "enum", required: true, options: TEMPO_OPTS, default: "TEMPO_30", width: 18,
    purpose: "WAJIB. Jangka waktu jatuh tempo pembayaran setelah faktur terbit.", example: "Tempo 30 hari" },
  { key: "picFinanceName", header: "PIC Keuangan (Nama)", kind: "text", required: true, width: 22,
    purpose: "WAJIB. Orang yang ditagih / mengurus pembayaran. Tanpa ini tagihan bisa nyasar.", example: "Ibu Rina" },
  { key: "picFinancePhone", header: "PIC Keuangan (HP)", kind: "phone", required: false, width: 20,
    purpose: "Opsional. Nomor PIC keuangan untuk kirim tagihan.", example: "08121234567" },
  { key: "picFinanceEmail", header: "PIC Keuangan (Email)", kind: "email", required: false, width: 24,
    purpose: "Opsional. Email untuk kirim faktur/tagihan.", example: "finance@sejukabadi.co.id" },
  { key: "picWorkName", header: "PIC Lapangan (Nama)", kind: "text", required: false, width: 22,
    purpose: "Opsional. Orang yang dihubungi saat teknisi datang (mis. building management).", example: "Pak Andi" },
  { key: "picWorkPhone", header: "PIC Lapangan (HP)", kind: "phone", required: false, width: 20,
    purpose: "Opsional. Nomor kontak lapangan.", example: "08129876543" },
  { key: "npwp", header: "NPWP", kind: "text", required: false, width: 22,
    purpose: "Opsional. Untuk institusi yang minta faktur pajak.", example: "01.234.567.8-901.000" },
  { key: "email", header: "Email Institusi", kind: "email", required: false, width: 24,
    purpose: "Opsional. Email umum institusi.", example: "info@sejukabadi.co.id" },
  { key: "notes", header: "Catatan", kind: "longtext", required: false, width: 26,
    purpose: "Opsional. Info tambahan (mis. tagih ke kantor pusat).", example: "Tagihan ke pusat" },
];

export function columnsFor(profile: ImportProfile): ImportColumn[] {
  return profile === "TUNAI" ? TUNAI_COLUMNS : TEMPO_COLUMNS;
}

/** Nama sheet data (dipakai template & parser — HARUS sama persis). */
export const SHEET_TUNAI = "Pelanggan Tunai";
export const SHEET_TEMPO = "Pelanggan Tempo";
export const SHEET_PANDUAN = "Panduan (baca dulu)";

export function sheetName(profile: ImportProfile): string {
  return profile === "TUNAI" ? SHEET_TUNAI : SHEET_TEMPO;
}

/** Baris tempat header kolom berada (data mulai baris berikutnya). */
export const HEADER_ROW = 4;
