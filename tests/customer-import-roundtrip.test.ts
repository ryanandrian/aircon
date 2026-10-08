import { describe, it, expect, vi, beforeEach } from "vitest";
import ExcelJS from "exceljs";

// `customer-import-service` memakai `server-only` (alias Next) yang tak ter-resolve
// Vitest — mock boundary-nya (pola sama dgn tests/checklist-smoke-live.test.ts).
vi.mock("server-only", () => ({}));

/**
 * ROUND-TRIP impor pelanggan: template YANG DIHASILKAN benar-benar bisa diparse balik
 * oleh parser yang sama, lalu masuk `createCustomer` dengan field benar.
 *
 * Mengapa perlu: tests/customer-import.test.ts hanya menguji parser terhadap array sel
 * tulisan tangan. Yang belum terbukti: (1) template hasil generateCustomerTemplate()
 * terbaca oleh previewCustomerImport(), (2) baris contoh dilewati, (3) commit benar-benar
 * memanggil createCustomer, (4) commit ulang idempoten.
 *
 * DB = MOCK (bukan asli) supaya tes ini boleh MENULIS tanpa menyentuh DB produksi.
 * Jalur nyata ke DB asli dibuktikan gate `pnpm run build` + jalur FE live.
 */
const createdRows: Array<Record<string, unknown>> = [];

vi.mock("@/lib/prisma", () => ({
  prisma: {
    tenant: { findUnique: vi.fn(async () => ({ id: "tenant-roundtrip-test", plan: "TRIAL" })) },
    planConfig: { findUnique: vi.fn(async () => ({ plan: "TRIAL", maxCustomers: 20 })) },
    // Kuota: 0 terpakai → lolos.
    customer: {
      count: vi.fn(async () => 0),
      // Dedup vs DB: kosong → tak ada "existing".
      findMany: vi.fn(async () => []),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        createdRows.push(data);
        return { id: `c_${createdRows.length}`, ...data };
      }),
    },
  },
}));

const T = "tenant-roundtrip-test";

async function svc() {
  return await import("../src/lib/services/customer-import-service");
}

/** Tulis baris data ke sheet pada baris tertentu (nilai array per kolom). */
function writeRow(wb: ExcelJS.Workbook, sheetName: string, row: number, values: unknown[]) {
  const ws = wb.getWorksheet(sheetName);
  if (!ws) throw new Error("sheet tak ada: " + sheetName);
  values.forEach((v, i) => { ws.getRow(row).getCell(i + 1).value = v as never; });
}

