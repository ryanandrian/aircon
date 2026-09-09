/**
 * Default paket — HANYA dipakai untuk SEED awal ke database (PlanConfig).
 * Setelah di-seed, sumber kebenaran = tabel PlanConfig (editable admin).
 * Jangan baca file ini untuk pricing runtime; pakai src/lib/billing/config.ts.
 */
import type { TenantPlan } from "@prisma/client";

export interface PlanSeed {
  plan: TenantPlan;
  displayName: string;
  priceMonthly: number; // IDR, belum termasuk pajak
  taxable: boolean;
  tagline: string;
  sortOrder: number;
  maxAdmins: number | null; // akun ADMIN (staf kantor) selain owner. null = unlimited
  maxTechnicians: number | null; // jumlah TEKNISI saja (admin TIDAK dihitung di sini). null = unlimited
  maxCustomers: number | null;
  maxAcUnits: number | null;
}

/** Nilai default sesuai keputusan bisnis (dapat diubah admin setelah seed). */
export const PLAN_SEEDS: PlanSeed[] = [
  {
    plan: "TRIAL",
    displayName: "Basic",
    priceMonthly: 0,
    taxable: false,
    tagline: "Gratis selamanya untuk usaha AC kecil",
    sortOrder: 0,
    maxAdmins: 0,
    maxTechnicians: 2,
    maxCustomers: 5,
    maxAcUnits: 10,
  },
  {
    plan: "PROFESSIONAL",
    displayName: "Professional",
    priceMonthly: 149_000,
    taxable: true,
    tagline: "Untuk usaha AC yang sedang berkembang",
    sortOrder: 1,
    maxAdmins: 1,
    maxTechnicians: 5,
    maxCustomers: 200,
    maxAcUnits: 500,
  },
  {
    plan: "BUSINESS",
    displayName: "Business",
    priceMonthly: 499_000,
    taxable: true,
    tagline: "Untuk usaha AC skala besar, tanpa batas",
    sortOrder: 2,
    maxAdmins: null, // unlimited
    maxTechnicians: null, // unlimited
    maxCustomers: null,
    maxAcUnits: null,
  },
];

/** Default produk IoT (jual putus) untuk seed. */
export const IOT_PRODUCT_SEED = {
  sku: "AIRCON-IOT-V1",
  name: "Aircon Smart HVAC Device V1",
  description: "Alat monitor & kontrol AC (pasang sendiri, non-invasif).",
  priceUnit: 750_000, // IDR jual putus (dapat diubah admin)
  warrantyDays: 90,
};

export function formatIDR(n: number): string {
  return "Rp" + n.toLocaleString("id-ID");
}
