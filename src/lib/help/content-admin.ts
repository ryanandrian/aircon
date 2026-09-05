/**
 * KONTEN Bantuan — panel admin platform (audiens 'admin'). Diverifikasi terhadap layar /admin nyata.
 * Ringkas & teknis (dipakai admin platform). Label & alur cocok dengan layar admin.
 */
import type { HelpTopic } from "./help-types";

export const ADMIN_TOPICS: HelpTopic[] = [
  {
    key: "admin-tenants",
    title: "Daftar Usaha (Tenant)",
    icon: "Building2",
    group: "Administrasi Platform",
    audience: "admin",
    order: 1,
    whatIsIt:
      "Daftar semua usaha (tenant) yang memakai Aircon. Pantau status langganan, plan, dan buka detail tiap tenant.",
    steps: [
      "Telusuri daftar usaha beserta status dan paketnya.",
      "Ketuk sebuah usaha untuk melihat detail: pemilik, langganan, pembayaran.",
      "Gunakan detail tenant untuk memantau kesehatan akun pelanggan.",
    ],
    tips: ["Status SUSPENDED/CANCELLED menandakan tenant menunggak atau berhenti."],
  },
  {
    key: "admin-paket",
    title: "Paket Langganan",
    icon: "CreditCard",
    group: "Administrasi Platform",
    audience: "admin",
    order: 2,
    whatIsIt:
      "Atur paket langganan yang dijual (mis. Professional, Business): harga, kuota, dan status aktif. Sumber tunggal harga di landing & penagihan.",
    steps: [
      "Ubah harga bulanan tiap paket.",
      "Atur kuota/batasan tiap paket.",
      "Aktif/nonaktifkan paket. Simpan perubahan.",
    ],
    tips: ["Harga di sini otomatis dipakai di halaman harga & saat tenant checkout."],
  },
  {
    key: "admin-kupon",
    title: "Kupon Diskon",
    icon: "Ticket",
    group: "Administrasi Platform",
    audience: "admin",
    order: 3,
    whatIsIt:
      "Buat & kelola kupon diskon langganan: persen, potongan tetap, atau harga tetap (override). Bisa sekali pakai atau berulang.",
    steps: [
      "Buat kupon baru: tentukan kode, tipe (PERCENT/FIXED/OVERRIDE), dan nilai.",
      "Atur kuota total, batas per tenant, masa berlaku, dan paket yang berlaku.",
      "Untuk diskon berulang, aktifkan recurring dan jumlah periode.",
      "Simpan — kupon siap dipakai tenant saat checkout.",
    ],
    tips: [
      "OVERRIDE membuat harga jadi nilai tetap — berguna untuk uji atau paket khusus.",
      "recurring = diskon otomatis berlaku beberapa periode perpanjangan tanpa tenant ketik ulang.",
    ],
  },
  {
    key: "admin-kebijakan",
    title: "Kebijakan Billing",
    icon: "Scale",
    group: "Administrasi Platform",
    audience: "admin",
    order: 4,
    whatIsIt:
      "Atur aturan penagihan: pajak, masa trial, masa tenggang sebelum suspend/hapus, jadwal reminder, dan template pesan penagihan. Semua configurable.",
    steps: [
      "Atur persentase pajak & masa trial.",
      "Atur 'grace' sebelum suspend dan sebelum hapus data (hari).",
      "Atur jadwal reminder (mis. 0,3,7,14,30) & hari peringatan hapus.",
      "Sesuaikan template pesan reminder & peringatan. Simpan.",
    ],
    tips: [
      "Nilai default sudah world-class (suspend >7 hari, hapus >37 hari). Ubah bila perlu.",
      "Semua tenant memakai kebijakan ini kecuali diatur khusus.",
    ],
  },
  {
    key: "admin-perusahaan",
    title: "Profil Perusahaan",
    icon: "Landmark",
    group: "Administrasi Platform",
    audience: "admin",
    order: 5,
    whatIsIt:
      "Identitas perusahaan penyedia (Lumite) yang tampil di faktur/kwitansi ke tenant: nama legal, NPWP, PKP, alamat, logo, plus catatan kaki dokumen keuangan.",
    steps: [
      "Isi nama legal, NPWP, status PKP, dan alamat.",
      "Unggah logo yang tampil di dokumen.",
      "Scroll ke 'Dokumen Keuangan' untuk mengatur catatan kaki Faktur, Kwitansi, dan biaya channel.",
      "Simpan Profil.",
    ],
    tips: [
      "Catatan kaki kosong = pakai teks default sistem (dokumen tetap benar).",
      "Status PKP menentukan apakah PPN dipungut pada dokumen.",
    ],
  },
  {
    key: "admin-iot",
    title: "Produk & Pesanan IoT",
    icon: "Cpu",
    group: "Administrasi Platform",
    audience: "admin",
    order: 6,
    whatIsIt:
      "Kelola katalog produk IoT yang dijual ke tenant beserta harga, dan pantau pesanan perangkat dari tenant.",
    steps: [
      "Tambah/ubah produk IoT: nama, harga, garansi, status aktif.",
      "Pantau pesanan perangkat masuk dari tenant beserta statusnya.",
    ],
    tips: ["Harga produk di sini dipakai saat tenant memesan perangkat."],
  },
  {
    key: "admin-keagenan",
    title: "Program Keagenan",
    icon: "Handshake",
    group: "Administrasi Platform",
    audience: "admin",
    order: 7,
    whatIsIt:
      "Kelola program keagenan/reseller: mitra yang membawa tenant baru dan komisi mereka.",
    steps: [
      "Kelola daftar agen/mitra.",
      "Pantau komisi yang timbul dari pembayaran tenant yang mereka bawa.",
    ],
    tips: ["Komisi dihitung otomatis dari pembayaran tenant setelah diskon (bukan termasuk pajak/fee)."],
  },
  {
    key: "admin-infra",
    title: "Konfigurasi Infra (WhatsApp & MQTT)",
    icon: "Server",
    group: "Administrasi Platform",
    audience: "admin",
    order: 8,
    whatIsIt:
      "Atur koneksi ke WhatsApp Gateway dan broker MQTT (IoT): URL, kunci, dan jeda anti-spam. Menentukan jalannya pengingat & IoT.",
    steps: [
      "Isi URL & kunci WhatsApp Gateway.",
      "Atur jeda minimum antar pesan (anti-ban).",
      "Isi konfigurasi MQTT bila memakai IoT. Simpan.",
    ],
    tips: [
      "Salah konfigurasi di sini bisa menghentikan pengingat WA seluruh tenant — ubah dengan hati-hati.",
    ],
  },
  {
    key: "admin-notifikasi",
    title: "Notifikasi Platform",
    icon: "Bell",
    group: "Administrasi Platform",
    audience: "admin",
    order: 9,
    whatIsIt:
      "Atur template notifikasi platform (Lumite → tenant): selamat datang, trial berakhir, tagihan jatuh tempo, WA terputus. Via WA & email.",
    steps: [
      "Pilih template event yang ingin diubah.",
      "Sesuaikan subjek & isi pesan (dengan placeholder).",
      "Simpan — dipakai otomatis saat event terjadi.",
    ],
    tips: ["Notifikasi ini berbeda dari template pesan tenant→pelanggan."],
  },
  {
    key: "admin-landing",
    title: "Landing Page",
    icon: "Globe",
    group: "Administrasi Platform",
    audience: "admin",
    order: 10,
    whatIsIt:
      "Kelola konten halaman depan publik (marketing): teks, testimoni, dan elemen yang tampil ke calon pelanggan.",
    steps: [
      "Ubah teks/bagian landing page.",
      "Kelola testimoni yang ditampilkan.",
      "Simpan — perubahan langsung tampil di halaman publik.",
    ],
  },
  {
    key: "admin-ringkasan",
    title: "Ringkasan Admin",
    icon: "LayoutDashboard",
    group: "Administrasi Platform",
    audience: "admin",
    order: 0,
    whatIsIt:
      "Dasbor platform: metrik lintas tenant (jumlah usaha, pendapatan, langganan aktif) untuk memantau kesehatan bisnis Aircon secara keseluruhan.",
    steps: [
      "Baca metrik utama platform di halaman ini.",
      "Gunakan menu samping untuk masuk ke pengelolaan spesifik (usaha, paket, kupon, dll).",
    ],
  },
];
