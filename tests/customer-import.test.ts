import { describe, it, expect } from "vitest";
import { parseRow, matchEnum, normalizePhoneLocal, isBlankRow } from "../src/lib/domain/customer-import-parse";
import { TUNAI_COLUMNS, TEMPO_COLUMNS, columnsFor } from "../src/lib/domain/customer-import-spec";

describe("customer-import-parse — normalisasi & validasi", () => {
  it("normalizePhoneLocal: 0/62/+62 → 62…", () => {
    expect(normalizePhoneLocal("081234567890")).toBe("6281234567890");
    expect(normalizePhoneLocal("+62 812-3456-7890")).toBe("6281234567890");
    expect(normalizePhoneLocal("6281234567890")).toBe("6281234567890");
  });

  it("isBlankRow: semua kosong = true", () => {
    expect(isBlankRow(["", null, undefined, "  "])).toBe(true);
    expect(isBlankRow(["Budi", "", ""])).toBe(false);
  });

  it("TUNAI: baris valid minimal (nama+nomor)", () => {
    const cells = ["Budi", "081234567890", "", "", "", ""];
    const r = parseRow("TUNAI", cells, 5);
    expect(r.status).toBe("valid");
    expect(r.phoneNorm).toBe("6281234567890");
    expect(r.data.name).toBe("Budi");
    expect(r.data.customerType).toBeUndefined(); // TUNAI tak paksa BADAN
  });

  it("TUNAI: nomor kosong → error menunjuk kolom", () => {
    const r = parseRow("TUNAI", ["Budi", "", "", "", "", ""], 7);
    expect(r.status).toBe("error");
    expect(r.errors.join()).toMatch(/No. WhatsApp/);
  });

  it("TUNAI: nomor tak valid (huruf) → error", () => {
    const r = parseRow("TUNAI", ["Budi", "abc", "", "", "", ""], 8);
    expect(r.status).toBe("error");
    expect(r.errors.join()).toMatch(/tidak valid/);
  });

  it("enum: terima label ATAU nilai kanonik, case-insensitive", () => {
    const cat = TUNAI_COLUMNS.find((c) => c.key === "category")!;
    expect(matchEnum(cat, "Rumah / Perorangan")).toBe("RUMAH");
    expect(matchEnum(cat, "rumah")).toBe("RUMAH");
    expect(matchEnum(cat, "SEKOLAH_KAMPUS")).toBe("SEKOLAH_KAMPUS");
    expect(matchEnum(cat, "")).toBe("RUMAH"); // default
    expect(matchEnum(cat, "planet mars")).toBe(null); // tak dikenal
  });

  it("enum tak dikenal → error, bukan diam-diam salah", () => {
    const r = parseRow("TUNAI", ["Budi", "0812345678", "", "Planet Mars", "", ""], 9);
    expect(r.status).toBe("error");
    expect(r.errors.join()).toMatch(/Kategori/);
  });

  it("TEMPO: paksa customerType=BADAN + termin & PIC keuangan wajib", () => {
    // urutan kolom TEMPO: name, phone, address, category, topType, picFinanceName, ...
    const cells = ["PT Maju", "0215558899", "Jkt", "Kantor / Perusahaan", "Tempo 30 hari", "Ibu Rina", "", "", "", "", "", "", ""];
    const r = parseRow("TEMPO", cells, 5);
    expect(r.status).toBe("valid");
    expect(r.data.customerType).toBe("BADAN");
    expect(r.data.topType).toBe("TEMPO_30");
    expect(r.data.picFinanceName).toBe("Ibu Rina");
  });

  it("TEMPO: PIC Keuangan kosong → error (wajib)", () => {
    const cells = ["PT Maju", "0215558899", "", "", "Tempo 30 hari", "", "", "", "", "", "", "", ""];
    const r = parseRow("TEMPO", cells, 6);
    expect(r.status).toBe("error");
    expect(r.errors.join()).toMatch(/PIC Keuangan/);
  });

  it("TEMPO: email PIC tak valid → error", () => {
    const cells = ["PT Maju", "0215558899", "", "", "Tempo 30 hari", "Rina", "", "bukan-email", "", "", "", "", ""];
    const r = parseRow("TEMPO", cells, 7);
    expect(r.status).toBe("error");
    expect(r.errors.join()).toMatch(/Email/);
  });

  it("columnsFor konsisten dgn jumlah kolom", () => {
    expect(columnsFor("TUNAI")).toBe(TUNAI_COLUMNS);
    expect(columnsFor("TEMPO")).toBe(TEMPO_COLUMNS);
    expect(TUNAI_COLUMNS[0].key).toBe("name");
    expect(TUNAI_COLUMNS[1].key).toBe("phone");
  });
});
