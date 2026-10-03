import { describe, it, expect } from "vitest";
import {
  collectChecklistGaps,
  type ChecklistGap,
} from "../src/lib/domain/checklist-validation";

/**
 * FASE 1 — Validator checklist WAJIB per layanan.
 * Satu-satunya sumber kebenaran sebelum: tutup sesi / terbit invoice-proforma / status final.
 *
 * Acceptance contract (FASE 0, poin 1-4):
 *  1. tanpa template / tanpa item required  -> tidak ada gap (tidak mengunci)
 *  2. item required belum sah              -> ada gap
 *  3. semua required sah                   -> tidak ada gap
 *  4. item opsional tidak pernah muncul di gap
 */

const tpl = (items: { key: string; label: string; type: string; required: boolean }[]) => items;

function gapsMissingRequired(): ChecklistGap[] {
  // bool false, number kosong, text kosong -> 3 gap
  return collectChecklistGaps({
    label: "Cuci AC",
    items: tpl([
      { key: "a", label: "Matikan unit", type: "bool", required: true },
      { key: "b", label: "Suhu keluar", type: "number", required: true },
      { key: "c", label: "Catatan", type: "text", required: true },
    ]),
    results: { a: { checked: false, value: null }, b: { checked: false, value: "   " }, c: null },
  });
}

describe("collectChecklistGaps — FASE 1 validator", () => {
  it("tanpa item required -> tidak ada gap (checklist sunah: tak mengunci)", () => {
    const gaps = collectChecklistGaps({
      label: "Cuci AC",
      items: tpl([{ key: "a", label: "Opsi", type: "bool", required: false }]),
      results: {},
    });
    expect(gaps).toEqual([]);
  });

  it("template kosong -> tidak ada gap", () => {
    expect(collectChecklistGaps({ label: "X", items: [], results: {} })).toEqual([]);
  });

  it("bool required belum dicentang -> 1 gap", () => {
    const gaps = collectChecklistGaps({
      label: "Cuci AC",
      items: tpl([{ key: "a", label: "Matikan unit", type: "bool", required: true }]),
      results: { a: { checked: false, value: null } },
    });
    expect(gaps).toEqual([{ itemKey: "a", label: "Matikan unit" }]);
  });

  it("bool required tercentang -> lolos", () => {
    const gaps = collectChecklistGaps({
      label: "Cuci AC",
      items: tpl([{ key: "a", label: "Matikan unit", type: "bool", required: true }]),
      results: { a: { checked: true, value: null } },
    });
    expect(gaps).toEqual([]);
  });

  it("number required wajib angka valid (bukan string kosong / bukan angka)", () => {
    const items = tpl([{ key: "b", label: "Suhu", type: "number", required: true }]);
    expect(collectChecklistGaps({ label: "X", items, results: { b: { checked: false, value: "21" } } })).toEqual([]);
    expect(collectChecklistGaps({ label: "X", items, results: { b: { checked: false, value: "" } } })).toHaveLength(1);
    expect(collectChecklistGaps({ label: "X", items, results: { b: { checked: false, value: "   " } } })).toHaveLength(1);
    expect(collectChecklistGaps({ label: "X", items, results: { b: { checked: false, value: "abc" } } })).toHaveLength(1);
    expect(collectChecklistGaps({ label: "X", items, results: { b: { checked: false, value: "NaN" } } })).toHaveLength(1);
    expect(collectChecklistGaps({ label: "X", items, results: { b: { checked: false, value: null } } })).toHaveLength(1);
    expect(collectChecklistGaps({ label: "X", items, results: {} })).toHaveLength(1);
  });

  it("text required wajib non-whitespace", () => {
    const items = tpl([{ key: "c", label: "Catatan", type: "text", required: true }]);
    expect(collectChecklistGaps({ label: "X", items, results: { c: { checked: false, value: "bersih" } } })).toEqual([]);
    expect(collectChecklistGaps({ label: "X", items, results: { c: { checked: false, value: "  \t " } } })).toHaveLength(1);
    expect(collectChecklistGaps({ label: "X", items, results: { c: { checked: false, value: null } } })).toHaveLength(1);
  });

  it("photo required: cukup ada nilai terisi (tampilan photo = input teks pada jalur baru)", () => {
    const items = tpl([{ key: "p", label: "Foto sesudah", type: "photo", required: true }]);
    expect(collectChecklistGaps({ label: "X", items, results: { p: { checked: false, value: "https://x/f.jpg" } } })).toEqual([]);
    expect(collectChecklistGaps({ label: "X", items, results: { p: { checked: false, value: "" } } })).toHaveLength(1);
  });

  it("item OPSIONAL tidak pernah masuk gap meski kosong", () => {
    const gaps = collectChecklistGaps({
      label: "Cuci AC",
      items: tpl([
        { key: "a", label: "Wajib", type: "bool", required: true },
        { key: "opt", label: "Opsional kosong", type: "text", required: false },
      ]),
      results: { a: { checked: true, value: null } },
    });
    expect(gaps).toEqual([]);
  });

  it("semua required sah -> gap kosong (tipe campur)", () => {
    const gaps = collectChecklistGaps({
      label: "Servis",
      items: tpl([
        { key: "a", label: "Selesai", type: "bool", required: true },
        { key: "b", label: "Tekanan", type: "number", required: true },
        { key: "c", label: "Tindakan", type: "text", required: true },
        { key: "d", label: "Foto", type: "photo", required: true },
        { key: "opt", label: "Opsional", type: "text", required: false },
      ]),
      results: {
        a: { checked: true, value: null },
        b: { checked: false, value: "41" },
        c: { checked: false, value: "ganti filter" },
        d: { checked: false, value: "https://x/after.jpg" },
        opt: null,
      },
    });
    expect(gaps).toEqual([]);
  });

  it("semua required belum sah -> gap LENGKAP utk semua item (tak hanya yang pertama)", () => {
    const gaps = gapsMissingRequired();
    expect(gaps).toHaveLength(3);
    expect(gaps.map((g) => g.itemKey)).toEqual(["a", "b", "c"]);
  });

  it("gap membawa label asli (untuk pesan error teknisi HP)", () => {
    const gaps = gapsMissingRequired();
    expect(gaps[0].label).toBe("Matikan unit");
    expect(gaps[1].label).toBe("Suhu keluar");
    expect(gaps[2].label).toBe("Catatan");
  });

  it("tipe tak dikenal (data aneh) -> perlakukan aman: wajib tapi tanpa nilai = gap, ada nilai = lolos", () => {
    const items = tpl([{ key: "z", label: "Aneh", type: "unknown", required: true }]);
    expect(collectChecklistGaps({ label: "X", items, results: { z: { checked: false, value: null } } })).toHaveLength(1);
    expect(collectChecklistGaps({ label: "X", items, results: { z: { checked: false, value: "isi" } } })).toEqual([]);
  });

  it("tipe boolean dari data lama yang salah ketik -> tetap dievaluasi tanpa crash", () => {
    const items = tpl([{ key: "n", label: "Angka", type: "number", required: true }]);
    // value numerik (bukan string) tidak boleh membuat fungsi melempar error
    expect(() => collectChecklistGaps({ label: "X", items, results: { n: { checked: false, value: "12" } } })).not.toThrow();
  });
});
