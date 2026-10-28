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
  | "wa_connected"
  | "wa_disconnected"
  | "booking_inapp"
  | "booking_confirm_customer"
  // Copy TENANT -> PELANGGAN (dunning & inactivity). Semula tersimpan di kolom
  // BillingPolicy; sekarang satu katalog (G23) supaya bisa diedit di satu tempat.
  | "tenant_dunning_reminder"
  | "tenant_dunning_warning"
  | "tenant_inactivity_reminder1"
  | "tenant_inactivity_reminder2"
  // F4 — notifikasi mitra (agen/reseller). Copy diedit admin di katalog yang sama.
  | "partner_agent_invited"
  | "partner_agent_activated"
  | "partner_reseller_registered"
  | "partner_reseller_approved"
  | "partner_reseller_rejected"
  | "partner_reseller_activated"
  | "partner_tenant_attributed"
  | "partner_commission_accrued"
  | "partner_commission_reversed"
  | "partner_payout_paid";

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
  wa_connected: {
    label: "WhatsApp Tersambung Lagi",
    subject: "WhatsApp usaha Anda tersambung",
    body: "Halo {{tenant}}, koneksi WhatsApp usaha Anda sudah tersambung kembali. Pengiriman pesan usaha dari aplikasi dapat berjalan lagi. Periksa pengaturan bila koneksi terputus lagi: {{link}}",
    requiredVars: ["tenant", "link"],
  },
  tenant_dunning_reminder: {
    label: "Pengingat Tunggakan (Tenant ke Pelanggan)",
    subject: "Pengingat tunggakan",
    body: "Halo {{nama}}, langganan Aircon Anda jatuh tempo dan menunggak {{telat}} hari. Mohon segera perpanjang agar layanan tidak terputus.",
    requiredVars: ["nama", "telat"],
  },
  tenant_dunning_warning: {
    label: "Peringatan Hapus Data (Tenant ke Pelanggan)",
    subject: "Peringatan penghapusan data",
    body: "Halo {{nama}}, langganan Aircon Anda menunggak {{telat}} hari. PERINGATAN: bila tidak dibayar dalam {{sisa}} hari lagi, data usaha Anda akan dihapus permanen. Segera perpanjang untuk menghindari kehilangan data.",
    requiredVars: ["nama", "telat", "sisa"],
  },
  tenant_inactivity_reminder1: {
    label: "Pengingat Akun Tidak Aktif #1 (Tenant ke Pelanggan)",
    subject: "Akun Anda belum aktif",
    body: "Halo {{nama}}, akun Aircon Anda belum ada aktivitas selama {{hari}} hari. Kami menantikan Anda kembali — buka aplikasi kapan saja untuk melanjutkan.",
    requiredVars: ["nama", "hari"],
  },
  tenant_inactivity_reminder2: {
    label: "Pengingat Akun Tidak Aktif #2 (Tenant ke Pelanggan)",
    subject: "Akun Anda akan dihapus",
    body: "Halo {{nama}}, akun Aircon Anda sudah {{hari}} hari tanpa aktivitas. PERINGATAN: bila tetap tidak digunakan, akun beserta seluruh data akan DIHAPUS PERMANEN dalam {{sisa}} hari. Buka aplikasi untuk membatalkan penghapusan.",
    requiredVars: ["nama", "hari", "sisa"],
  },
  booking_confirm_customer: {
    label: "Konfirmasi Booking (WA ke Pemesan)",
    subject: "Konfirmasi booking",
    body: "Halo {{nama}}, booking Anda di {{tenant}} sudah diterima. Kode booking: {{kode}}. Sebutkan kode booking saat kami menghubungi Anda.",
    requiredVars: ["nama", "tenant", "kode"],
  },
  booking_inapp: {
    label: "Booking Online Baru (In-App)",
    subject: "Booking online baru",
    body: "{{nama}} mengirim permintaan booking{{layanan}}. Buka daftar calon pelanggan untuk membalas.",
    requiredVars: ["nama"],
  },
  partner_agent_invited: {
    label: "Undangan Agen (Platform ke Agen)",
    subject: "Undangan menjadi mitra Aircon",
    body: "Halo {{nama}}, {{app}} mengundang Anda menjadi mitra. Gunakan tautan berikut untuk mengaktifkan akun: {{link}}",
    requiredVars: ["nama", "link"],
  },
  partner_agent_activated: {
    label: "Agen Aktif (Platform ke Agen)",
    subject: "Akun mitra Anda aktif",
    body: "Halo {{nama}}, akun mitra Anda sudah aktif. Silakan masuk ke portal mitra: {{link}}",
    requiredVars: ["nama", "link"],
  },
  partner_reseller_registered: {
    label: "Pendaftaran Reseller (Platform ke Agen)",
    subject: "Pendaftaran reseller baru atas nama {{mitra}}",
    body: "Halo {{nama}}, ada pendaftaran reseller baru: {{mitra}}. Tinjau dan setujui di portal mitra: {{link}}",
    requiredVars: ["nama", "mitra", "link"],
  },
  partner_reseller_approved: {
    label: "Reseller Disetujui (Platform ke Reseller)",
    subject: "Pendaftaran Anda disetujui",
    body: "Halo {{nama}}, pendaftaran Anda disetujui. Kode Anda: {{kode}}. Aktifkan akun lewat tautan: {{link}}",
    requiredVars: ["nama", "kode", "link"],
  },
  partner_reseller_rejected: {
    label: "Reseller Ditolak (Platform ke Reseller)",
    subject: "Pendaftaran Anda belum disetujui",
    body: "Halo {{nama}}, pendaftaran Anda belum disetujui. Hubungi agen Anda untuk keterangan.",
    requiredVars: ["nama"],
  },
  partner_reseller_activated: {
    label: "Reseller Aktif (Platform ke Reseller)",
    subject: "Akun reseller Anda aktif",
    body: "Halo {{nama}}, akun reseller Anda sudah aktif. Silakan masuk ke portal mitra: {{link}}",
    requiredVars: ["nama", "link"],
  },
  partner_tenant_attributed: {
    label: "Tenant Terattribusi (Platform ke Mitra)",
    subject: "Pelanggan baru masuk lewat kode Anda",
    body: "Halo {{nama}}, pelanggan baru terdaftar memakai kode {{kode}}: {{nama_tenant}} (status akun: {{status_tenant}}).",
    requiredVars: ["nama", "kode", "nama_tenant", "status_tenant"],
  },
  partner_commission_accrued: {
    label: "Komisi Terhitung (Platform ke Mitra)",
    subject: "Komisi Anda bertambah",
    body: "Halo {{nama}}, komisi sebesar {{nominal_komisi}} tercatat untuk periode {{periode}}. Ini pencatatan, bukan pembayaran.",
    requiredVars: ["nama", "nominal_komisi", "periode"],
  },
  partner_commission_reversed: {
    label: "Komisi Dibatalkan (Platform ke Mitra)",
    subject: "Komisi sebelumnya dibatalkan",
    body: "Halo {{nama}}, komisi sebesar {{nominal_komisi}} dibatalkan untuk periode {{periode}}. {{ref}}",
    requiredVars: ["nama", "nominal_komisi", "periode", "ref"],
  },
  partner_payout_paid: {
    label: "Pembayaran Payout (Platform ke Mitra)",
    subject: "Pembayaran komisi telah diproses",
    body: "Halo {{nama}}, pembayaran komisi periode {{periode}} sebesar {{nominal_komisi}} telah diproses. Referensi: {{ref}}.",
    requiredVars: ["nama", "nominal_komisi", "periode", "ref"],
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

/** Semua variabel yang diisi runtime (superset). Harus dideklarasikan sebelum dipakai. */
const ALL_RUNTIME_VARS = ["app", "tenant", "paket", "link", "cta", "tanggal", "nominal", "nama", "layanan", "mitra", "nama_tenant", "status_tenant", "nominal_komisi", "periode", "kode", "ref", "telat", "hari", "sisa"] as const;

/**
 * Placeholder yang DIKENAL untuk tiap key = `requiredVars` (kontrak kode) ∪ variabel
 * runtime. Editor admin hanya boleh memakai variabel dari daftar ini.
 */
export function knownVariables(key: PlatformTemplateKey): string[] {
  return [...new Set<string>([...PLATFORM_TEMPLATES[key].requiredVars, ...ALL_RUNTIME_VARS])];
}

/** Key template notifikasi MITRA (F4) — penerima agen/reseller, bukan tenant. */
export type PartnerTemplateKey =
  | "partner_agent_invited"
  | "partner_agent_activated"
  | "partner_reseller_registered"
  | "partner_reseller_approved"
  | "partner_reseller_rejected"
  | "partner_reseller_activated"
  | "partner_tenant_attributed"
  | "partner_commission_accrued"
  | "partner_commission_reversed"
  | "partner_payout_paid";

/**
 * Key template yang Beverimaan TENANT (bukan mitra). Dipisah agar
 * `DEFAULT_LINK` tak perlu-butuh entry untuk template mitra.
 */
export type TenantTemplateKey = Exclude<PlatformTemplateKey, PartnerTemplateKey>;

/** Template notifikasi MITRA (F4) — penerima agen/reseller, bukan tenant. */
export const PARTNER_TEMPLATE_KEYS: readonly PartnerTemplateKey[] = [
  "partner_agent_invited",
  "partner_agent_activated",
  "partner_reseller_registered",
  "partner_reseller_approved",
  "partner_reseller_rejected",
  "partner_reseller_activated",
  "partner_tenant_attributed",
  "partner_commission_accrued",
  "partner_commission_reversed",
  "partner_payout_paid",
];

/**
 * True bila template ini untuk mitra (bukan tenant). Type guard → TS bisa
 * menyempitkan `PlatformTemplateKey` menjadi `TenantTemplateKey` setelah guard.
 */
export function isPartnerTemplate(key: PlatformTemplateKey): key is PartnerTemplateKey {
  return key.startsWith("partner_");
}

export interface TemplateCopy { subject: string; body: string }

export type TemplateValidation =
  | { ok: true }
  | { ok: false; errors: string[] };

/**
 * Validasi copy yang diedit admin. Aturan:
 *  - body wajib (min 10 char); subject wajib untuk EMAIL (key ber-subject).
 *  - setiap `{{x}}` harus variabel yang dikenal untuk key tsb (typo ditolak).
 *  - setiap `requiredVars` harus muncul di body/subject (jika tidak, pesan pasti
 *    tidak memuat info wajib, mis. nominal tagihan).
 * Tidak mengubah eligibilitas: copy tidak bisa menambah CTA atau menyebut paket lain
 * — itu tetap ditentukan kode (lihat catatan di notifyPlatform).
 */
export function validateTemplateCopy(key: PlatformTemplateKey, copy: TemplateCopy): TemplateValidation {
  const errors: string[] = [];
  const subject = copy.subject ?? "";
  const body = copy.body ?? "";
  if (body.trim().length < 10) errors.push("Isi pesan minimal 10 karakter");
  if (body.length > 2000) errors.push("Isi pesan maksimal 2000 karakter");
  if (subject.length > 200) errors.push("Subjek maksimal 200 karakter");
  const known = new Set(knownVariables(key));
  const used = new Set<string>();
  for (const text of [subject, body]) {
    for (const m of text.matchAll(/\{\{(\w*)\}\}/g)) {
      used.add(m[1]);
      if (!known.has(m[1])) errors.push(`Variabel tidak dikenal: {{${m[1]}}}`);
    }
    // Sisa kurung kurawal setelah placeholder valid dihapus = placeholder rusak.
    if (text.replace(/\{\{\w*\}\}/g, "").match(/[{}]/)) {
      errors.push("Placeholder rusak: kurung kurawal tidak berpasangan");
      break;
    }
  }
  for (const req of PLATFORM_TEMPLATES[key].requiredVars) {
    if (!used.has(req)) errors.push(`Variabel wajib belum ada: {{${req}}}`);
  }
  return errors.length ? { ok: false, errors: [...new Set(errors)] } : { ok: true };
}

/**
 * Render copy platform. `copy` = isi aktif (dari DB bila ada, selain itu default kode).
 * Kegagalan variabel wajib menghentikan enqueue — copy rusak tidak pernah terkirim.
 */
export function renderPlatformTemplate(
  key: PlatformTemplateKey,
  vars: Record<string, string>,
  copy: TemplateCopy = PLATFORM_TEMPLATES[key],
): { subject: string; body: string } {
  const tpl = copy;
  const missing = PLATFORM_TEMPLATES[key].requiredVars.filter((name) => !String(vars[name] ?? "").trim());
  if (missing.length) throw new Error(`template ${key} kehilangan placeholder wajib: ${missing.join(", ")}`);
  const render = (text: string) => text.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => vars[name] ?? "");
  const rendered = { subject: render(tpl.subject), body: render(tpl.body) };
  const unresolved = [...(rendered.subject.match(/\{\{\w+\}\}/g) ?? []), ...(rendered.body.match(/\{\{\w+\}\}/g) ?? [])];
  const uniqueUnresolved = new Set<string>(unresolved);
  if (uniqueUnresolved.size) throw new Error(`template ${key} menyisakan placeholder: ${[...uniqueUnresolved].join(", ")}`);
  return rendered;
}
