import { describe, it, expect } from "vitest";
import { generateCode, isValidCodeShape, extractCode } from "../src/lib/unit-code/code";

describe("unit code generator", () => {
  it("panjang 7, uppercase, charset tanpa ambigu (no 0/O/1/I/L)", () => {
    for (let i = 0; i < 200; i++) {
      const c = generateCode();
      expect(c).toHaveLength(7);
      expect(c).toBe(c.toUpperCase());
      expect(/[01OIL]/.test(c)).toBe(false);
      expect(isValidCodeShape(c)).toBe(true);
    }
  });

  it("cukup acak (200 kode ~ tak dobel)", () => {
    const set = new Set(Array.from({ length: 200 }, () => generateCode()));
    expect(set.size).toBeGreaterThan(195);
  });

  it("isValidCodeShape tolak bentuk salah", () => {
    expect(isValidCodeShape("ABC")).toBe(false); // pendek
    expect(isValidCodeShape("ABCDEF0")).toBe(false); // ada 0
    expect(isValidCodeShape("abcdefg")).toBe(false); // lowercase
    expect(isValidCodeShape("ABCDEFG")).toBe(true);
  });
});

describe("extractCode (dari hasil scan)", () => {
  it("ambil kode dari URL /u/", () => {
    expect(extractCode("https://ac.lumite.biz.id/u/7F3K9M2")).toBe("7F3K9M2");
    expect(extractCode("http://x.test/u/ABCDEFG?y=1")).toBe("ABCDEFG");
  });
  it("terima kode telanjang + uppercase-kan", () => {
    expect(extractCode("7f3k9m2")).toBe("7F3K9M2");
  });
  it("tolak QR asing / bentuk salah", () => {
    expect(extractCode("https://tokopedia.com/produk/123")).toBeNull();
    expect(extractCode("hello world")).toBeNull();
  });
});
