/**
 * Template default notifikasi platform (Lumite → tenant) — PURE (tanpa server-only/prisma)
 * agar bisa dites & dipakai di mana saja. Editable admin menyusul (override dari DB).
 */
export type PlatformTemplateKey =
  | "welcome"
  | "trial_ending"
  | "subscription_due"
  | "subscription_overdue"
  | "wa_disconnected";

export const PLATFORM_TEMPLATES: Record<PlatformTemplateKey, { subject: string; body: string; label: string }> = {
  welcome: {
    label: "Selamat Datang",
    subject: "Selamat datang di {{app}} 🎉",
    body: "Halo {{tenant}}, terima kasih telah bergabung di {{app}}! Untuk mulai mengirim pengingat servis otomatis ke pelanggan, hubungkan WhatsApp usaha Anda di menu Pengaturan → Hubungkan WhatsApp.",
  },
  trial_ending: {
    label: "Masa Coba Akan Berakhir",
    subject: "Masa coba {{app}} berakhir {{tanggal}}",
    body: "Halo {{tenant}}, masa coba Anda berakhir pada {{tanggal}}. Perpanjang sekarang agar pengingat servis & fitur usaha tetap aktif: {{link}}",
  },
  subscription_due: {
    label: "Tagihan Langganan Jatuh Tempo",
    subject: "Tagihan {{app}} jatuh tempo {{tanggal}}",
    body: "Halo {{tenant}}, langganan {{paket}} Anda jatuh tempo {{tanggal}} sebesar {{nominal}}. Bayar di sini agar layanan tetap berjalan: {{link}}",
  },
  subscription_overdue: {
    label: "Langganan Terlambat",
    subject: "Langganan {{app}} Anda terlambat",
    body: "Halo {{tenant}}, langganan Anda telah lewat jatuh tempo. Perpanjang segera agar akun tidak dinonaktifkan: {{link}}",
  },
  wa_disconnected: {
    label: "WhatsApp Terputus",
    subject: "WhatsApp usaha Anda terputus",
    body: "Halo {{tenant}}, koneksi WhatsApp usaha Anda terputus sehingga pengingat servis ke pelanggan berhenti. Hubungkan ulang (scan QR) di Pengaturan → Hubungkan WhatsApp agar money-loop kembali jalan.",
  },
};
