/**
 * Layanan Impor Pelanggan — generate template .xlsx (3 tab) + parse unggahan + commit ke DB.
 * SATU sumber kolom = domain/customer-import-spec (anti-fosil). Server-only (exceljs + prisma).
 */
import "server-only";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { createCustomer } from "@/lib/services/customer-service";
import {
  columnsFor, sheetName, HEADER_ROW, SHEET_PANDUAN, SHEET_TUNAI, SHEET_TEMPO,
  TUNAI_COLUMNS, TEMPO_COLUMNS, type ImportProfile, type ImportColumn,
} from "@/lib/domain/customer-import-spec";
import { parseRow, isBlankRow, type ParsedRow } from "@/lib/domain/customer-import-parse";

const BRAND_D = "FF0369A1";
const REQ = "FF0EA5E9";
const HEAD = "FF0C4A6E";
const EX_FILL = "FFF1F5F9";
const OK = "FF059669";

function styleHeaderCell(cell: ExcelJS.Cell, col: ImportColumn) {
  cell.value = col.header + (col.required ? " *" : "");
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: col.required ? REQ : HEAD } };
  cell.font = { color: { argb: "FFFFFFFF" }, bold: true, size: 11 };
  cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
  cell.note = col.purpose + "\n\nContoh: " + col.example;
}

function buildDataSheet(wb: ExcelJS.Workbook, profile: ImportProfile) {
  const cols = columnsFor(profile);
  const ws = wb.addWorksheet(sheetName(profile), { views: [{ state: "frozen", ySplit: HEADER_ROW }] });

  // Baris 1: judul
  ws.mergeCells(1, 1, 1, cols.length);
  const title = ws.getCell(1, 1);
  title.value = profile === "TUNAI" ? "DATA PELANGGAN TUNAI (bayar di tempat)" : "DATA PELANGGAN TEMPO / INSTITUSI (ditagih)";
  title.font = { bold: true, size: 14, color: { argb: BRAND_D } };
  ws.getRow(1).height = 24;
  // Baris 2: instruksi
  ws.mergeCells(2, 1, 2, cols.length);
  const sub = ws.getCell(2, 1);
  sub.value = "Isi mulai baris 5. Kolom biru = WAJIB. Baca sheet 'Panduan' dulu. Hapus baris contoh (baris 5) sebelum impor. Jangan ubah judul kolom (baris 4).";
  sub.font = { size: 10, color: { argb: "FF64748B" } };
  ws.getRow(2).height = 16;

  // Baris 4: header
  cols.forEach((col, i) => {
    styleHeaderCell(ws.getCell(HEADER_ROW, i + 1), col);
    ws.getColumn(i + 1).width = col.width;
  });
  ws.getRow(HEADER_ROW).height = 30;

  // Baris 5: contoh (italic abu) + penanda hapus di kolom setelah data
  const exRow = HEADER_ROW + 1;
  cols.forEach((col, i) => {
    const c = ws.getCell(exRow, i + 1);
    c.value = col.kind === "enum" ? (col.options?.find(([v]) => v === col.default)?.[1] ?? col.example) : col.example;
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: EX_FILL } };
    c.font = { italic: true, color: { argb: "FF64748B" }, size: 10 };
    c.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
  });
  const marker = ws.getCell(exRow, cols.length + 1);
  marker.value = "← CONTOH (hapus baris ini)";
  marker.font = { italic: true, color: { argb: "FFDC2626" }, size: 9 };

  // Dropdown (data validation) untuk kolom enum, baris 5..1000
  cols.forEach((col, i) => {
    if (col.kind !== "enum" || !col.options) return;
    const labels = col.options.map(([, l]) => l);
    const colLetter = ws.getColumn(i + 1).letter;
    for (let r = HEADER_ROW + 1; r <= 1000; r++) {
      ws.getCell(`${colLetter}${r}`).dataValidation = {
        type: "list", allowBlank: !col.required,
        formulae: [`"${labels.join(",")}"`],
        showErrorMessage: true, errorTitle: "Pilihan tidak valid",
        error: `Pilih salah satu: ${labels.join(", ")}`,
      };
    }
  });
  return ws;
}

