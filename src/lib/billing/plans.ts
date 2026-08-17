/**
 * Definisi paket langganan (plans) — sumber tunggal untuk pricing & feature gating.
 * Harga = hipotesis pilot (Rupiah/bulan). Gating ditegakkan di server.
 */
import type { TenantPlan } from "@prisma/client";

export interface PlanFeatures {
  maxTechnicians: number;
  smartScheduling: boolean;
  dynamicReplanning: boolean;
  growthTools: boolean; // calon pelanggan, referral, review, kampanye
  reports: "basic" | "full";
  publicPage: boolean;
  iotAddon: boolean;
}

export interface PlanDef {
  id: TenantPlan;
  name: string;
  priceMonthly: number; // IDR
  tagline: string;
  highlights: string[];
  features: PlanFeatures;
}

export const PLANS: Record<TenantPlan, PlanDef> = {
  STARTER: {
    id: "STARTER",
    name: "Pemula",
    priceMonthly: 199_000,
    tagline: "Untuk usaha AC yang baru mulai rapi",
    highlights: [
      "Kelola pelanggan & unit AC",
      "Atur pekerjaan teknisi harian",
      "Pengingat servis otomatis (pelanggan datang lagi)",
      "Sampai 3 teknisi",
    ],
    features: {
      maxTechnicians: 3,
      smartScheduling: false,
      dynamicReplanning: false,
      growthTools: false,
      reports: "basic",
      publicPage: true,
      iotAddon: true,
    },
  },
  GROWTH: {
    id: "GROWTH",
    name: "Berkembang",
    priceMonthly: 399_000,
    tagline: "Untuk usaha yang mau dapat lebih banyak pelanggan",
    highlights: [
      "Semua fitur Pemula",
      "Penjadwalan pintar (anti bentrok)",
      "Alat cari pelanggan: calon, rekomendasi, ulasan",
      "Laporan lengkap",
      "Sampai 8 teknisi",
    ],
    features: {
      maxTechnicians: 8,
      smartScheduling: true,
      dynamicReplanning: true,
      growthTools: true,
      reports: "full",
      publicPage: true,
      iotAddon: true,
    },
  },
  PRO: {
    id: "PRO",
    name: "Profesional",
    priceMonthly: 699_000,
    tagline: "Untuk usaha AC yang sudah besar",
    highlights: [
      "Semua fitur Berkembang",
      "Penjadwalan ulang otomatis saat lapangan berubah",
      "Teknisi tanpa batas (wajar)",
      "Prioritas dukungan",
    ],
    features: {
      maxTechnicians: 999,
      smartScheduling: true,
      dynamicReplanning: true,
      growthTools: true,
      reports: "full",
      publicPage: true,
      iotAddon: true,
    },
  },
};

export const IOT_ADDON_PRICE_PER_DEVICE = 100_000; // IDR/device/bulan (hipotesis)
export const TRIAL_DAYS = 14;

export function planFeatures(plan: TenantPlan): PlanFeatures {
  return PLANS[plan].features;
}

export function formatIDR(n: number): string {
  return "Rp" + n.toLocaleString("id-ID");
}
