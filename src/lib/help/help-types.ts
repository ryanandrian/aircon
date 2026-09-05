/**
 * Tipe konten Bantuan (Help) Aircon — dipisah agar modul konten & registry tak sirkular.
 */
export type HelpAudience = "owner" | "tech" | "admin";

export interface HelpFaq {
  q: string;
  a: string;
}

export interface HelpTopic {
  /** Kunci unik, umumnya = segmen route (mis. "pelanggan", "wa-connect"). */
  key: string;
  /** Judul bagian bantuan (mis. "Pelanggan"). */
  title: string;
  /** Nama ikon lucide (opsional) untuk Pusat Panduan. */
  icon?: string;
  /** 1–2 kalimat: apa fungsi layar ini. */
  whatIsIt: string;
  /** Langkah pakai, urut. WAJIB cocok dengan tombol/alur nyata. */
  steps: string[];
  /** Tips opsional (praktik terbaik, peringatan ramah). */
  tips?: string[];
  /** FAQ opsional. */
  faqs?: HelpFaq[];
  /** Kelompok di Pusat Panduan. */
  group: string;
  /** Audiens (menentukan filter halaman panduan). */
  audience: HelpAudience;
  /** Urutan tampil dalam grup (kecil = atas). */
  order: number;
}