async function bufferFrom(wb: ExcelJS.Workbook): Promise<Buffer> {
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe("round-trip template → preview → commit", () => {
  beforeEach(() => { createdRows.length = 0; });

  it("template bawaan terparse TANPA baris valid (baris contoh dilewati, tanpa error)", async () => {
    const { generateCustomerTemplate, previewCustomerImport } = await svc();
    const buf = await generateCustomerTemplate();
    expect(buf.length).toBeGreaterThan(1000);

    const p = await previewCustomerImport(T, buf);
    expect(p.totalRows).toBe(0);
    expect(p.valid).toHaveLength(0);
    expect(p.errors).toHaveLength(0);
    expect(p.existing).toHaveLength(0);
    expect(p.duplicatesInFile).toHaveLength(0);
  }, 30_000);

  it("template punya 3 sheet & header di baris 4 sesuai spec (Panduan/Tunai/Tempo)", async () => {
    const { generateCustomerTemplate } = await svc();
    const spec = await import("../src/lib/domain/customer-import-spec");
    const buf = await generateCustomerTemplate();

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    expect(wb.getWorksheet(spec.SHEET_PANDUAN)).toBeTruthy();
    expect(wb.getWorksheet(spec.SHEET_TUNAI)).toBeTruthy();
    expect(wb.getWorksheet(spec.SHEET_TEMPO)).toBeTruthy();

    const tunai = wb.getWorksheet(spec.SHEET_TUNAI)!;
    spec.TUNAI_COLUMNS.forEach((col, i) => {
      const h = String(tunai.getRow(spec.HEADER_ROW).getCell(i + 1).value ?? "");
      // Wajib ditandai " *"
      expect(h.startsWith(col.header)).toBe(true);
      if (col.required) expect(h).toContain("*");
    });
  }, 30_000);

  it("isi template (TUNAI + TEMPO + baris rusak + duplikat) → preview kategorinya benar", async () => {
    const { generateCustomerTemplate, previewCustomerImport } = await svc();
    const buf = await generateCustomerTemplate();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);

    // TUNAI (kolom: name, phone, address, category, source, notes) — mulai baris 5
    writeRow(wb, "Pelanggan Tunai", 5, ["Budi", "081234567890", "Jl. Melati 12", "Rumah / Perorangan", "Referensi", ""]);
    writeRow(wb, "Pelanggan Tunai", 6, ["Siti", "+62 811-222-3333", "", "", "", ""]);
    writeRow(wb, "Pelanggan Tunai", 7, ["Budi", "081234567890", "", "", "", ""]); // duplikat dlm file
    writeRow(wb, "Pelanggan Tunai", 8, ["TanpaNomor", "", "", "", "", ""]); // error: HP wajib
    writeRow(wb, "Pelanggan Tunai", 9, ["Aneh", "08129999", "", "Planet Mars", "", ""]); // error: enum

    // TEMPO (kolom: name, phone, address, category, topType, picFinanceName, ... 13 kolom)
    writeRow(wb, "Pelanggan Tempo", 5, ["PT Sejuk", "0215558899", "Jkt", "Kantor / Perusahaan",
      "Tempo 30 hari", "Ibu Rina", "", "", "", "", "", "", ""]);

    const p = await previewCustomerImport(T, await bufferFrom(wb));

    expect(p.totalRows).toBe(6); // 5 tunai (baris 5-9) + 1 tempo; baris contoh bawaan terlewat
    expect(p.valid).toHaveLength(3);   // Budi, Siti, PT Sejuk
    expect(p.duplicatesInFile).toHaveLength(1); // baris 7
    expect(p.errors).toHaveLength(2);  // baris 8, 9

    // Valid: normalisasi nomor + field kanonik.
    const budi = p.valid.find((r) => r.name === "Budi")!;
    expect(budi.phoneNorm).toBe("6281234567890");
    expect(budi.data.category).toBe("RUMAH");
    expect(budi.data.source).toBe("REFERRAL");
    const siti = p.valid.find((r) => r.name === "Siti")!;
    expect(siti.phoneNorm).toBe("628112223333");

    // TEMPO: dipaksa BADAN + termin & PIC keuangan terpetakan.
    const pt = p.valid.find((r) => r.name === "PT Sejuk")!;
    expect(pt.data.customerType).toBe("BADAN");
    expect(pt.data.topType).toBe("TEMPO_30");
    expect(pt.data.picFinanceName).toBe("Ibu Rina");

    // Baris error ditolak dengan alasan menunjuk kolom.
    const errNames = p.errors.map((r) => r.name);
    expect(errNames).toContain("TanpaNomor");
    expect(errNames).toContain("Aneh");
    expect(p.errors.find((r) => r.name === "TanpaNomor")!.errors.join()).toMatch(/No\. WhatsApp/);
    expect(p.errors.find((r) => r.name === "Aneh")!.errors.join()).toMatch(/Kategori/);
  }, 30_000);

  it("commit membuat baris via createCustomer dengan field sesuai, lalu idempoten", async () => {
    const { generateCustomerTemplate, commitCustomerImport } = await svc();
    const buf = await generateCustomerTemplate();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    writeRow(wb, "Pelanggan Tunai", 5, ["Budi", "081234567890", "Jl. Melati 12", "Rumah", "Referensi", "catat"]);
    writeRow(wb, "Pelanggan Tempo", 5, ["PT Sejuk", "0215558899", "", "", "Tempo 14 hari", "Ibu Rina", "", "", "", "", "", "", ""]);
    const upload = await bufferFrom(wb);

    const first = await commitCustomerImport(T, upload);
    expect(first.created).toBe(2);
    expect(first.failed).toBe(0);
    expect(createdRows).toHaveLength(2);

    const tunai = createdRows.find((r) => r.name === "Budi")!;
    expect(tunai.tenantId).toBe(T);
    expect(tunai.phone).toBe("6281234567890"); // dinormalisasi createCustomer
    expect(tunai.address).toBe("Jl. Melati 12");
    expect(tunai.category).toBe("RUMAH");
    expect(tunai.source).toBe("REFERRAL");
    expect(tunai.notes).toBe("catat");
    expect(tunai.customerType).toBe("PERORANGAN"); // TUNAI → default createCustomer

    const tempo = createdRows.find((r) => r.name === "PT Sejuk")!;
    expect(tempo.customerType).toBe("BADAN");
    expect(tempo.topType).toBe("TEMPO_14");
    expect(tempo.picFinanceName).toBe("Ibu Rina");

    // Commit ulang: sekarang anggap "existing" (perilaku dedup DB).
    const prismaMod = (await import("@/lib/prisma")) as unknown as {
      prisma: { customer: { findMany: ReturnType<typeof vi.fn> } };
    };
    prismaMod.prisma.customer.findMany.mockImplementation(
      async ({ where }: { where: { phone: { in: string[] } } }) =>
        where.phone.in.map((phone) => ({ phone })),
    );
    const second = await commitCustomerImport(T, upload);
    expect(second.created).toBe(0);
    expect(second.skipped).toBeGreaterThanOrEqual(2);
    expect(createdRows).toHaveLength(2); // tak bertambah
  }, 30_000);

  it("file sampah (bukan xlsx) ditolak parser, bukan crash", async () => {
    const { previewCustomerImport } = await svc();
    await expect(previewCustomerImport(T, Buffer.from("bukan xlsx"))).rejects.toThrow();
  }, 30_000);

  it("sheet template ada tapi judul kolom diubah → DITOLAK (bukan parse salah posisi)", async () => {
    const { generateCustomerTemplate, previewCustomerImport } = await svc();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await generateCustomerTemplate()) as unknown as ArrayBuffer);
    // Ubah judul kolom pertama baris 4 (posisi tetap dipakai parser → meleset bila lolos).
    wb.getWorksheet("Pelanggan Tunai")!.getRow(4).getCell(1).value = "Nama Kolom Asing";

    const p = await previewCustomerImport(T, Buffer.from(await wb.xlsx.writeBuffer()));
    expect(p.valid).toHaveLength(0);                 // tak ada baris yang "lolos" diam-diam
    expect(p.errors.length).toBeGreaterThan(0);
    expect(p.errors[0].errors.join()).toMatch(/tidak sesuai template/);
    expect(p.errors[0].errors.join()).toMatch(/Nama Kolom Asing/);
  }, 30_000);

  it("file .xlsx valid TANPA sheet template → error eksplisit, bukan '0 data' diam-diam", async () => {
    const { previewCustomerImport } = await svc();
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Sheet1");
    ws.getRow(1).getCell(1).value = "Sesuatu yang bukan template Aircon";

    const p = await previewCustomerImport(T, Buffer.from(await wb.xlsx.writeBuffer()));
    expect(p.valid).toHaveLength(0);
    expect(p.errors).toHaveLength(1);
    expect(p.errors[0].errors.join()).toMatch(/Tidak ada sheet/);
    expect(p.errors[0].errors.join()).toMatch(/unduh dulu lewat tombol/);
  }, 30_000);

  it("kuota terlampaui → baris kelebihan ditolak dengan alasan, tak senyap", async () => {
    const { generateCustomerTemplate, commitCustomerImport } = await svc();
    const prismaMod = (await import("@/lib/prisma")) as unknown as {
      prisma: {
        planConfig: { findUnique: ReturnType<typeof vi.fn> };
        customer: { findMany: ReturnType<typeof vi.fn> };
      };
    };
    // Reset mock dedup milik test sebelumnya (persist di lintas test dalam 1 file).
    prismaMod.prisma.customer.findMany.mockImplementation(async () => []);
    // Paket hanya muat 1 pelanggan, sudah terpakai 0 → dari 2 baris valid, hanya 1 yang masuk.
    prismaMod.prisma.planConfig.findUnique.mockResolvedValue({
      plan: "TRIAL", maxCustomers: 1,
    } as never);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await generateCustomerTemplate()) as unknown as ArrayBuffer);
    const ws = wb.getWorksheet("Pelanggan Tunai")!;
    ws.getRow(5).getCell(1).value = "Satu";
    ws.getRow(5).getCell(2).value = "0811111111111";
    ws.getRow(6).getCell(1).value = "Dua";
    ws.getRow(6).getCell(2).value = "0812222222222";

    const res = await commitCustomerImport(T, Buffer.from(await wb.xlsx.writeBuffer()));
    expect(res.created).toBe(1);
    expect(res.failed).toBe(1);                       // kelebihan TIDAK senyap
    expect(res.failureReasons.some((f) => /kuota/.test(f.reason))).toBe(true);
    expect(res.quotaLimit).toBe(1);

    // kembalikan mock utk tes lain
    prismaMod.prisma.planConfig.findUnique.mockResolvedValue({
      plan: "TRIAL", maxCustomers: 20,
    } as never);
  }, 30_000);
});
