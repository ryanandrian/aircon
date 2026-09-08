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
      "Tekan 'Catat Pekerjaan & Buat Tagihan'. Pilih unit AC yang dikerjakan — kalau unit belum terdaftar, tekan '+ Unit baru' dan isi merek (pilih dari daftar), PK, dan lokasi.",
      "Pilih layanan dan jumlahnya, lalu tambahkan. Isi checklist bila layanan itu punya checklist wajib.",
      "Unggah foto hasil kerja sebagai bukti.",
      "Tandai selesai saat pekerjaan tuntas.",
    ],
    tips: [
      "Status yang Anda perbarui langsung terlihat oleh pemilik usaha.",
      "Foto sebelum/sesudah meningkatkan kepercayaan pelanggan.",
      "Merek unit dipilih dari daftar baku agar data rapi — ketik beberapa huruf lalu pilih. Kalau mereknya langka, boleh diketik bebas.",
    ],
  },
  {
    key: "t-kode-qr",
    title: "Scan Kode QR Unit",
    icon: "QrCode",
    group: "Untuk Teknisi",
    audience: "tech",
    order: 4,
    whatIsIt:
      "Bila unit AC pelanggan punya stiker Kode QR, Anda bisa scan untuk langsung membuka rekam-medis unit itu (identitas + riwayat servis) — tanpa mencari-cari. Tombol Scan ada di kanan atas beranda teknisi.",
    steps: [
      "Di beranda, tekan ikon Scan (kanan atas), lalu arahkan kamera HP ke stiker QR di unit.",
      "Kalau stiker SUDAH tertaut ke unit → aplikasi langsung membuka rekam-medis unit (merek, lokasi, riwayat perawatan).",
      "Kalau stiker BELUM tertaut (baru ditempel) → tautkan dulu: buka pekerjaan pelanggan itu, masuk 'Catat Pekerjaan', pilih/tambah unitnya, lalu scan lagi untuk menautkan.",
      "Kamera bermasalah? Ketik kode 7 karakter yang tertera di stiker secara manual di kotak yang tersedia.",
    ],
    tips: [
      "Scan itu cuma jalan pintas — semua bisa juga dilakukan manual lewat daftar unit pelanggan.",
      "Kalau muncul 'kode milik usaha lain', berarti stiker itu bukan dari usaha Anda.",
      "Halaman yang terbuka saat scan aman ditunjukkan ke pelanggan: tidak ada biaya atau data pribadi, hanya info mesin + riwayat.",
    ],
    faqs: [
      {
        q: "Saya scan tapi tidak terjadi apa-apa?",
        a: "Pastikan QR yang discan adalah stiker unit dari aplikasi ini (kode 7 huruf/angka). Kalau QR lain (mis. QR pembayaran), aplikasi akan memberi tahu bahwa itu bukan kode unit.",
      },
      {
        q: "HP saya tidak bisa membuka kamera?",
        a: "Izinkan akses kamera di browser, atau ketik kode manual dari stiker. Keduanya membuka unit yang sama.",
      },
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
