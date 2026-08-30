import { describe, it, expect, vi, beforeEach } from "vitest";
import { createCustomerSchema, updateCustomerSchema } from "../src/lib/validation/customer";

/** F1.2 — uji field baru invoicing/AR di validasi + resolveBillingCustomer (tenant-scoped, fallback). */

describe("createCustomerSchema — field Fase 1 (kategori/TOP/tipe/pajak/PIC)", () => {
  it("menerima field baru lengkap (pelanggan badan)", () => {
    const r = createCustomerSchema.safeParse({
      name: "PT Sejuk Abadi",
      phone: "0218000001",
      category: "KANTOR_PERUSAHAAN",
      customerType: "BADAN",
      topType: "TEMPO_30",
      npwp: "01.234.567.8-901.000",
      isPphWithholder: true,
      picWorkName: "Pak GA",
      picWorkPhone: "0811",
      picWorkRole: "Building Management",
      picFinanceName: "Bu Keuangan",
      picFinancePhone: "0822",
    });
    expect(r.success).toBe(true);
  });

  it("tetap menerima input lama tanpa field baru (backward-compatible)", () => {
    const r = createCustomerSchema.safeParse({ name: "Ibu Sari", phone: "0812" });
    expect(r.success).toBe(true);
  });

  it("menolak kategori tak dikenal", () => {
    const r = createCustomerSchema.safeParse({ name: "X", phone: "0812", category: "PABRIK" });
    expect(r.success).toBe(false);
  });

  it("menolak topType tak dikenal", () => {
    const r = createCustomerSchema.safeParse({ name: "X", phone: "0812", topType: "TEMPO_120" });
    expect(r.success).toBe(false);
  });

  it("update partial hanya topType valid", () => {
    const r = updateCustomerSchema.safeParse({ topType: "TEMPO_45" });
    expect(r.success).toBe(true);
  });
});

// ---- resolveBillingCustomer (mocked prisma) ----
const store: { customers: any[] } = { customers: [] };
vi.mock("@/lib/prisma", () => ({
  prisma: {
    customer: {
      findFirst: vi.fn(async ({ where }: any) => {
        return (
          store.customers.find(
            (c) =>
              c.id === where.id &&
              c.tenantId === where.tenantId &&
              c.deletedAt === null,
          ) ?? null
        );
      }),
    },
  },
}));
vi.mock("@/lib/services/quota-guard", () => ({ assertQuota: vi.fn(async () => {}) }));
// normalizePhone dipakai customer-service saat create/update — mock pass-through agar resolusi alias @/ tak gagal di test.
vi.mock("@/lib/wa/gateway", () => ({ normalizePhone: (s: string) => s }));

import { resolveBillingCustomer } from "../src/lib/services/customer-service";

beforeEach(() => {
  store.customers = [
    { id: "pusat", tenantId: "t1", name: "Kantor Pusat", billingCustomerId: null, deletedAt: null },
    { id: "cabang", tenantId: "t1", name: "Cabang A", billingCustomerId: "pusat", deletedAt: null },
    { id: "mandiri", tenantId: "t1", name: "Rumah Bu Sari", billingCustomerId: null, deletedAt: null },
    { id: "lintas", tenantId: "t1", name: "Cabang X", billingCustomerId: "milik-t2", deletedAt: null },
  ];
});

describe("resolveBillingCustomer", () => {
  it("tanpa billingCustomerId → tagih ke diri sendiri", async () => {
    const r = await resolveBillingCustomer("t1", "mandiri");
    expect(r.id).toBe("mandiri");
  });

  it("dengan billingCustomerId → tagih ke kantor pusat", async () => {
    const r = await resolveBillingCustomer("t1", "cabang");
    expect(r.id).toBe("pusat");
  });

  it("billingCustomer milik tenant lain → fallback ke diri sendiri (isolasi tenant)", async () => {
    const r = await resolveBillingCustomer("t1", "lintas");
    expect(r.id).toBe("lintas");
  });

  it("customer tak ada → throw", async () => {
    await expect(resolveBillingCustomer("t1", "ghost")).rejects.toThrow();
  });
});
