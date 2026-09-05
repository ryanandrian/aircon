/**
 * KONTEN Bantuan — panel usaha (audiens 'owner'). Diverifikasi terhadap layar nyata.
 * Diimpor oleh help-content.ts untuk membangun registry (bukan side-effect).
 *
 * ATURAN: label tombol & alur di 'steps' HARUS sama persis dengan yang ada di layar.
 */
import type { HelpTopic } from "./help-types";

export const OWNER_TOPICS: HelpTopic[] = [
  {
    key: "beranda",
    title: "Ringkasan",
    icon: "LayoutDashboard",
    group: "Mulai di sini",
    audience: "owner",
    order: 1,
    whatIsIt:
      "Halaman utama usaha Anda: grafik unit AC yang dilayani 30 hari terakhir, angka-angka penting hari ini, dan pintasan cepat ke fitur yang sering dipakai.",
    steps: [
      "Lihat grafik atas untuk memantau jumlah unit yang dilayani tiap hari.",
      "Baca 4 kartu angka: Pekerjaan Hari Ini, Sedang Berjalan, Pengingat Aktif, dan Peluang IoT.",
      "Ketuk kartu angka untuk langsung menuju daftar terkait (mis. ketuk 'Pekerjaan Hari Ini' membuka daftar pekerjaan).",
      "Gunakan 'Aksi Cepat' untuk pintasan ke Pekerjaan, Pelanggan, Kode QR, dan Halaman Usaha.",
      "Navigasi lengkap ada di menu samping (ketuk ikon menu di kiri atas pada HP).",
    ],
    tips: [
      "'Peluang IoT' berubah kuning bila ada peringatan dari perangkat — sinyal untuk menawarkan servis.",
      "Kartu 'Pelanggan Datang Lagi' menjelaskan inti Aircon: servis berulang otomatis lewat pengingat WhatsApp.",
    ],
    faqs: [
      {
        q: "Kenapa angka 'Pengingat Aktif' penting?",
        a: "Itu jumlah pengingat servis yang sudah antre untuk pelanggan Anda. Semakin terjaga, semakin banyak servis berulang.",
      },
    ],
  },

  {
    key: "pelanggan",
    title: "Pelanggan",
    icon: "Users",
    group: "Mengelola Pekerjaan",
    audience: "owner",
    order: 1,
    whatIsIt:
      "Daftar semua pelanggan usaha Anda beserta unit AC mereka. Dari sini Anda menambah pelanggan, mengedit data, dan membuka detail tiap pelanggan.",
    steps: [
      "Ketuk tombol 'Tambah Pelanggan'.",
      "Isi nama pelanggan dan nomor WhatsApp, lalu ketuk 'Simpan'.",
      "Ketuk sebuah pelanggan untuk membuka detailnya (unit AC, riwayat, harga khusus).",
      "Gunakan kolom 'Cari pelanggan' untuk menemukan pelanggan dengan cepat.",
      "Tombol 'Edit' untuk mengubah data, 'Hapus' untuk menghapus pelanggan.",
    ],
    tips: [
      "Nomor WhatsApp yang benar adalah kunci — di situlah pengingat servis otomatis dikirim.",
      "Tombol 'WhatsApp' pada pelanggan membuka chat langsung ke nomornya.",
    ],
    faqs: [
      {
        q: "Apa beda pelanggan perorangan dan instansi?",
        a: "Saat menambah, Anda bisa menandai tipe pelanggan. Instansi (mis. kantor) biasanya punya banyak unit AC di satu lokasi.",
      },
    ],
  },

  {
    key: "pelanggan-detail",
    title: "Detail Pelanggan",
    icon: "User",
    group: "Mengelola Pekerjaan",
    audience: "owner",
    order: 2,
    whatIsIt:
      "Halaman lengkap satu pelanggan: daftar unit AC mereka, riwayat pekerjaan, harga khusus, dan tautan kartu perawatan yang bisa dibagikan ke pelanggan.",
    steps: [
      "Tambahkan unit AC pelanggan (merek, tipe, PK, lokasi ruangan) agar bisa dijadwalkan servis.",
      "Buka 'Harga Khusus' bila pelanggan ini punya harga berbeda dari harga umum.",
      "Bagikan tautan Kartu Perawatan ke pelanggan agar mereka bisa melihat riwayat AC-nya.",
      "Lihat riwayat pekerjaan untuk mengetahui servis yang pernah dilakukan.",
    ],
    tips: [
      "Setiap unit AC bisa punya jadwal servis berikutnya — dasar pengingat otomatis.",
      "Kartu Perawatan adalah tautan permanen; sekali dibagikan, pelanggan bisa membukanya kapan saja.",
    ],
  },

  {
    key: "pelanggan-harga",
    title: "Harga Khusus Pelanggan",
    icon: "Tag",
    group: "Mengelola Pekerjaan",
    audience: "owner",
    order: 3,
    whatIsIt:
      "Atur harga layanan khusus untuk pelanggan tertentu, berbeda dari harga umum di katalog layanan. Berguna untuk pelanggan langganan atau instansi.",
    steps: [
      "Pilih layanan dari katalog yang ingin diberi harga khusus.",
      "Masukkan harga khusus untuk pelanggan ini.",
      "Simpan — harga khusus otomatis dipakai saat membuat pekerjaan/faktur untuk pelanggan ini.",
    ],
    tips: [
      "Layanan tanpa harga khusus tetap memakai harga umum dari menu Layanan.",
      "Harga khusus hanya berlaku untuk pelanggan ini, tidak memengaruhi pelanggan lain.",
    ],
  },

  {
    key: "pekerjaan",
    title: "Pekerjaan",
    icon: "Wrench",
    group: "Mengelola Pekerjaan",
    audience: "owner",
    order: 4,
    whatIsIt:
      "Daftar semua pekerjaan servis (job) usaha Anda beserta statusnya, dari draft hingga selesai. Pusat untuk mengatur dan memantau pekerjaan lapangan.",
    steps: [
      "Ketuk '+ Pekerjaan' untuk membuat pekerjaan baru.",
      "Lihat status tiap pekerjaan pada label warnanya (mis. Ditugaskan, Dikerjakan, Selesai).",
      "Ketuk sebuah pekerjaan untuk membuka detail, menugaskan teknisi, atau membuat faktur.",
    ],
    tips: [
      "Pekerjaan yang selesai otomatis memicu pengingat servis berikutnya untuk pelanggan.",
    ],
  },

  {
    key: "pekerjaan-baru",
    title: "Buat Pekerjaan",
    icon: "Plus",
    group: "Mengelola Pekerjaan",
    audience: "owner",
    order: 5,
    whatIsIt:
      "Formulir membuat pekerjaan servis baru: pilih pelanggan, unit AC, jenis layanan, jadwal, dan teknisi yang ditugaskan.",
    steps: [
      "Pilih Pelanggan (wajib) dari daftar.",
      "Pilih Unit AC pelanggan (opsional — boleh 'tidak terkait unit tertentu').",
      "Pilih jenis layanan (mis. cuci AC, perbaikan).",
      "Atur Tanggal, Jam mulai, dan Jam selesai bila perlu.",
      "Pilih Teknisi yang ditugaskan, atau biarkan '— Tugaskan nanti —'.",
      "Ketuk 'Simpan' untuk membuat pekerjaan.",
    ],
    tips: [
      "Belum tahu siapa yang mengerjakan? Pilih 'Tugaskan nanti' dan tugaskan dari detail pekerjaan.",
      "Unit AC yang dipilih membantu mencatat riwayat servis per unit.",
    ],
  },

  {
    key: "pekerjaan-detail",
    title: "Detail Pekerjaan",
    icon: "ClipboardList",
    group: "Mengelola Pekerjaan",
    audience: "owner",
    order: 6,
    whatIsIt:
      "Halaman satu pekerjaan: melihat status, menugaskan tim teknisi, memantau progres & foto lapangan, hingga membuat faktur setelah selesai.",
    steps: [
      "Gunakan 'Tugaskan Tim' untuk menambahkan teknisi ke pekerjaan ini.",
      "Pantau perubahan status dan progres yang dilaporkan teknisi dari lapangan.",
      "Setelah pekerjaan selesai, buat faktur untuk menagih pelanggan.",
    ],
    tips: [
      "Status pekerjaan berubah otomatis saat teknisi memperbaruinya dari aplikasi teknisi.",
    ],
  },

  {
    key: "faktur",
    title: "Invoice & Proforma",
    icon: "FileText",
    group: "Keuangan & Langganan",
    audience: "owner",
    order: 1,
    whatIsIt:
      "Daftar tagihan ke pelanggan Anda: proforma (rancangan/penawaran) dan invoice resmi, dikelompokkan menurut status pembayaran.",
    steps: [
      "Gunakan tab 'Perlu Ditagih', 'Belum Lunas', 'Lunas', atau 'Semua' untuk menyaring.",
      "Ketuk sebuah dokumen untuk membuka detailnya.",
      "Proforma bisa diubah menjadi tagihan resmi lewat tombol 'Terbitkan Invoice Resmi'.",
      "Tandai invoice sebagai lunas saat pembayaran pelanggan diterima.",
    ],
    tips: [
      "Proforma = rancangan tagihan (belum resmi). Invoice = tagihan resmi ke pelanggan.",
      "Invoice biasanya dibuat otomatis dari pekerjaan yang selesai.",
    ],
    faqs: [
      {
        q: "Apa beda ini dengan menu Langganan?",
        a: "Menu ini untuk TAGIHAN Anda ke PELANGGAN. Menu Langganan untuk pembayaran Anda ke Aircon (biaya pakai aplikasi).",
      },
    ],
  },

  {
    key: "faktur-detail",
    title: "Detail Invoice",
    icon: "FileText",
    group: "Keuangan & Langganan",
    audience: "owner",
    order: 2,
    whatIsIt:
      "Rincian satu invoice/proforma: item layanan, jumlah, dan status. Dari sini Anda menerbitkan, mencetak, atau membatalkan dokumen.",
    steps: [
      "Periksa rincian item & total tagihan.",
      "Bila ini proforma, ketuk 'Terbitkan Invoice Resmi' untuk menjadikannya tagihan resmi.",
      "Cetak atau simpan sebagai PDF untuk dikirim ke pelanggan.",
      "Bila perlu, batalkan dokumen (tercatat sebagai dibatalkan).",
    ],
    tips: [
      "Dokumen yang sudah dibatalkan tetap tersimpan sebagai riwayat, tidak dihapus.",
    ],
  },

  {
    key: "langganan",
    title: "Paket Langganan",
    icon: "CreditCard",
    group: "Keuangan & Langganan",
    audience: "owner",
    order: 3,
    whatIsIt:
      "Kelola langganan Anda memakai Aircon: pilih paket, bayar, lihat riwayat pembayaran, dan lanjutkan pembayaran yang belum selesai.",
    steps: [
      "Pilih paket (mis. Professional atau Business) dan durasi (1/3/12 bulan).",
      "Bila punya kode diskon, masukkan di kolom kupon saat checkout.",
      "Ketuk 'Lanjutkan Pembayaran' — Anda diarahkan ke halaman pembayaran aman (Midtrans).",
      "Untuk transaksi yang belum lunas, gunakan tombol 'Bayar Sekarang' di Riwayat Pembayaran.",
      "Ketuk 'Kwitansi' pada pembayaran lunas untuk bukti terima, atau 'Faktur' untuk yang belum lunas.",
    ],
    tips: [
      "Paket bisa dibayar via transfer bank (VA), QRIS, atau e-wallet.",
      "Instruksi pembayaran juga dikirim otomatis oleh Midtrans ke email Anda.",
      "Bayar sebelum jatuh tempo agar layanan tidak terhenti.",
    ],
    faqs: [
      {
        q: "Apa yang terjadi jika telat bayar?",
        a: "Ada masa tenggang. Bila terus menunggak, akun sementara dinonaktifkan; Anda akan diingatkan lewat WhatsApp sebelum itu.",
      },
    ],
  },

  {
    key: "wa-connect",
    title: "Hubungkan WhatsApp",
    icon: "MessageCircle",
    group: "Otomatisasi",
    audience: "owner",
    order: 1,
    whatIsIt:
      "Sambungkan WhatsApp usaha Anda ke Aircon agar pengingat servis terkirim OTOMATIS ke pelanggan — inti keunggulan Aircon. Ada di menu Pengaturan Usaha.",
    steps: [
      "Siapkan HP dengan WhatsApp usaha (bukan WA pribadi).",
      "Ketuk 'Hubungkan WhatsApp' — muncul kode QR di layar.",
      "Di HP: buka WhatsApp → Setelan → Perangkat Tertaut → Tautkan Perangkat.",
      "Arahkan kamera HP ke kode QR di layar ini.",
      "Tunggu sampai status berubah menjadi 'Tersambung' (hijau).",
    ],
    tips: [
      "Gunakan nomor WhatsApp khusus usaha — jangan nomor pribadi.",
      "Jangan keluarkan (logout) perangkat tertaut ini, atau pengingat berhenti terkirim.",
      "Bila terputus, Anda akan diberi tahu — tinggal hubungkan ulang dengan scan QR lagi.",
    ],
    faqs: [
      {
        q: "Apakah aman?",
        a: "Ya. Aircon hanya mengirim pesan yang Anda setujui (mis. pengingat servis), tidak membaca chat pribadi Anda.",
      },
      {
        q: "Apakah HP harus selalu menyala?",
        a: "WhatsApp Anda cukup aktif seperti biasa — mirip cara kerja WhatsApp Web.",
      },
    ],
  },

  {
    key: "pengaturan",
    title: "Pengaturan Usaha",
    icon: "Settings",
    group: "Pengaturan Usaha",
    audience: "owner",
    order: 1,
    whatIsIt:
      "Atur identitas usaha (nama, logo, alamat, nomor WhatsApp), rekening bank, program insentif tim, dan koneksi WhatsApp — semua di satu tempat.",
    steps: [
      "Isi 'Identitas Usaha': Nama Usaha, Telepon/WhatsApp, moto, dan alamat.",
      "Unggah logo di bagian 'Branding Usaha' (tampil di faktur & halaman usaha).",
      "Isi data rekening bank (Nama Bank & Atas Nama) bila perlu ditampilkan ke pelanggan.",
      "Aktifkan 'Terapkan program insentif tim' bila usaha Anda memberi insentif ke teknisi.",
      "Ketuk 'Simpan Profil Usaha' untuk menyimpan perubahan.",
      "Di bagian WhatsApp, gunakan 'Hubungkan WhatsApp' untuk mengaktifkan pengingat otomatis.",
    ],
    tips: [
      "Bila usaha TIDAK menerapkan insentif, biarkan saklar mati — teknisi tak akan melihat kolom insentif sama sekali.",
      "Logo & nama usaha yang rapi membuat faktur Anda terlihat profesional.",
    ],
  },

  {
    key: "layanan",
    title: "Daftar Layanan",
    icon: "List",
    group: "Pengaturan Usaha",
    audience: "owner",
    order: 2,
    whatIsIt:
      "Katalog layanan usaha Anda (mis. cuci AC, isi freon, perbaikan) beserta harga umum. Dipakai saat membuat pekerjaan & faktur.",
    steps: [
      "Ketuk 'Tambah Layanan'.",
      "Isi Kode, Kategori, Nama, Satuan, dan Keterangan layanan.",
      "Simpan — layanan siap dipakai di pekerjaan & faktur.",
      "Gunakan 'Unduh' untuk mengekspor daftar layanan bila perlu.",
    ],
    tips: [
      "Harga di sini adalah harga UMUM. Untuk harga berbeda per pelanggan, pakai 'Harga Khusus' di detail pelanggan.",
    ],
  },

  {
    key: "teknisi",
    title: "Teknisi",
    icon: "Users",
    group: "Pengaturan Usaha",
    audience: "owner",
    order: 3,
    whatIsIt:
      "Kelola tim teknisi Anda: undang teknisi baru, pantau yang menunggu bergabung, dan lihat status PIN mereka.",
    steps: [
      "Di 'Undang Teknisi Baru', masukkan Nomor HP teknisi.",
      "Ketuk 'Undang' — teknisi akan menerima undangan untuk bergabung.",
      "Teknisi yang belum bergabung tampil di 'Menunggu Bergabung' (bisa 'Batalkan').",
      "Teknisi login di aplikasi teknisi memakai nomor HP + PIN mereka sendiri.",
    ],
    tips: [
      "Teknisi masuk lewat aplikasi teknisi (bukan login Google) — cukup nomor HP & PIN.",
      "Status 'Belum set PIN' berarti teknisi belum menyelesaikan pendaftaran.",
    ],
  },

  {
    key: "checklist",
    title: "Checklist Servis",
    icon: "ListChecks",
    group: "Pengaturan Usaha",
    audience: "owner",
    order: 4,
    whatIsIt:
      "Susun daftar langkah standar yang harus dikerjakan teknisi saat servis (mis. cek tekanan freon, bersihkan filter). Menjaga mutu kerja seragam.",
    steps: [
      "Ketuk 'Tambah langkah' untuk menambah item checklist.",
      "Tulis langkah kerja yang harus dilakukan teknisi.",
      "Ketuk 'Simpan' untuk menyimpan checklist.",
    ],
    tips: [
      "Checklist muncul di aplikasi teknisi saat mengerjakan servis — memastikan tak ada langkah terlewat.",
      "Ada checklist 'Bawaan' sebagai contoh awal yang bisa Anda sesuaikan.",
    ],
  },

  {
    key: "laporan",
    title: "Laporan Keuangan",
    icon: "BarChart3",
    group: "Keuangan & Langganan",
    audience: "owner",
    order: 4,
    whatIsIt:
      "Ringkasan keuangan usaha: pendapatan, kas yang belum disetor per teknisi, dan insentif personel bulan ini.",
    steps: [
      "Lihat ringkasan pendapatan usaha Anda.",
      "Periksa 'Kas Belum Disetor per Teknisi' untuk menagih setoran dari teknisi lapangan.",
      "Lihat 'Insentif Personel Bulan Ini' bila usaha Anda menerapkan insentif.",
    ],
    tips: [
      "Bagian insentif hanya muncul bila program insentif diaktifkan di Pengaturan.",
    ],
  },

  {
    key: "pesan",
    title: "Template Pesan WhatsApp",
    icon: "MessageSquare",
    group: "Otomatisasi",
    audience: "owner",
    order: 2,
    whatIsIt:
      "Atur isi pesan WhatsApp yang dikirim otomatis ke pelanggan, mis. pengingat servis. Anda bisa menyesuaikan kata-katanya.",
    steps: [
      "Pilih template yang ingin diubah (mis. pengingat servis).",
      "Ubah teksnya sesuai gaya usaha Anda.",
      "Gunakan placeholder seperti {{customer}}, {{unit}}, {{usaha}} agar terisi otomatis.",
      "Simpan template.",
    ],
    tips: [
      "Placeholder otomatis diganti data asli saat pesan dikirim (mis. {{customer}} → nama pelanggan).",
      "Pesan yang ramah & personal meningkatkan respons pelanggan.",
    ],
  },

  {
    key: "unit",
    title: "Kode QR Unit",
    icon: "QrCode",
    group: "Pengaturan Usaha",
    audience: "owner",
    order: 5,
    whatIsIt:
      "Buat dan cetak stiker kode QR untuk ditempel di unit AC pelanggan. Scan QR mempercepat teknisi membuka data unit di lapangan.",
    steps: [
      "Tentukan jumlah kode QR yang ingin dibuat.",
      "Cetak/unduh stiker QR lalu tempel di unit AC pelanggan.",
      "Gunakan fitur Scan QR untuk membuka unit dengan cepat saat di lapangan.",
    ],
    tips: [
      "Stiker QR di unit memudahkan teknisi mencatat servis tanpa mencari data manual.",
    ],
  },

  {
    key: "perangkat",
    title: "Pemantauan Perangkat (IoT)",
    icon: "Cpu",
    group: "Otomatisasi",
    audience: "owner",
    order: 3,
    whatIsIt:
      "Pantau perangkat IoT (bila dipasang) yang mengawasi kondisi AC pelanggan. Peringatan dari sensor menjadi peluang menawarkan servis.",
    steps: [
      "Lihat daftar Alert (peringatan) dari perangkat yang terpasang.",
      "Tindak lanjuti 'Peluang' servis dari peringatan tersebut.",
      "Buka 'Pesan Perangkat' untuk memesan perangkat IoT baru.",
    ],
    tips: [
      "Fitur IoT bersifat tambahan (add-on) — hanya relevan bila Anda memasang perangkat di unit pelanggan.",
    ],
  },

  {
    key: "perangkat-pesan",
    title: "Pesan Perangkat IoT",
    icon: "ShoppingCart",
    group: "Otomatisasi",
    audience: "owner",
    order: 4,
    whatIsIt:
      "Formulir memesan perangkat IoT untuk dipasang di unit AC pelanggan. Pembayaran melalui halaman pembayaran aman.",
    steps: [
      "Pilih jumlah perangkat yang ingin dipesan.",
      "Periksa rincian harga.",
      "Lanjutkan ke pembayaran untuk menyelesaikan pesanan.",
    ],
    tips: [
      "Status pesanan Anda bisa dipantau di halaman 'Pesanan Perangkat'.",
    ],
  },

  {
    key: "perangkat-pesanan",
    title: "Pesanan Perangkat",
    icon: "Package",
    group: "Otomatisasi",
    audience: "owner",
    order: 5,
    whatIsIt:
      "Daftar pesanan perangkat IoT Anda beserta status pembayaran dan pengirimannya.",
    steps: [
      "Lihat status tiap pesanan (mis. menunggu pembayaran, diproses, dikirim).",
      "Lanjutkan pembayaran bila ada pesanan yang belum lunas.",
    ],
  },
];