function buildGuideSheet(wb: ExcelJS.Workbook) {
  const ws = wb.addWorksheet(SHEET_PANDUAN);
  ws.getColumn(1).width = 4;
  ws.getColumn(2).width = 34;
  ws.getColumn(3).width = 12;
  ws.getColumn(4).width = 70;
  let r = 1;
  const H = (txt: string, size = 13, color = BRAND_D) => {
    ws.mergeCells(r, 1, r, 4);
    const c = ws.getCell(r, 1); c.value = txt;
    c.font = { bold: true, size, color: { argb: color } };
    ws.getRow(r).height = size + 10; r++;
  };
  const P = (txt: string, color = "FF334155", bold = false) => {
    ws.mergeCells(r, 1, r, 4);
    const c = ws.getCell(r, 1); c.value = txt;
    c.font = { size: 11, color: { argb: color }, bold };
    c.alignment = { wrapText: true, vertical: "top" };
    ws.getRow(r).height = 30; r++;
  };
  const gap = () => { r++; };

  H("PANDUAN IMPOR PELANGGAN — AIRCON", 16);
  P("Baca panduan ini dulu, lalu isi sheet data sesuai jenis pelanggan Anda. Anda boleh memakai salah satu atau kedua sheet.", "FF64748B");
  gap();

  H("LANGKAH SINGKAT", 13);
  P("1. Tentukan cara bayar tiap pelanggan: bayar di tempat (TUNAI) atau ditagih/transfer tempo (TEMPO/INSTITUSI).");
  P(`2. Isi sheet "${SHEET_TUNAI}" untuk pelanggan tunai, dan/atau "${SHEET_TEMPO}" untuk institusi.`);
  P("3. Kolom berjudul biru dengan tanda * WAJIB diisi. Kolom lain opsional.");
  P("4. Hapus baris contoh (baris 5) di tiap sheet sebelum mengunggah.");
  P("5. Simpan file, lalu unggah di aplikasi: menu Pelanggan > Impor.");
  P("6. Aplikasi menampilkan pratinjau (berapa valid, duplikat, bermasalah) sebelum benar-benar disimpan.");
  gap();

  H("ATURAN UMUM (berlaku semua sheet)", 12);
  P("• Nomor HP boleh format apa saja (0812…, +62…, 62…, pakai spasi/strip) — dirapikan otomatis ke 62….");
  P("• Nomor yang sama tidak tersimpan dua kali (otomatis dilewati saat impor).");
  P("• Kolom pilihan (Kategori, Termin, dll) memakai dropdown — klik sel, pilih dari daftar, jangan ketik bebas.");
  P("• Data unit AC (merek/PK) TIDAK diisi di sini — dicatat nanti saat servis pertama.");
  gap();

  // Bagian A: field TUNAI
  H(`PENJELASAN KOLOM — SHEET "${SHEET_TUNAI}"`, 12);
  P("Untuk pelanggan yang membayar langsung di tempat (rumahan/perorangan).", "FF64748B");
  ws.getCell(r, 2).value = "Kolom"; ws.getCell(r, 3).value = "Wajib?"; ws.getCell(r, 4).value = "Penjelasan";
  [2, 3, 4].forEach((c) => { const cell = ws.getCell(r, c); cell.font = { bold: true, color: { argb: "FFFFFFFF" } }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEAD } }; });
  r++;
  const fieldRow = (col: ImportColumn) => {
    ws.getCell(r, 2).value = col.header;
    ws.getCell(r, 2).font = { bold: true, size: 10 };
    ws.getCell(r, 3).value = col.required ? "WAJIB" : "opsional";
    ws.getCell(r, 3).font = { size: 10, bold: col.required, color: { argb: col.required ? "FFDC2626" : "FF64748B" } };
    ws.getCell(r, 4).value = col.purpose + "  Contoh: " + col.example;
    ws.getCell(r, 4).font = { size: 10, color: { argb: "FF334155" } };
    ws.getCell(r, 4).alignment = { wrapText: true, vertical: "top" };
    ws.getRow(r).height = 28; r++;
  };
  TUNAI_COLUMNS.forEach(fieldRow);
  gap();

  // Bagian B: field TEMPO
  H(`PENJELASAN KOLOM — SHEET "${SHEET_TEMPO}"`, 12);
  P("Untuk pelanggan institusi (perusahaan, yayasan, sekolah, instansi) yang ditagih / bayar tempo.", "FF64748B");
  ws.getCell(r, 2).value = "Kolom"; ws.getCell(r, 3).value = "Wajib?"; ws.getCell(r, 4).value = "Penjelasan";
  [2, 3, 4].forEach((c) => { const cell = ws.getCell(r, c); cell.font = { bold: true, color: { argb: "FFFFFFFF" } }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEAD } }; });
  r++;
  TEMPO_COLUMNS.forEach(fieldRow);
  gap();
  P("Selesai membaca? Buka sheet data di bawah dan mulai isi. Terima kasih!", OK, true);

  return ws;
}

/** Buat workbook template (3 tab: Panduan → Tunai → Tempo) → Buffer .xlsx. */
export async function generateCustomerTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Aircon";
  wb.created = new Date();
  buildGuideSheet(wb);
  buildDataSheet(wb, "TUNAI");
  buildDataSheet(wb, "TEMPO");
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

