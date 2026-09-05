/**
 * KONTEN Bantuan — aplikasi teknisi (audiens 'tech'). Diverifikasi terhadap layar /t nyata.
 * Label & alur HARUS cocok dengan layar teknisi (tampilan HP).
 */
import type { HelpTopic } from "./help-types";

export const TECH_TOPICS: HelpTopic[] = [
  {
    key: "t-beranda",
    title: "Beranda Teknisi",
    icon: "Home",
    group: "Untuk Teknisi",
    audience: "tech",
    order: 1,
    whatIsIt:
      "Halaman utama aplikasi teknisi: sapaan nama Anda, ringkasan hari ini, dan daftar tugas yang perlu dikerjakan.",
    steps: [
      "Lihat kartu ringkasan di atas (ketuk untuk membuka riwayat).",
      "Telusuri daftar tugas hari ini di bawahnya.",
      "Ketuk sebuah tugas untuk membuka detail dan mulai mengerjakannya.",
    ],
    tips: [
      "Kartu atas menampilkan ringkasan periode berjalan; ketuk 'Lihat riwayat' untuk detail.",
    ],
  },
  {
    key: "t-pekerjaan",
    title: "Mengerjakan Tugas (Lapangan)",
    icon: "Wrench",
    group: "Untuk Teknisi",
    audience: "tech",
    order: 2,
    whatIsIt:
      "Layar kerja lapangan untuk satu pekerjaan: lihat detail pelanggan & unit, perbarui status, catat layanan yang dikerjakan, dan unggah foto.",
    steps: [
      "Buka tugas dari beranda.",
      "Perbarui status saat Anda berangkat, tiba, dan mulai mengerjakan.",
      "Catat layanan yang dilakukan dan isi checklist bila ada.",
      "Unggah foto hasil kerja sebagai bukti.",
      "Tandai selesai saat pekerjaan tuntas.",
    ],
    tips: [
      "Status yang Anda perbarui langsung terlihat oleh pemilik usaha.",
      "Foto sebelum/sesudah meningkatkan kepercayaan pelanggan.",
    ],
  },
  {
    key: "t-riwayat",
    title: "Riwayat & Insentif",
    icon: "History",
    group: "Untuk Teknisi",
    audience: "tech",
    order: 3,
    whatIsIt:
      "Daftar pekerjaan yang telah Anda kerjakan. Bila usaha Anda menerapkan program insentif, insentif Anda juga ditampilkan di sini.",
    steps: [
      "Pilih periode (mis. bulan berjalan) untuk menyaring riwayat.",
      "Telusuri pekerjaan yang sudah selesai.",
      "Lihat total insentif periode tersebut (bila usaha menerapkan insentif).",
    ],
    tips: [
      "Bila usaha Anda tidak menerapkan insentif, halaman ini hanya menampilkan riwayat pekerjaan — tanpa angka insentif.",
    ],
  },
];
