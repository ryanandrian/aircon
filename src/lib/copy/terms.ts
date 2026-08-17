/**
 * Terminologi produk — WAJIB pakai bahasa yang dimengerti pemilik & teknisi AC.
 * Hindari jargon software. Sumber acuan copy seluruh UI.
 *
 * Aturan: tenant kita umumnya orang teknik/lapangan, bukan orang IT.
 * Kalimat pendek, kata sehari-hari, langsung ke manfaat uang/pekerjaan.
 */

/** Jargon lama -> istilah yang dipakai di UI. */
export const TERMS = {
  // "Money Loop" -> jangan pernah tampil ke tenant
  moneyLoop: "Pelanggan Datang Lagi",
  repeatOrder: "Servis Berulang",
  reminder: "Pengingat Servis",
  lead: "Calon Pelanggan",
  jobOrder: "Pekerjaan",
  fieldService: "Pekerjaan Lapangan",
  asset: "Unit AC",
  feasibility: "Kelayakan Jadwal",
  dashboard: "Ringkasan",
  performance: "Laporan",
  churn: "Berhenti Langganan",
  provisioning: "Pemasangan Alat",
  telemetry: "Data Alat",
  tenant: "Usaha",
  subscription: "Langganan",
  onboarding: "Pendaftaran",
} as const;

/** Label status pekerjaan (JobStatus) dalam bahasa awam. */
export const JOB_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draf",
  ASSIGNED: "Ditugaskan",
  ACCEPTED: "Diterima Teknisi",
  EN_ROUTE: "Menuju Lokasi",
  ARRIVED: "Tiba di Lokasi",
  IN_PROGRESS: "Sedang Dikerjakan",
  WAITING: "Menunggu",
  COMPLETED: "Selesai",
  CANCELLED: "Dibatalkan",
  RESCHEDULED: "Dijadwalkan Ulang",
};

/** Label jenis layanan dalam bahasa awam. */
export const SERVICE_TYPE_LABEL: Record<string, string> = {
  CLEANING: "Cuci AC",
  REFILL_FREON: "Isi Freon",
  REPAIR: "Perbaikan",
  INSTALL: "Pasang Baru",
  DISMANTLE: "Bongkar",
  INSPECTION: "Pengecekan",
  OTHER: "Lainnya",
};

/** Label status kelayakan jadwal (feasibility) — tanpa istilah teknis. */
export const FEASIBILITY_LABEL: Record<string, { text: string; hint: string }> = {
  FEASIBLE: { text: "Aman", hint: "Jadwal masuk akal, teknisi sempat." },
  RISK: { text: "Mepet", hint: "Masih bisa tapi waktunya ketat." },
  CONFLICT: { text: "Bentrok", hint: "Tidak masuk akal — teknisi tak sempat." },
  UNKNOWN: { text: "Perlu Data", hint: "Lengkapi lokasi/waktu dulu." },
};

/** Label sumber pelanggan. */
export const SOURCE_LABEL: Record<string, string> = {
  REFERRAL: "Rekomendasi",
  WHATSAPP: "WhatsApp",
  WALK_IN: "Datang Langsung",
  MARKETING: "Iklan/Promo",
  WEBSITE: "Website",
  IOT_ALERT: "Alarm Alat",
  REPEAT: "Pelanggan Lama",
  OTHER: "Lainnya",
};
