# RENCANA PERBAIKAN - KAS TUNAI & TAMPILAN KEUANGAN TENANT
Status: AKTIF (draft pemilik) | 2026-10-16 | sumber: diskusi pemilik 15-16 Okt
+ forensik kode & DB live (read-only). Semua klaim berlabel bukti; yang belum
dibaca ditandai U (wajib dibaca saat eksekusi, dilarang berasumsi).

## A. PRINSIP TERKUNCI (keputusan pemilik)
P1. Tunai baru jadi KAS KANTOR setelah setoran dikonfirmasi; sebelum itu =
    PIUTANG TEKNISI (utang teknisi ke kantor). Status lunas invoice != uang
    sudah di kantor. Dua hal WAJIB tampil terpisah.
P2. Tanpa ambigu: satu rupiah satu status tegas; tidak ada angka
    "Penerimaan" tunggal yang mencampur kondisi berbeda.
P3. Bukti wajib: TRANSFER/QRIS wajib foto bukti transfer/QRIS; tunai
    dibuktikan lewat bukti setoran. Tanpa bukti = bukan lunas terverifikasi.
P4. Kembangkan jalur existing (nol rute/fungsi baru kecuali terbukti belum
    ada); nol fosil; TDD RED-GREEN; deploy SOP; SSOT di-update per progress;
    nol mutasi DB tanpa izin eksplisit.

## B. FAKTA TERVERIFIKASI (bukti kode/DB live)
F1. getReceipts (src/lib/services/ar-service.ts:64-69) = invoice PAID +
    paidAt di rentang; TANPA filter metode/TANPA cek cashRemitStatus.
    Pemakaian: src/app/app/laporan/page.tsx:31,49 = kartu "Penerimaan Bulan
    Ini". Konsekuensi: naik SAAT teknisi tandai lunas tunai, SEBELUM setoran.
    PEMILIK KONFIRMASI: ini menyesatkan bila digabung.
F2. K17 getUnremittedCashByTech (ar-service.ts:90-113) filter CASH +
    HELD_BY_TECH. Live PT Ase: 3 invoice tunai total Rp340.000 dipegang
    Ujang (INV/2026/0001 85k, 0005 85k, 0006 170k) = sah.
F3. markCashRemitted (ar-service.ts:116-126): admin menekan tombol ->
    REMITTED. TANPA bukti setoran yang diwajibkan/dilampirkan.
F4. markInvoicePaid (src/lib/services/invoice-service.ts:325+) menerima
    paymentProofUrl OPSIONAL; actionMarkPaid (src/app/t/faktur/actions.ts:36)
    meneruskan tanpa kewajiban -> TRANSFER/QRIS bisa lunas TANPA bukti.
    field paymentProofUrl ada di schema (terverifikasi lewat pemakaian kode).
F5. F9f LIVE: markInvoicePaid kini set cashRemitStatus = HELD_BY_TECH utk
    CASH, null utk TRANSFER/QRIS (perilaku baru).
F6. Tidak ada konfirmasi bank otomatis di sistem; "lunas" = status yang
    dimasukkan pengguna (input manual).
F7. INV/2026/0003 PT Ase (TRANSFER, cashRemitStatus stale HELD) TIDAK tampil
    di K17 -> kesalahan catatan internal saja; keputusan Opsi A/B terpisah.

## C. FAKTA BELUM DIBACA (wajib diverifikasi saat eksekusi)
U1. Skema: apakah kolom bukti setoran (depositProofUrl) sudah ada pada
    Invoice (baca prisma/schema.prisma); bila tidak -> migration additive.
U2. Struktur persis app/app/laporan/page.tsx + lokasi komponen tombol
    setoran (nama file, action yang dipakai).
U3. Field config Tenant apa yang tersedia utk SLA (baca model Tenant).
U4. Apakah jalur upload bukti admin sudah ada atau reuse pola
    actionUploadPaymentProof (src/app/t/faktur/actions.ts:16).
