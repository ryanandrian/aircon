/**
 * KONTEN Bantuan — panel usaha (audiens 'owner'). Diverifikasi terhadap layar nyata.
 * Diimpor oleh help-content.ts untuk membangun registry (bukan side-effect).
 *
 * ATURAN: label tombol & alur di 'steps' HARUS sama persis dengan yang ada di layar.
 */
import type { HelpTopic } from "./help-types";

export const OWNER_TOPICS: HelpTopic[] = [
  {
    key: "onboarding",
    title: "Daftar & Setup Usaha",
    icon: "Sparkles",
    group: "Mulai di sini",
    audience: "owner",
    order: 0,
    whatIsIt:
      "Langkah pertama memakai Aircon: buat usaha Anda. Cukup isi 3 hal, lalu Anda diajak menghubungkan WhatsApp agar pengingat otomatis langsung aktif.",
    steps: [
      "Masuk dengan Google (tombol 'Lanjutkan dengan Google').",
      "Isi Nama Usaha, Kota/Area Layanan, dan Nomor WhatsApp Usaha.",
      "Punya kode agen? Isi di 'Kode Agen / Referral' (opsional).",
      "Ketuk 'Mulai Pakai Aircon'.",
      "Anda diarahkan ke Pengaturan — segera 'Hubungkan WhatsApp' (scan QR) agar pengingat aktif.",
    ],
    tips: [
      "Nomor WhatsApp yang Anda isi = identitas usaha; menautkannya ke gateway dilakukan lewat scan QR di Pengaturan.",
      "Belum pegang HP WhatsApp usaha saat daftar? Lewati dulu — banner di beranda akan mengingatkan sampai tersambung.",
      "Semua data ini bisa diubah kapan saja di menu Pengaturan.",
    ],
    faqs: [
      {
        q: "Apakah gratis?",
        a: "Ada masa coba (trial). Paket Basic gratis untuk fitur inti; paket berbayar membuka kapasitas & fitur lebih.",
      },
      {
        q: "Kenapa setelah daftar diminta hubungkan WhatsApp?",
        a: "Pengingat servis otomatis ke pelanggan adalah inti Aircon. Tanpa WhatsApp tersambung, pengingat tak bisa terkirim.",
      },
    ],
  },

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
      "Daftar semua pelanggan usaha Anda beserta unit AC mereka. Dari sini Anda menambah pelanggan, mengedit data, dan membuka detail tiap pelanggan. Untuk pelanggan badan/perusahaan, Anda juga bisa mengisi PIC Keuangan, email, dan menautkan ke kantor pusat penerima tagihan.",
    steps: [
      "Ketuk tombol 'Tambah Pelanggan'.",
      "Isi Nama dan No. WhatsApp (wajib), lalu lengkapi Alamat, Kategori, Jenis Pelanggan, dan Termin Pembayaran (TOP).",
      "Bila Jenis Pelanggan = BADAN, muncul seksi 'Data Badan / Perusahaan': isi NPWP, PIC Pekerjaan, PIC Keuangan, dan email bila ada (semua opsional).",
      "Untuk outlet/cabang yang tagihannya ditagihkan ke pusat, ketuk '+ Pilih kantor pusat' lalu cari & pilih pelanggan induknya.",
      "Ketuk 'Simpan'. Ketuk sebuah pelanggan untuk membuka detailnya (unit AC, riwayat, harga khusus).",
      "Gunakan kolom 'Cari pelanggan' untuk menemukan cepat; tombol 'Edit' mengubah data, 'Hapus' menghapus.",
      "Punya banyak pelanggan sekaligus? Ketuk 'Impor' → 'Unduh Template' Excel → isi → unggah kembali. Aplikasi memeriksa & menampilkan pratinjau sebelum menyimpan.",
    ],
    tips: [
      "Nomor WhatsApp yang benar adalah kunci — di situlah pengingat servis otomatis dikirim.",
      "PIC Keuangan (nama/HP/email) dipakai sebagai tujuan pengiriman tagihan & kwitansi untuk pelanggan badan. Bila kosong, tagihan dikirim ke WhatsApp utama.",
      "Email bersifat opsional. Bila dikosongkan, tagihan & dokumen dikirim lewat WhatsApp.",
    ],
    faqs: [
      {
        q: "Apa beda pelanggan perorangan dan instansi?",
        a: "Saat menambah, Anda pilih Jenis Pelanggan. BADAN (instansi/perusahaan) memunculkan data tambahan: NPWP, PIC Pekerjaan & Keuangan, email, dan kantor pusat. Perorangan cukup nama + WhatsApp.",
      },
      {
        q: "Apa itu 'Kantor Pusat (penerima tagihan)' dan kapan dipakai?",
        a: "Untuk pelanggan yang punya banyak cabang/outlet tapi tagihannya dibayar terpusat (mis. tiap outlet Pizza Hut ditagihkan ke PT pusat). Buat dulu pelanggan kantor pusatnya, lalu pada tiap outlet pilih kantor pusat itu. Saat invoice/proforma outlet dibuat, tagihan otomatis 'Ditagihkan kepada' kantor pusat, tapi lokasi servis tiap unit tetap tercantum jelas. Kosongkan bila pelanggan menagih atas namanya sendiri.",
      },
      {
        q: "Bagaimana mengimpor banyak pelanggan sekaligus dari Excel?",
        a: "Ketuk 'Impor' lalu 'Unduh Template'. Template punya sheet Panduan (baca dulu) + dua sheet data: 'Pelanggan Tunai' (bayar di tempat, kolom ringkas) dan 'Pelanggan Tempo' (institusi yang ditagih, kolom lengkap dengan PIC Keuangan & termin). Isi yang sesuai — boleh salah satu atau keduanya. Hanya Nama & Nomor yang wajib. Unggah kembali, aplikasi menampilkan berapa yang valid, duplikat (otomatis dilewati), dan baris bermasalah sebelum Anda menyimpan. Data unit AC tidak perlu diisi — dicatat saat servis pertama.",
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
      "Rincian satu invoice/proforma: pihak yang ditagih, item layanan (dikelompokkan per unit AC), jumlah, dan status. Dari sini Anda menerbitkan, mencetak, mengirim via WhatsApp, atau membatalkan dokumen. Bila invoice sudah LUNAS, muncul juga Kwitansi.",
    steps: [
      "Periksa 'Ditagihkan kepada' (untuk outlet dengan kantor pusat, di sini tampil nama kantor pusat + lokasi servis outlet) dan rincian item & total.",
      "Bila ini proforma, ketuk 'Terbitkan Invoice Resmi' untuk menjadikannya tagihan resmi.",
      "Ketuk 'Cetak / Simpan PDF' untuk mencetak atau menyimpan PDF (lewat menu cetak browser).",
      "Ketuk 'Kirim via WA' untuk mengirim ringkasan tagihan otomatis lewat WhatsApp usaha Anda ke pelanggan (atau PIC Keuangan bila diisi).",
      "Saat pembayaran diterima, tandai lunas. Setelah LUNAS, ketuk 'Lihat / cetak Kwitansi' untuk membuka kwitansi, lalu cetak atau kirim via WA dari sana.",
      "Bila perlu, batalkan dokumen (tercatat sebagai dibatalkan, tidak dihapus).",
    ],
    tips: [
      "Dokumen yang sudah dibatalkan tetap tersimpan sebagai riwayat, tidak dihapus.",
      "'Kirim via WA' butuh WhatsApp usaha sudah tersambung (menu Pengaturan → Hubungkan WhatsApp). Bila belum, tombol memberi tahu Anda.",
      "Kirim WA memuat ringkasan (nomor, total, jatuh tempo). Lampiran file PDF via WA belum tersedia — untuk file, pakai 'Cetak / Simpan PDF' lalu kirim manual.",
    ],
    faqs: [
      {
        q: "Kenapa tombol Kwitansi tidak muncul?",
        a: "Kwitansi hanya muncul setelah invoice ditandai LUNAS. Tandai pembayaran diterima dulu, lalu tombol 'Lihat / Kirim Kwitansi' akan tampil.",
      },
      {
        q: "Kirim ke nomor siapa saat 'Kirim via WA'?",
        a: "Untuk pelanggan badan yang mengisi PIC Keuangan, dikirim ke HP PIC Keuangan. Bila tidak diisi, dikirim ke nomor WhatsApp utama pelanggan.",
      },
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
      "Ketuk 'Lanjutkan Pembayaran' — Anda diarahkan ke halaman pembayaran aman (iPaymu).",
      "Untuk transaksi yang belum lunas, gunakan tombol 'Bayar Sekarang' di Riwayat Pembayaran.",
      "Ketuk 'Kwitansi' pada pembayaran lunas untuk bukti terima, atau 'Faktur' untuk yang belum lunas.",
    ],
    tips: [
      "Paket bisa dibayar via transfer bank (VA), QRIS, atau e-wallet.",
      "Instruksi pembayaran juga dikirim otomatis oleh iPaymu ke email Anda.",
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
      "Sambungkan nomor WhatsApp usaha ke Aircon agar pengingat servis dan notifikasi terkirim otomatis ke pelanggan. Ada dua cara: QR untuk laptop/PC, atau kode tautan untuk Anda yang hanya memakai satu HP.",
    steps: [
      "Siapkan HP dengan WhatsApp usaha (bukan WA pribadi).",
      "Untuk cara QR: di Pengaturan Usaha, ketuk 'Hubungkan dengan QR'.",
      "Di HP: buka WhatsApp → Perangkat Tertaut → Tautkan Perangkat.",
      "Arahkan kamera HP ke kode QR di layar komputer/laptop.",
      "Untuk cara satu HP: ketuk 'Gunakan kode tautan (HP saja)', masukkan nomor WhatsApp dalam format internasional (contoh 6281234567890), lalu ketuk 'Dapatkan kode'.",
      "Di HP: WhatsApp → Perangkat Tertaut → Tautkan Perangkat → Tautkan dengan nomor telepon. Masukkan kode 8 karakter yang tampil di Aircon.",
      "Tunggu sampai status berubah menjadi 'Tersambung' (hijau). Jangan menutup halaman saat proses berlangsung.",
    ],
    tips: [
      "Gunakan nomor WhatsApp khusus usaha — jangan nomor pribadi.",
      "Jangan keluarkan (logout) perangkat tertaut ini, atau pengingat berhenti terkirim.",
      "QR membutuhkan layar kedua (komputer/laptop). Jika hanya punya satu HP, gunakan kode tautan.",
      "Nomor harus ditulis dengan kode negara 62, tanpa tanda + dan tanpa awalan 0.",
      "Bila terputus, Anda akan diberi tahu — tinggal hubungkan ulang dengan QR atau kode tautan.",
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
      {
        q: "Saya hanya punya satu HP, bagaimana cara menyambungkan?",
        a: "Gunakan 'Gunakan kode tautan (HP saja)'. Masukkan nomor WhatsApp dalam format 62xxxxxxxxxx, ketuk 'Dapatkan kode', lalu masukkan kode 8 karakter melalui WhatsApp → Perangkat Tertaut → Tautkan Perangkat → Tautkan dengan nomor telepon.",
      },
      {
        q: "Mengapa QR hanya berputar atau tidak muncul?",
        a: "QR hanya untuk mode QR dan membutuhkan layar komputer/laptop. Jika Anda memakai satu HP, kembali lalu pilih kode tautan. Jika tetap macet, batalkan proses, muat ulang halaman, dan mulai lagi.",
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
    key: "tim",
    title: "Tim / Staf",
    icon: "Users",
    group: "Pengaturan Usaha",
    audience: "owner",
    order: 3,
    whatIsIt:
      "Kelola tim usaha Anda: admin (staf kantor yang mengurus pelanggan, tagihan & laporan) dan teknisi (yang menangani pekerjaan di lapangan). Undang anggota baru, pantau yang menunggu bergabung, dan lihat status PIN mereka.",
    steps: [
      "Di 'Undang Tim / Staf Baru', pilih Peran: Admin (kantor) atau Teknisi (lapangan).",
      "Untuk Admin, isi Jabatan bila perlu (mis. 'Admin Keuangan' / 'Admin Operasional') — hanya label.",
      "Masukkan Nama & Nomor HP, lalu ketuk 'Buat Undangan'.",
      "Bagikan link undangan lewat WhatsApp atau salin link — anggota membuat PIN sendiri untuk masuk.",
      "Gunakan tab 'Teknisi' dan 'Admin' untuk melihat masing-masing daftar; ketuk ikon untuk ubah data atau reset PIN.",
    ],
    tips: [
      "Semua anggota (admin & teknisi) masuk lewat halaman 'Masuk Staf' dengan Nomor HP + PIN — bukan login Google. Hanya pemilik yang login Google.",
      "Admin diarahkan ke dasbor kantor (/app); teknisi ke layar lapangan. Peran menentukan otomatis ke mana mereka masuk.",
      "Semua admin punya hak akses yang sama. 'Jabatan' hanya label untuk memudahkan Anda membedakan peran mereka.",
      "Status 'Belum set PIN' berarti anggota belum menyelesaikan pendaftaran lewat link undangan.",
    ],
    faqs: [
      {
        q: "Apa beda Admin dan Teknisi?",
        a: "Admin = staf kantor: mengelola pelanggan, membuat & mengirim tagihan/kwitansi, mengatur jadwal, melihat laporan. Teknisi = lapangan: menerima & menyelesaikan pekerjaan dari HP. Admin TIDAK bisa mengubah langganan usaha (itu hanya pemilik).",
      },
      {
        q: "Bisakah saya punya lebih dari satu admin?",
        a: "Bisa. Anda boleh mengundang beberapa admin (mis. satu Admin Keuangan, satu Admin Operasional) sesuai kuota paket. Akun usaha tetap satu (akun Google pemilik); admin & teknisi masuk dengan PIN masing-masing.",
      },
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
      "Fitur OPSIONAL: beri tiap unit AC pelanggan satu stiker Kode QR — seperti 'kartu identitas' mesin. Sekali scan, teknisi langsung tahu unit mana tanpa mencari, dan pelanggan bisa scan untuk melihat riwayat perawatan mesinnya. Paling berguna untuk pelanggan dengan banyak unit (kantor, sekolah, masjid, ruko).",
    steps: [
      "Buka menu Kode QR. Isi jumlah kode yang ingin dibuat lalu tekan 'Buat Kode' — sistem membuat kode unik berstatus 'Tersedia' (belum tertaut ke unit mana pun).",
      "Tekan 'Export CSV' untuk mengunduh daftar kode + tautannya. Serahkan file itu ke tukang cetak/printer barcode untuk dicetak jadi stiker — atau pesan stiker jadi ke Lumite.",
      "Di lokasi pelanggan, teknisi menempel stiker di unit AC. (Pastikan unit itu sudah terdaftar di pelanggan; kalau belum, teknisi bisa menambah lewat '+ Unit baru' saat mencatat pekerjaan.)",
      "Teknisi menekan 'Scan QR', mengarahkan kamera ke stiker, lalu memilih unit yang benar — kode langsung tertaut (status berubah jadi 'Terpasang'). Cukup sekali seumur stiker.",
      "Selesai. Kunjungan berikutnya, teknisi tinggal scan stiker untuk membuka rekam-medis unit; pelanggan pun bisa scan untuk melihat kartu perawatan.",
    ],
    tips: [
      "Kode ini opsional — kalau usaha Anda belum butuh, abaikan saja menu ini. Tidak ada yang terhambat.",
      "Aplikasi tidak mencetak stiker langsung; ia menyiapkan file CSV (kode + tautan) yang dibaca mesin cetak barcode. Ini justru fleksibel: cetak sejumlah berapa pun, ukuran bebas.",
      "Halaman yang dilihat pelanggan saat scan HANYA menampilkan info mesin + riwayat servis. Biaya, nama teknisi, dan data pribadi pelanggan tidak pernah ditampilkan.",
      "Satu unit = satu stiker. Kode yang sudah terpasang tidak bisa dipakai ulang untuk unit lain.",
    ],
    faqs: [
      {
        q: "Apa bedanya status 'Tersedia' dan 'Terpasang'?",
        a: "'Tersedia' = kode sudah dibuat tapi belum ditautkan ke unit (stiker kosong). 'Terpasang' = kode sudah dikawinkan ke satu unit AC tertentu. Kode baru berguna setelah 'Terpasang'.",
      },
      {
        q: "Apakah wajib pakai Kode QR?",
        a: "Tidak. Ini fitur pelengkap. Sangat membantu untuk pelanggan dengan banyak unit (gedung/sekolah), tapi untuk pelanggan rumahan 1–2 unit boleh dilewati.",
      },
      {
        q: "Amankah kalau stiker discan orang yang tidak berkepentingan?",
        a: "Aman. Halaman publik hanya menampilkan merek/tipe/lokasi unit dan riwayat servis — tanpa biaya, tanpa data pribadi pelanggan, tanpa nama teknisi.",
      },
      {
        q: "Stiker rusak/hilang, bagaimana?",
        a: "Buat kode baru, tempel stiker baru, lalu scan dan tautkan ke unit yang sama. Riwayat unit tetap utuh karena menempel ke unit, bukan ke stiker.",
      },
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
