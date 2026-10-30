/**
 * Pemetaan kode error → pesan halaman login. MURNI (tanpa DB/React) → mudah diuji.
 *
 * Kode berasal dari query `?error=` yang diisi server (callback OAuth & layout /app).
 * Nilai tak dikenal TIDAK dirender bebas — jatuh ke pesan umum, jadi halaman tak
 * pernah menampilkan teks mentah dari query string.
 */

/** Kode error yang dikenali halaman login. */
export const LOGIN_ERROR_CODES = [
  "auth",
  "state",
  "unverified",
  "suspended",
  "cancelled",
] as const;

export type LoginErrorCode = (typeof LOGIN_ERROR_CODES)[number];

export interface LoginErrorInfo {
  /** Pesan untuk pengguna. */
  message: string;
  /** Judul singkat (dipakai sebagai penekanan). */
  title: string;
  /** Tautan CTA — hanya untuk jalur yang punya langkah selanjutnya (langganan). */
  actionHref?: string;
  actionLabel?: string;
  /** True bila perlu CTA ke halaman Langganan (pemulihan billing). */
  billingRecovery: boolean;
}

const GENERIC: LoginErrorInfo = {
  title: "Gagal masuk",
  message: "Gagal masuk. Silakan coba lagi.",
  billingRecovery: false,
};

/**
 * Petakan kode error ke pesan akurat.
 * Kode tak dikenal → pesan generik (aman, tak pernah menampilkan input mentah).
 */
export function resolveLoginError(code: string | undefined | null): LoginErrorInfo | null {
  if (!code) return null;
  switch (code as LoginErrorCode) {
    case "suspended":
      return {
        title: "Langganan tertunggak",
        message:
          "Usaha Anda ditangguhkan karena langganan jatuh tempo. Aktivitas operasional dibatasi sampai pembayaran selesai. Buka halaman Langganan untuk membayar dan mengaktifkan kembali layanan.",
        actionHref: "/app/langganan",
        actionLabel: "Buka Halaman Langganan",
        billingRecovery: true,
      };
    case "cancelled":
      return {
        title: "Usaha berstatus Berhenti",
        message:
          "Usaha ini berstatus Berhenti (diatur oleh admin platform), sehingga layanan operasional tidak tersedia. Bila menurut Anda ini keliru, hubungi kami lewat halaman Kontak.",
        actionHref: "/kontak",
        actionLabel: "Hubungi Kami",
        billingRecovery: false,
      };
    case "state":
      return {
        title: "Sesi login tidak valid",
        message:
          "Sesi login tidak valid atau sudah kedaluwarsa karena terlalu lama. Silakan masuk kembali — biasanya cepat.",
        billingRecovery: false,
      };
    case "unverified":
      return {
        title: "Email belum terverifikasi",
        message:
          "Email Anda belum terverifikasi, jadi akun belum bisa dihubungkan ke usaha. Silakan gunakan email yang sudah terverifikasi.",
        billingRecovery: false,
      };
    case "auth":
      return {
        title: "Gagal masuk",
        message: "Gagal masuk. Silakan coba lagi.",
        billingRecovery: false,
      };
    default:
      return GENERIC;
  }
}
