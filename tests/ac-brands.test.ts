import { describe, it, expect } from "vitest";
import { normalizeBrand, normalizeModel, AC_BRANDS } from "../src/lib/domain/ac-brands";

describe("normalizeBrand — kerapian data lintas teknisi", () => {
  it("cocokkan varian ejaan ke bentuk kanonik", () => {
    expect(normalizeBrand("daikin")).toBe("Daikin");
    expect(normalizeBrand("DAIKIN")).toBe("Daikin");
    expect(normalizeBrand("  Daikin  ")).toBe("Daikin");
    expect(normalizeBrand("daikinn")).toBe("Daikin"); // salah ketik umum
    expect(normalizeBrand("panasonik")).toBe("Panasonic");
    expect(normalizeBrand("mitsubishi")).toBe("Mitsubishi Electric");
    expect(normalizeBrand("mhi")).toBe("Mitsubishi Heavy");
  });

  it("akronim pendek tetap kapital (LG)", () => {
    expect(normalizeBrand("lg")).toBe("LG");
    expect(normalizeBrand("LG")).toBe("LG");
  });

  it("merek tak dikenal → Title Case ringan (tetap konsisten)", () => {
    expect(normalizeBrand("merkX")).toBe("Merkx");
    expect(normalizeBrand("gree   ac")).toBe("Gree AC");
  });

  it("kosong/whitespace → null", () => {
    expect(normalizeBrand("")).toBeNull();
    expect(normalizeBrand("   ")).toBeNull();
    expect(normalizeBrand(null)).toBeNull();
    expect(normalizeBrand(undefined)).toBeNull();
  });

  it("daftar kanonik memuat merek umum Indonesia", () => {
    expect(AC_BRANDS).toContain("Daikin");
    expect(AC_BRANDS).toContain("Panasonic");
    expect(AC_BRANDS).toContain("Sharp");
  });
});

describe("normalizeModel", () => {
  it("rapikan spasi, jangan ubah huruf (model sensitif)", () => {
    expect(normalizeModel("  FTKQ 25  ")).toBe("FTKQ 25");
    expect(normalizeModel("ftkq")).toBe("ftkq");
  });
  it("kosong → null", () => {
    expect(normalizeModel("")).toBeNull();
    expect(normalizeModel(null)).toBeNull();
  });
});
