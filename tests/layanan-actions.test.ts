import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Keputusan tambahan — DAFTAR LAYANAN wajib punya harga (standar > 0).
 *
 * Fakta audit: `sanitize()` memakai `Number(raw.standardPrice) || 0`, sehingga form
 * yang kosong tersimpan DIAM-DIAM jadi Rp0 → biaya pekerjaan bisa 0 (menyesatkan,
 * padahal harga resmi = Daftar Layanan / harga khusus pelanggan).
 *
 * Hanya ADA SATU jalur pembuat layanan bagi tenant: `actionCreateCatalog` /
 * `actionUpdateCatalog` (satu-satunya pemanggil `createCatalogItem`; seed demo di luar
 * service dan selalu mengisi harga). Validasi diletakkan di action layer — persis
 * tempat validasi `code` & `name` yang sudah ada (bukan jalur baru).
 */

let session: { tenantId: string; userId: string; role: string; name: string };

const created: any[] = [];
const updated: any[] = [];

vi.mock("@/lib/auth/context", () => ({
  tryGetServerContext: vi.fn(async () => session),
  getServerContext: vi.fn(async () => session),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/services/customer-service", () => ({
  ServiceError: class ServiceError extends Error {
    code: string;
    constructor(code: string, message: string) { super(message); this.code = code; }
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    serviceCatalog: {
      create: vi.fn(async ({ data }: any) => { created.push(data); return { id: "c-new", ...data }; }),
      update: vi.fn(async ({ where, data }: any) => { updated.push({ where, data }); return { id: where.id, ...data }; }),
      findFirst: vi.fn(async () => ({ id: "c1" })),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
  },
}));

import { actionCreateCatalog, actionUpdateCatalog } from "../src/app/app/layanan/actions";

const base = {
  code: "CUC-075",
  name: "Cuci AC Split ¾–1 PK",
  category: "SERVICE",
  standardPrice: 75000,
  unit: "unit",
  description: "",
};

beforeEach(() => {
  session = { tenantId: "t1", userId: "u1", role: "OWNER", name: "Pemilik" };
  created.length = 0;
  updated.length = 0;
  vi.clearAllMocks();
});

describe("actionCreateCatalog — harga wajib (keputusan tambahan)", () => {
  it("harga terisi & > 0 → layanan dibuat", async () => {
    const res = await actionCreateCatalog({ ...base, standardPrice: "75000" });
    expect(res.ok).toBe(true);
    // service mengubah ke Prisma.Decimal (perilaku lama) — nilainya tetap 75000
    expect(Number(created[0].standardPrice)).toBe(75000);
  });

  it("harga KOSONG → DITOLAK (bukan diam-diam jadi 0)", async () => {
    const res = await actionCreateCatalog({ ...base, standardPrice: "" });
    expect(res.ok).toBe(false);
    expect(!res.ok && res.error).toMatch(/[Hh]arga/);
    expect(created).toHaveLength(0); // tidak ada baris tersimpan
  });

  it("harga 0 → DITOLAK", async () => {
    const res = await actionCreateCatalog({ ...base, standardPrice: 0 });
    expect(res.ok).toBe(false);
    expect(created).toHaveLength(0);
  });

  it("harga negatif → DITOLAK", async () => {
    const res = await actionCreateCatalog({ ...base, standardPrice: -1000 });
    expect(res.ok).toBe(false);
    expect(created).toHaveLength(0);
  });

  it("harga bukan angka (teks acak) → DITOLAK, bukan 0", async () => {
    const res = await actionCreateCatalog({ ...base, standardPrice: "abc" });
    expect(res.ok).toBe(false);
    expect(created).toHaveLength(0);
  });

  it("validasi lama TETAP berlaku: kode & nama wajib", async () => {
    const noCode = await actionCreateCatalog({ ...base, code: "" });
    expect(noCode.ok).toBe(false);
    const noName = await actionCreateCatalog({ ...base, name: "" });
    expect(noName.ok).toBe(false);
    expect(created).toHaveLength(0);
  });

  it("role TEKNISI tetap ditolak (guard lama)", async () => {
    session = { tenantId: "t1", userId: "u3", role: "TECHNICIAN", name: "Tukang" };
    const res = await actionCreateCatalog(base);
    expect(res.ok).toBe(false);
    expect(created).toHaveLength(0);
  });
});

describe("actionUpdateCatalog — harga wajib saat memperbarui", () => {
  it("harga terisi & > 0 → tersimpan", async () => {
    const res = await actionUpdateCatalog("c1", { ...base, standardPrice: "100000" });
    expect(res.ok).toBe(true);
    expect(Number(updated[0].data.standardPrice)).toBe(100000);
  });

  it("harga KOSONG/0 saat edit → DITOLAK (data lama tidak tertimpa 0)", async () => {
    for (const bad of ["", 0, -5, "abc"]) {
      updated.length = 0;
      const res = await actionUpdateCatalog("c1", { ...base, standardPrice: bad });
      expect(res.ok).toBe(false);
      expect(updated).toHaveLength(0);
    }
  });
});