// ── Parsing unggahan ──
export interface ImportPreview {
  valid: ParsedRow[];
  duplicatesInFile: ParsedRow[]; // nomor dobel DI DALAM file
  existing: ParsedRow[];          // nomor sudah ada di DB tenant
  errors: ParsedRow[];
  totalRows: number;
}

/** Ambil sel baris data dari worksheet sesuai jumlah kolom profil. */
function rowCells(ws: ExcelJS.Worksheet, rowNum: number, ncol: number): unknown[] {
  const row = ws.getRow(rowNum);
  const cells: unknown[] = [];
  for (let i = 1; i <= ncol; i++) {
    const v = row.getCell(i).value;
    // exceljs bisa mengembalikan objek (rich text / hyperlink / formula) → ambil teks
    if (v && typeof v === "object") {
      const o = v as { text?: string; result?: unknown; richText?: Array<{ text: string }> };
      if (o.richText) cells.push(o.richText.map((t) => t.text).join(""));
      else if (o.text != null) cells.push(o.text);
      else if (o.result != null) cells.push(o.result);
      else cells.push("");
    } else cells.push(v);
  }
  return cells;
}

/**
 * Parse buffer .xlsx → pratinjau tervalidasi + dedup (vs file & vs DB).
 * Tenant-scoped: existing dicek terhadap nomor pelanggan tenant ini saja.
 */
export async function previewCustomerImport(tenantId: string, buf: Buffer): Promise<ImportPreview> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);

  const all: ParsedRow[] = [];
  for (const profile of ["TUNAI", "TEMPO"] as ImportProfile[]) {
    const ws = wb.getWorksheet(profile === "TUNAI" ? SHEET_TUNAI : SHEET_TEMPO);
    if (!ws) continue;
    const ncol = columnsFor(profile).length;
    const last = ws.rowCount;
    for (let rn = HEADER_ROW + 1; rn <= last; rn++) {
      const cells = rowCells(ws, rn, ncol);
      if (isBlankRow(cells)) continue;
      // Lewati baris contoh bawaan (persis nilai contoh Nama)
      const first = String(cells[0] ?? "").trim();
      if (first === "Budi Santoso" || first === "PT Sejuk Abadi") continue;
      all.push(parseRow(profile, cells, rn));
    }
  }

  const totalRows = all.length;
  const errors = all.filter((r) => r.status === "error");
  const okRows = all.filter((r) => r.status === "valid");

  // Dedup dalam file (nomor sama muncul >1x) → yang kedua dst masuk duplicatesInFile.
  const seen = new Set<string>();
  const valid: ParsedRow[] = [];
  const duplicatesInFile: ParsedRow[] = [];
  for (const r of okRows) {
    if (seen.has(r.phoneNorm)) duplicatesInFile.push(r);
    else { seen.add(r.phoneNorm); valid.push(r); }
  }

  // Dedup vs DB tenant.
  const phones = [...seen];
  const existingPhones = new Set<string>();
  if (phones.length) {
    const rows = await prisma.customer.findMany({
      where: { tenantId, deletedAt: null, phone: { in: phones } },
      select: { phone: true },
    });
    for (const c of rows) existingPhones.add(c.phone);
  }
  const existing: ParsedRow[] = [];
  const finalValid: ParsedRow[] = [];
  for (const r of valid) {
    if (existingPhones.has(r.phoneNorm)) existing.push(r);
    else finalValid.push(r);
  }

  return { valid: finalValid, duplicatesInFile, existing, errors, totalRows };
}

/**
 * Commit impor: buat pelanggan dari baris valid (re-parse buffer utk keamanan — tak percaya klien).
 * Idempoten terhadap dedup: cek ulang existing saat commit (hindari balapan).
 * Return jumlah dibuat + dilewati.
 */
export async function commitCustomerImport(tenantId: string, buf: Buffer): Promise<{ created: number; skipped: number; failed: number }> {
  const preview = await previewCustomerImport(tenantId, buf);
  let created = 0, failed = 0;
  const skipped = preview.duplicatesInFile.length + preview.existing.length + preview.errors.length;

  for (const row of preview.valid) {
    try {
      await createCustomer(tenantId, {
        name: row.data.name!,
        phone: row.data.phone!,
        address: row.data.address,
        source: (row.data.source as never) ?? undefined,
        notes: row.data.notes,
        category: (row.data.category as never) ?? undefined,
        customerType: (row.data.customerType as never) ?? undefined,
        topType: (row.data.topType as never) ?? undefined,
        npwp: row.data.npwp,
        picWorkName: row.data.picWorkName,
        picWorkPhone: row.data.picWorkPhone,
        picFinanceName: row.data.picFinanceName,
        picFinancePhone: row.data.picFinancePhone,
        picFinanceEmail: row.data.picFinanceEmail,
        email: row.data.email,
      });
      created++;
    } catch {
      failed++;
    }
  }
  return { created, skipped, failed };
}
