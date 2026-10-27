/**
 * Template default notifikasi platform (Aircon → tenant) — PURE (tanpa server-only/prisma).
 * Paket Basic (`TRIAL`) gratis selamanya; tidak punya masa trial.
 * Hanya paket `autoReminder=true` boleh menerima CTA koneksi WhatsApp dan klaim otomatis.
 * Placeholder wajib divalidasi sebelum enqueue agar copy rusak tidak pernah dikirim.
 */
export type PlatformTemplateKey =
  | "welcome_basic"
  | "welcome_paid"
  | "subscription_activated"
  | "subscription_due"
  | "subscription_overdue"
  | "payment_failed"
  | "payment_expired"
  | "wa_disconnected";

export interface PlatformTemplate {
  subject: string;
  body: string;
  label: string;
  requiredVars: readonly string[];
}

export const PLATFORM_TEMPLATES: Record<PlatformTemplateKey, PlatformTemplate> = {
  welcome_basic: {
    label: "Sambutan — Paket Basic (Gratis)",
    subject: "Selamat datang di {{app}}",
    body: "Halo {{tenant}}, selamat datang di {{app}}! Paket Basic Anda aktif gratis selamanya, dengan kuota pelanggan dan unit AC sesuai paket. Pengingat servis yang jatuh tempo tersedia di menu Pengingat untuk Anda kirim manual melalui WhatsApp Anda. Pengingat otomatis tersedia di paket Professional dan Business: {{link}}",
    requiredVars: ["tenant", "link"],
  },
  welcome_paid: {
    label: "Sambutan — Paket Berbayar",
    subject: "Selamat datang di {{app}}",
    body: "Halo {{tenant}}, paket {{paket}} Anda aktif. Untuk mulai mengirim pengingat servis otomatis ke pelanggan, sambungkan nomor WhatsApp usaha di Pengaturan → Hubungkan WhatsApp. Pengiriman otomatis dimulai setelah status koneksi tersambung: {{link}}",
    requiredVars: ["tenant", "paket", "link"],
  },
  subscription_activated: {
    label: "Pembayaran Berhasil — Paket Aktif",
    subject: "Pembayaran {{app}} berhasil — {{paket}} aktif",
    body: "Pembayaran berhasil. Paket {{paket}} {{app}} Anda aktif sampai {{tanggal}} sebesar {{nominal}}. {{cta}}Rincian langganan: {{link}}",
    requiredVars: ["paket", "tanggal", "nominal", "cta", "link"],
  },
  subscription_due: {
    label: "Tagihan Langganan Jatuh Tempo",
    subject: "Tagihan {{app}} jatuh tempo {{tanggal}}",
    body: "Halo {{tenant}}, langganan {{app}} paket {{paket}} sebesar {{nominal}} jatuh tempo pada {{tanggal}}. Rincian tagihan dan metode pembayaran: {{link}}. Jika Anda sudah membayar, abaikan pesan ini.",
    requiredVars: ["tenant", "paket", "tanggal", "nominal", "link"],
  },
  subscription_overdue: {
    label: "Langganan Terlambat",
    subject: "Langganan {{app}} Anda terlambat",
    body: "Halo {{tenant}}, langganan {{paket}} Anda lewat jatuh tempo sejak {{tanggal}} sebesar {{nominal}}. Selesaikan pembayaran agar layanan tidak terganggu: {{link}}",
    requiredVars: ["tenant", "paket", "tanggal", "nominal", "link"],
  },
  payment_expired: {
    label: "Pembayaran Kedaluwarsa",
    subject: "Pembayaran {{app}} kedaluwarsa",
    body: "Halo {{tenant}}, transaksi paket {{paket}} sebesar {{nominal}} telah kedaluwarsa pada {{tanggal}} dan belum tercatat lunas. Status paket Anda tidak berubah menjadi aktif karena transaksi ini. Untuk mencoba lagi, buka Langganan: {{link}}",
    requiredVars: ["tenant", "paket", "nominal", "tanggal", "link"],
  },
  payment_failed: {
    label: "Pembayaran Gagal",
    subject: "Pembayaran {{app}} gagal diproses",
    body: "Halo {{tenant}}, pembayaran paket {{paket}} sebesar {{nominal}} gagal diproses pada {{tanggal}}. Status paket Anda tidak berubah menjadi aktif karena transaksi ini. Periksa transaksi atau coba lagi melalui Langganan: {{link}}",
    requiredVars: ["tenant", "paket", "nominal", "tanggal", "link"],
  },
  wa_disconnected: {
    label: "WhatsApp Terputus",
    subject: "WhatsApp usaha Anda terputus",
    body: "Halo {{tenant}}, koneksi WhatsApp usaha Anda terputus. Pengiriman pesan usaha dari aplikasi tertunda. Sambungkan kembali (pindai QR) di Pengaturan → Hubungkan WhatsApp.",
    requiredVars: ["tenant"],
  },
};

/** Nama variabel yang dipakai template; digunakan test dan editor untuk validasi. */
export function platformTemplateVariables(tpl: PlatformTemplate): string[] {
  const matches = `${tpl.subject}\n${tpl.body}`.match(/\{\{\w+\}\}/g) ?? [];
  return [...new Set(matches.map((x) => x.slice(2, -2)))];
}

/** Render copy platform; kegagalan variabel wajib menghentikan enqueue. */
export function renderPlatformTemplate(
  key: PlatformTemplateKey,
  vars: Record<string, string>,
): { subject: string; body: string } {
  const tpl = PLATFORM_TEMPLATES[key];
  const missing = tpl.requiredVars.filter((name) => !String(vars[name] ?? "").trim());
  if (missing.length) throw new Error(`template ${key} kehilangan placeholder wajib: ${missing.join(", ")}`);
  const render = (text: string) => text.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => vars[name] ?? "");
  const rendered = { subject: render(tpl.subject), body: render(tpl.body) };
  const unresolved = [...(rendered.subject.match(/\{\{\w+\}\}/g) ?? []), ...(rendered.body.match(/\{\{\w+\}\}/g) ?? [])];
  const uniqueUnresolved = new Set<string>(unresolved);
  if (uniqueUnresolved.size) throw new Error(`template ${key} menyisakan placeholder: ${[...uniqueUnresolved].join(", ")}`);
  return rendered;
}