U5. Seluruh pemakai getReceipts (grep menyeluruh) - pastikan tak ada
    pemakai lain yang terdampak.
Tiap item eksekusi WAJIB membaca U1-U5 dulu; temuan baru dicatat di SSOT.

## D. ITEM PERBAIKAN (urut dependensi)
G1 - Pisahkan tampilan penerimaan (dari F1)
  Jalur: kembangkan getReceipts -> rincian per-bucket (kas kantor /
  dipegang teknisi / non-tunai lunas); kartu laporan dipisah di halaman
  existing. Sub-label jujur non-tunai: "ditandai lunas (bukti manual)".
  Hasil: pemilik melihat posisi uang terpisah; selisih = piutang teknisi.
  TDD: RED test service per-bucket + RED test sumber halaman (label) -> GREEN.
G2 - Bukti setoran wajib utk REMITTED (dari F3, setelah U1/U2/U4)
  Jalur: markCashRemitted + actionMarkCashRemitted + komponen tombol lama:
  wajib upload foto struk setoran sebelum status REMITTED; penyimpanan
  bukti mengikuti keputusan D2.
  Hasil: setoran terdokumentasi; rekonsiliasi diaudit.
  TDD: RED tolak tanpa bukti; guard OWNER/ADMIN & tenant-scope tetap.
G3 - Bukti TRANSFER/QRIS wajib sebelum lunas (dari F4)
  Jalur: guard di markInvoicePaid (service) + UI PaymentPanel lama
  (/t/faktur & admin): paymentProofUrl WAJIB utk TRANSFER/QRIS; CASH tetap
  tanpa upload (aturan F2; tunai dibuktikan lewat G2).
  Hasil: tiap non-tunai punya foto bukti.
  TDD: RED tolak tanpa bukti; lulus dgn bukti; CASH tetap bebas.
G4 - SLA setoran + umur piutang teknisi (dari F2, setelah U3)
  Jalur: config tenant + K17 existing: tampil umur "sejak X hari, lewat
  batas"; hitung asOf server-side (pola getAccountsReceivable(asOf)).
  Hasil: utang teknisi tak bisa mengendap tanpa batas.
  Keputusan pemilik: nilai SLA & eskalasi.
G5 - Rekonsiliasi kas kantor
  Jalur: kartu "Kas kantor" di laporan existing = setoran REMITTED periode;
  selisih = HELD (data G1, tinggal dirangkai).
  Hasil: kas kantor bertambah terlihat HANYA setelah setoran.
G6 - Label jujur (dari F6)
  Ganti "lunas" menjadi "ditandai lunas" di kartu laporan, detail invoice,
  kwitansi. TDD: test sumber label.

## E. KEPUTUSAN PEMILIK (sebelum eksekusi)
D1. G1 format: (a) 3 kartu terpisah | (b) 1 kartu + baris rincian.
    Usulan: (a) - paling jelas tanpa interpretasi.
D2. G2 penyimpanan bukti setoran: kolom di Invoice vs tabel bukti terpisah
    - putuskan setelah U1 dibaca.
D3. G4 nilai SLA setoran (mis. H+1 kerja) + tindakan bila lewat.
D4. PT Ase INV/2026/0003: Opsi A biarkan | Opsi B 1 UPDATE terjaga
    (perintah sudah disiapkan, butuh izin eksplisit).
D5. Urutan eksekusi: G1 -> G3 -> G2 -> G4/G5 -> G6.

## F. GATE (berlaku utk tiap item)
RED-GREEN test tiap perubahan perilaku | tsc/eslint/build = 0 | suite penuh
hijau | deploy SOP PASS (source-sha == origin/main, tree bersih) | verifikasi
marker live | SSOT_Alar_Teknisi.md + log konfirmasi uji pemilik (Bagian 3B)
di-update | nol mutasi DB tanpa izin eksplisit.
