# RENCANA PERBAIKAN TUNTAS — CLOSING & PEMBAYARAN PELANGGAN CASH

```
STATUS       : AKTIF — satu-satunya dokumen rencana penerimaan/keuangan
DIBUAT       : 2026-10-17 — menggantikan SELURUH rencana lama (tidak ada rencana paralel)
PEMILIK      : Pemilik platform Aircon (pemutus) · Agen (pelaksana)
PROGRES      : BAGIAN 7 — satu-satunya tempat membaca status pekerjaan
BASIS KODE   : commit c5973c1 (HEAD == origin/main)
```

**Cara pakai dokumen ini (sesi baru / setelah compacting — baca ini dulu, 30 detik):**

1. Baca **BAGIAN 7**. Lanjutkan dari baris pertama yang masih `[ ]`.
2. **BAGIAN 3 = keputusan pemilik yang sudah FINAL.** Jangan diubah, jangan ditanya ulang.
3. Jangan menghapus/mengubah baris `[x]`. Koreksi = tambah baris baru bertanggal.
4. Setiap langkah selesai → **BAGIAN 7 diperbarui + seluruh SSOT terkait diperbarui dalam commit yang sama**.
5. Bila ada pertentangan antara dokumen ini dan dokumen lain → **dokumen ini yang berlaku**; dokumen lain diperbaiki, bukan diikuti.

---

## BAGIAN 1 — LINGKUP (apa yang dikerjakan, apa yang TIDAK)

**Dikerjakan:** penerimaan uang **berdasarkan invoice** — pelanggan **cash** (uang tunai, transfer, QRIS) dan pelanggan **tempo**.

**TIDAK dikerjakan (jangan tambahkan sendiri):**
- sumber pemasukan lain — langganan SaaS, penjualan putus, IoT, reseller;
- seluruh **pengeluaran**;
- saldo berjalan, kas keluar, pembukuan, laporan laba-rugi.

Aplikasi ini hanya menjawab: **uang dari invoice pelanggan — sudah masuk atau belum, dan buktinya mana.**

---

## BAGIAN 2 — KONDISI SAAT INI (fakta terverifikasi ke kode) & MASALAHNYA

### M1 — Angka "Penerimaan" belum tentu uang yang ada
Kartu "Penerimaan Bulan Ini" menaik begitu teknisi menekan LUNAS. Uang tunai saat itu masih di tangan teknisi; transfer/QRIS belum tentu masuk rekening. **Angka di layar tidak dapat dipakai sebagai dasar keputusan uang.**
*Teknis:* hitungan mengambil semua invoice berstatus PAID tanpa membedakan posisi uang (`src/lib/services/ar-service.ts:64` → `src/app/app/laporan/page.tsx:31`).
*Catatan:* kartu **"Kas Belum Disetor"** sudah ada dan sudah benar — masalahnya hanya "Penerimaan" mencampur posisi.

### M2 — Setoran tidak meninggalkan jejak
Admin tenant menekan "Tandai Disetor" → hanya status yang berubah. **Tidak ada tanggal, tidak ada nama admin penerima, tidak ada bukti.** Akibatnya pertanyaan dasar tidak bisa dijawab: *uang ini dipegang siapa, diterima siapa, kapan, buktinya mana.*
*Teknis:* `markCashRemitted` hanya `updateMany` → REMITTED (`ar-service.ts:116-126`); kolom tanggal/pelaku/bukti setoran **tidak ada** di skema.

### M3 — Transfer/QRIS bisa "lunas" tanpa verifikasi uang masuk
Teknisi dapat menandai lunas transfer/QRIS **tanpa bukti apa pun**, dan statusnya langsung final — tidak ada tahap pemeriksaan bahwa dana benar-benar masuk rekening perusahaan. Ini celah **bukti fiktif dari pelanggan**.
*Teknis:* bukti bersifat opsional (`src/lib/services/invoice-service.ts:325`); tidak ada konsep verifikasi di backend.

### M4 — Foto bukti tersimpan tetapi tidak pernah bisa dilihat
Bukti yang diunggah masuk penyimpanan, tetapi **tidak ada satu layar pun yang menampilkannya**. Bukti selama ini data mati — tidak berguna untuk audit.
*Teknis:* grep seluruh `src/` — kolom bukti hanya ditulis, tidak pernah dirender.

### M5 — Penanggalan mengikuti zona server, bukan zona tenant
Batas "bulan ini" dihitung memakai zona waktu server (VPS umumnya UTC). Akibatnya pembayaran pukul 00.00–06.59 WIB tanggal 1 **masuk ke bulan sebelumnya**. Untuk laporan uang, ini tidak dapat diterima.
*Teknis:* `new Date(now.getFullYear(), now.getMonth(), 1)` di `src/app/app/laporan/page.tsx:23-25`; tidak ada penanganan zona waktu di seluruh `src/`.

### M6 — Satu baris data lama salah (tenant real: PT Ase, INV/2026/0003)
Kolom posisi uang tertinggal pada nilai lama karena kode versi lama (sudah diperbaiki). Laporan tidak menampilkan angka salah, tetapi **datanya tetap salah dan wajib dibetulkan** karena ini data real milik tenant.

### M7 — Uang yang sudah disetor tanpa jejak HILANG dari seluruh posisi (temuan audit 2026-10-18, tenant Jaya Mandiri)
Invoice tunai berstatus REMITTED tetapi `remittedAt = null` (disetor sebelum kolom jejak L2 ada — kolom nullable, migrasi tidak mengisi data lama) **tidak masuk posisi mana pun**: penerimaan menuntut `remittedAt` ada di rentang. Akibatnya uang yang menurut data sudah di kantor **tidak tampil sama sekali** — bertentangan langsung dengan K1 ("tidak pernah hilang dari layar"). Kasus live: 7 invoice, Rp3.800.000, kartu "Penerimaan" menunjukkan Rp0. Bug lolos karena test hanya memakai data jejak selalu terisi (aturan kerja 13).
*Teknis:* `ar-service.ts` cabang CASH+REMITTED — `remittedAt = null` tidak pernah masuk `inRange`.

### M8 — Daftar riwayat setoran mencampur uang tunai dengan transfer/QRIS (temuan audit 2026-10-18)
`getRemittances` hanya menyaring `cashRemitStatus = "REMITTED"` tanpa `payMethod = "CASH"`, sehingga 8 invoice transfer/QRIS (Rp4.340.000) ikut tampil sebagai baris "Riwayat Setoran Kas". Nilai `REMITTED` pada non-tunai adalah sisa kode lama (jalur `markInvoicePaid` kini menulis `null` untuk non-CASH).
*Teknis:* `ar-service.ts:244` — query tanpa filter metode.

### M9 — Pemegang uang disebut "teknisi" meski pemilik (temuan audit 2026-10-18)
Tabel & kartu menyebut "per Teknisi", tetapi pengelompokan per `createdById` tidak memeriksa peran. Kasus live Jaya Mandiri: 7 dari 8 baris dipegang Pak Budi yang rolenya OWNER.

---

## BAGIAN 3 — KEPUTUSAN PEMILIK (FINAL — jangan ditanya ulang)

| ID | Soal | KEPUTUSAN |
|---|---|---|
| **K1** | Arti "**Penerimaan**" | **Hanya uang yang sudah benar-benar masuk ke perusahaan.** Bukan "sudah dibayar", bukan "sudah diterima teknisi". Uang yang belum masuk **tetap tampil** di daftarnya sendiri — tidak pernah hilang dari layar |
| **K2** | Kartu "**Kas kantor**" | **Aliran setoran** pada periode itu — bukan saldo berjalan (tidak ada kas keluar/saldo awal) |
| **K3** | Alur uang tunai | **Teknisi tetap menandai lunas seperti sekarang** (alur lapangan tidak berubah). Uang tunai berstatus **"menunggu setoran"** dan **terus tampil** — lengkap dengan siapa memegang & sejak kapan — sampai **admin tenant mencatat setoran** |
| **K4** | Alur transfer/QRIS | Berstatus **"menunggu verifikasi"** dan **terus tampil** sampai **owner/admin tenant menyatakan uang sudah masuk rekening**. Verifikasi mencatat **siapa & kapan** |
| **K5** | Bukti & identitas pada setoran | Setoran **wajib**: **foto bukti** (disimpan di penyimpanan cloud yang sudah dipakai aplikasi), **tanggal**, dan **nama admin tenant penerima** (satu bisnis bisa punya >1 admin). Metode setoran bebas — tunai, transfer, atau QRIS |
| **K6** | Batas waktu setoran (SLA) | **TIDAK ADA.** Tidak ada konsep "terlambat", tidak ada peringatan, tidak ada penjadwalan otomatis. Tanggal dicatat hanya sebagai keterangan **"sejak X hari"** |
| **K7** | Zona waktu | **Milik tiap tenant**, ditetapkan saat **onboarding** (bawaan: WIB). Seluruh penanggalan (bulan ini, "sejak X hari", laporan) mengikuti zona tenant. **Tenant yang ada saat ini seluruhnya WIB** → diisi langsung lewat satu pembaruan data, tanpa menanyai tenant |
| **K8** | Data lama PT Ase (M6) | **KOREKSI 2026-10-18 — TANPA KONFIRMASI OWNER TENANT = TIDAK DISENTUH.** Audit langsung menemukan 6 baris label kas salah di PT Ase: 1 transfer lunas (INV/2026/0003) + **5 invoice berstatus belum-lunas tetap ter-stempel "uang di teknisi"** (INV/0004, 0007, 0009, 0011, 0014 — stempel itu hasil KEPUTUSAN 1 yang kini dihapus). **Data TIDAK BISA membedakan** pelanggan yang belum bayar dari yang **sudah bayar tunai tetapi teknisi belum menandai lunas** — keduanya tampil identik. Membersihkan label pada kasus kedua = **menghapus jejak uang di tangan teknisi**. **Maka: nol baris disentuh.** Penyesuaian hanya bila **owner PT Ase mengonfirmasi per invoice**; kalau ternyata sudah bayar → perbaikannya MENANDAI LUNAS, bukan membersihkan label | `[x]` (keputusan: tunda — tanpa konfirmasi tenant = tanpa perubahan) |
| **K9** | Label posisi uang saat invoice terbit | **KEPUTUSAN PEMILIK 2026-10-18: HAPUS STEMPEL.** Invoice/proforma terbit **TANPA** label posisi uang (dulu: "uang di teknisi" ditempel saat closing tanpa cek pembayaran — tebakan tanpa dasar). Label **hanya ditulis `markInvoicePaid`** saat pembayaran nyata dicatat (CASH → di teknisi; TRANSFER/QRIS → kosong). Tidak menyentuh data lama | `[x]` |
| **K12** | Bukti dari teknisi | **PERINTAH PEMILIK 2026-10-18: teknisi WAJIB bisa & diwajibkan mengirim bukti** — bukti terima uang tunai, bukti transfer, bukti QRIS — khususnya pelanggan TOP CASH. Membatalkan guard B-2 lama dan pembatasan K10 (yang saya jalankan tanpa persetujuan). Guard server dibuka utk semua peran; kolom bukti tampil semua peran | `[x]` |
| **K11** | Konsistensi angka laporan | **Dari laporan pemilik 2026-10-18**: kartu "Menunggu Setoran" dan tabel "Kas Belum Disetor per Teknisi" **harus menampilkan angka yang sama** dalam satu layar. Maka posisi "menunggu" = keadaan seluruh waktu; "Penerimaan" = arus menurut waktu diterima (setoran/verifikasi tercatat di rentang) | `[x]` |
| **K10** | Panel pembayaran | **Dari laporan pemilik 2026-10-18**: tombol "Tandai LUNAS" tidak boleh membeku senyap — indikator "Mengunggah…" wajib selama proses unggah | `[x]` (penyembunyian kolom dari teknisi dicabut oleh K12) |
| **K13** | Setoran tunai tanpa jejak (M7) | **Dari audit data Jaya Mandiri 2026-10-18:** uang tunai berstatus **REMITTED tanpa jejak** (`remittedAt = null`) kini **tampil sebagai posisi sendiri**: "**Disetor — Belum Ada Bukti**", keadaan seluruh waktu, dan **ikut perhitungan identitas** (penerimaan + menunggu setoran + menunggu verifikasi + posisi ini = total lunas). **TIDAK dihitung sebagai Penerimaan** — status "sudah disetor" lama tidak bisa jadi bukti uang ada di kantor tanpa jejak (K5 mewajibkan bukti). **TIDAK dikarang tanggal/penerima/bukti.** Pemilik tenant melengkapinya lewat **jalur setoran yang sudah ada** (lihat **K14**) — posisi "Disetor" hanya punya baris yang `remittedAt`-nya sudah ada. Setelah lengkap → posisi berpindah ke Penerimaan. | `[x]` |
| **K14** | Pelengkap jejak setoran lama | **PERINTAH PEMILIK 2026-10-18:** transaksi 7 baris (Rp3.800.000) itu terjadi **sebelum jejak diwajibkan (K5)** — kartu pengingat tanpa aksi = membebani tenant, bukan memperbaiki. **Maka jalur YANG SAMA diperpanjang**: `markCashRemitted` mendapat mode `"legacy"` yang **hanya** menyentuh baris `REMITTED` + `remittedAt` null (jejak lama **tidak pernah ditimpa**; baris `HELD_BY_TECH` ditolak — urusan mode biasa). Tombol "**Lengkapi Bukti**" memakai `RemitButton` + `actionMarkCashRemitted` + unggah S3 yang sudah ada (label berubah menurut mode); penerima = admin/pemilik yang menekan tombol (dari sesi); **wajib foto** (K5 tetap berlaku sama). Tanggal setoran mengikuti waktu pencatatan — **tidak dikarang**. Setelah tersimpan, baris pindah otomatis dari "Belum Ada Bukti" ke Penerimaan. | `[x]` |
| **K15** | Riwayat penerimaan bulanan | **DARI PEMILIK 2026-10-18:** kartu "Penerimaan Bulan Ini" terkunci `now` → tenant **tidak bisa melihat penerimaan bulan-bulanan sebelumnya** (total maupun detail). **KEPUTUSAN:** tambah kartu "**Riwayat Penerimaan**" — daftar per bulan (**total + jumlah invoice**), klik baris → **detail invoice** (pelanggan, nomor, metode, waktu diterima, jumlah) — urut terbaru. **Pakai jalur existing:** `getReceiptHistory` (fungsi service baru yang hanya mengelompokkan kolom yang sudah dibaca `getReceiptPositions`), `monthKeyInZone` (helper zona), `<details>` (pola `src/app/app/pengingat/inbox.tsx`) — **tanpa komponen client baru & tanpa query baru**. **Aturan angka (sama dengan kartu, satu sumber):** hanya baris **BERJEJAK** (setoran tercatat / verifikasi tercatat) yang dihitung, dikelompok menurut **zona tenant**; baris tanpa jejak (termasuk 25 baris REMITTED lama) **tidak pernah ditempatkan ke bulan mana pun** — mengarang bulan = kebohongan angka. **Keterbatasan jujur:** seluruh DB saat ini **0 baris berjejak** → riwayat tampil "Belum ada penerimaan tercatat" dan **mulai terisi sejak setoran/verifikasi dicatat lewat aplikasi**. Kartu "Penerimaan" juga diberi sub-label kondisional saat Rp0 ("0 · belum ada setoran/verifikasi tercatat bulan ini"). | `[x]` |
| **K16** | Naik kelas riwayat penerimaan (a–d, perintah pemilik 2026-10-18) | **Empat penambahan pada jalur yang sudah ada, tanpa jalur paralel:** **(a) Pemilih bulan + deep-link `?bulan=YYYY-MM`** — kartu "Penerimaan" & "Insentif" kini mengikuti bulan terpilih (default = bulan berjalan; **posisi "menunggu"/"disetor-tanpa-jejak" TETAP seluruh waktu — keadaan tidak kedaluwarsa**, prinsip K11) · navigasi ‹ bulan › pola identik `kinerja-board` (Button pustaka UI + `router.replace`) · helper bulan (`parseMonthKey`, `monthRangeForKey`, `shiftMonthKey`, `monthKeyLabel`) ditambah di **modul `tenant-timezone.ts` yang sudah ada** (membangun `fromZone`/`zoneParts` yang sudah ada) · label bulan satu sumber (fungsi lokal di halaman dihapus, anti-duplikasi). **(b) Ringkasan riwayat: total tahun terpilih + perbandingan vs bulan sebelumnya** — `summarizeReceiptHistory` murni di `ar-service.ts` (turunan dari `history` yang sudah dibaca — nol query baru); **pembagian nol ditolak eksplisit** (bulan sebelumnya tanpa jejak → tanpa persen, tanpa `Infinity/NaN`). **(c) Ekspor CSV per bulan** — route baru `GET /app/laporan/export?bulan=` **mengikuti pola persis** `/app/layanan/export` (guard OWNER/ADMIN + tenant, BOM UTF-8, `Content-Disposition`); helper `csvCell` **dipindah ke `src/lib/csv.ts` (satu sumber)** — `service-catalog-service` ikut memakainya, definisi lama dihapus (anti-fosil); tombol unduh tersedia untuk bulan terpilih **dan** seluruh riwayat (keduanya punya pemakai). **(d) Grafik tren 12 bulan** — `receipt-trend-chart.tsx` (client) **pola persis** `serviced-trend-chart.tsx` (ChartContainer `ui/chart` + recharts yang sudah ada); titik tanpa jejak = **0 penerimaan tercatat** (fakta, bukan data hilang — berbeda dari menempatkan baris tanpa jejak ke bulan tertentu); empty-state saat riwayat kosong. | `[x]` |
| **K17** | Bukti wajib saat teknisi menandai lunas TRANSFER/QRIS | **KEPUTUSAN PEMILIK 2026-10-18** (audit INV/2026/0034: teknisi menandai lunas TRANSFER **tanpa bukti** `paymentProofUrl = null`): **penandaan lunas TRANSFER/QRIS oleh TEKNISI TIDAK BISA tanpa foto bukti** — wajib di **service** (bukan hanya layar), konsisten dengan K5 (setoran tunai) dan K12 (teknisi wajib bisa kirim bukti). Bila teknisi tidak punya bukti, jalan yang benar = **biarkan "Menunggu Verifikasi"** dan minta bukti ke pelanggan — bukan menandai lunas tanpa bukti. **Bukti dari ADMIN/OWNER tetap opsional** — penandaan lunas oleh admin/owner sudah otomatis terverifikasi (K4) dan mereka memastikan uang masuk rekening langsung. **Verifikasi transfer/QRIS oleh owner/admin TANPA unggah foto rekening** (keputusan pemilik yang sama) — cukup catat siapa & kapan; alasan: pengguna awam, tanpa kehilangan ketelusuran (penerima + waktu tetap terekam). | `[x]` |

**Tafsiran yang mengikat pelaksanaan (koreksi bila salah):**
- **Pelanggan tempo:** admin tenant menandai lunas **justru karena** sudah melihat uang masuk rekening — tindakan itu **sendiri sudah berarti terverifikasi**. Jadi tidak ada langkah verifikasi tambahan untuk tempo. Aturan verifikasi (K4) berlaku pada penandaan lunas yang dilakukan **teknisi di lapangan**.
- ~~**Teknisi tidak perlu mengunggah bukti apa pun.** Aturan lama yang melarang teknisi mengunggah bukti **tetap berlaku dan tidak dibuka**.~~ **DIBATALKAN oleh K12 (perintah pemilik, 2026-10-18): teknisi WAJIB bisa mengirim bukti** (terima uang tunai / transfer / QRIS), khususnya pelanggan TOP CASH. Guard B-2 dibuka; kolom bukti tampil semua peran. Kalimat lama di atas hanya riwayat — **jangan diikuti**.

---

## BAGIAN 4 — ATURAN KERJA (tidak boleh dilanggar)

1. **Pakai jalur yang sudah ada, kembangkan — jangan bikin jalur baru.** Jalur baru hanya bila pencarian membuktikan belum ada dan jalur lama tidak bisa dipakai; catat alasannya lebih dulu di BAGIAN 5.
2. **Nol fosil.** Bila mengganti jalur lama: hapus bersih (fungsi, import, pemakaian, label) **dalam perubahan yang sama**, lalu buktikan dengan pencarian bahwa nama lama **tidak ada lagi** di `src/`.
3. **Sederhana.** Aplikasi ini untuk teknisi dan usaha mikro/kecil. Solusi paling kecil yang benar-benar menyelesaikan masalah. Tambahan kolom di tabel yang sudah ada lebih baik daripada tabel baru; tidak ada halaman pengaturan baru bila satu nilai bawaan cukup.
4. **UI harus seragam.** Setiap objek tampilan baru (tombol verifikasi, unggah bukti, baris daftar, label) **wajib disusun dari pustaka UI yang sudah ada** (`src/components/ui/`: badge, button, card, dialog, input, select, tabs, dll.) dan mengikuti pola layar yang sudah ada (kartu `Card`, pola ringkasan di halaman laporan, notifikasi `sonner`). **Dilarang** membuat gaya sendiri atau komponen paralel yang bentuknya beda dari yang sudah dipakai di aplikasi ini.
5. **Bahasa peran:** yang memakai fitur ini adalah **owner/admin tenant** dan **teknisi**. Admin platform Aircon mengurus kode, deploy, dan dokumen.
6. **Test dulu (RED → GREEN).** Jangan rusak pengaman yang sudah benar (atomik, batas tenant, teknisi hanya invoice buatannya).
7. **Nol mutasi database (termasuk data) tanpa izin tertulis pemilik.** Setiap perubahan struktur ditampilkan lebih dulu.
8. **Deploy hanya lewat** `bash scripts/deploy-vps.sh`. Jangan ada jalur deploy lain.
9. **Setiap langkah selesai wajib:** BAGIAN 7 diperbarui **dan** seluruh SSOT terkait diperbarui **dalam commit yang sama** — kode, dokumen, dan SSOT tidak boleh berbeda.
10. **Setiap klaim "selesai" wajib ada bukti:** nama test, SHA commit, SHA live, atau ucapan uji pemilik.
11. **Sebelum menambah objek tampilan (kartu, posisi, tombol, kolom, label) — wajib cari jalur yang sudah ada dulu.** Uji tiga pertanyaan berurutan: (a) apakah jalur/fungsi yang sudah ada bisa diperluas untuk kasus ini, (b) apakah kolom sudah ada di tabel (perpanjang select = bukan query baru), (c) apakah ada jalur unggah/aksi lain yang sudah dipakai. **Jalur baru hanya bila ketiganya terbukti tidak ada**, alasannya ditulis di BAGIAN 7 pada baris yang sama.
12. **Satu sumber untuk satu makna.** Bila menambah satu keadaan baru (mis. posisi uang, status), maknanya ditambahkan di SATU sumber definisi lalu dipakai semua layar — **dilarang** memperbaiki satu halaman dan membiarkan halaman lain menyebut keadaan yang sama dengan istilah berbeda. Bila sebuah fungsi lama menyebut sesuatu yang kini keliru (mis. nama fungsi menyebut "teknisi" padahal pemegang bisa pemilik), **ganti namanya bersih** — jangan dibiarkan agar tidak menyesatkan deep dive berikutnya.
13. **Setiap perbaikan yang menambah keadaan baru wajib mengunci kasus lama yang menyebabkan bug.** Bila sebuah bug lolos karena test hanya memakai data "bersih" (mis. kolom jejak selalu terisi), test untuk data "kotor" yang sebenarnya ada di produksi **wajib ditulis** — bukan hanya test untuk jalur normal.
14. **Data lama tidak boleh dirapikan diam-diam.** Baris data lama yang tidak lengkap **tampil apa adanya** dengan penjelasan, dan pemilik tenant yang melengkapinya lewat aplikasi. Mengisi/menghapus nilai data lama dari sisi sistem tetap butuh izin tertulis (aturan 7).
15. **Uji AKHIR dari tujuan perbaikannya, bukan hanya kondisi awal.** Setiap perubahan yang menuju suatu keadaan (mis. "baris lama dilengkapi → angka 0", "semua setoran berbukti") wajib diperiksa juga pada **keadaan tujuan akhirnya**: teks/narasi yang menyesatkan di kondisi penuh bisa jadi salah saat kondisinya kosong (dan sebaliknya). Dilarang menguji hanya pada data yang sedang bermasalah — kamera helikopter: lihat keseluruhan alur sampai tuntas.

---

## BAGIAN 5 — LANGKAH KERJA (urutannya wajib)

### L1 — Penanggalan mengikuti zona tenant (fondasi)
- **Kenapa dulu:** semua hitungan "bulan ini" dan "sejak X hari" bergantung padanya. Dikerjakan belakangan = menghitung ulang semua.
- **Kerja:** tambah **satu kolom zona waktu** pada data tenant (bawaan WIB); isi `Asia/Jakarta` untuk seluruh tenant yang ada (satu pembaruan data); tetapkan saat **onboarding tenant baru**; hitung batas bulan & selisih hari **menurut zona tenant**.
- **Jalur yang dipakai:** kolom di tabel `Tenant` yang sudah ada; perhitungan memakai pola perhitungan umur piutang yang sudah ada di `ar-service.ts`.
- **Test:** batas bulan menurut zona tenant · pembayaran 00.30 WIB tanggal 1 masuk bulan berjalan · tenant beda zona tidak saling mempengaruhi.
- **SSOT:** `SSOT_Alar_Invoicing.md` + dokumen ini.
- **Izin:** perubahan struktur + pengisian data → **tampilkan dulu, izin dulu.**

### L2 — Catatan setoran yang utuh (tanggal · penerima · bukti)
- **Kenapa:** tanpa ini "kas kantor" mustahil dihitung dan M2 tidak selesai.
- **Kerja:** tambah kolom **tanggal setoran**, **admin penerima**, dan **foto bukti** pada jalur setoran yang sudah ada; kembangkan `markCashRemitted` agar menulis ketiganya **dalam satu transaksi atomik** (semua berhasil atau semua batal).
- **Wajib:** setoran **tanpa foto / tanpa penerima ditolak** oleh sistem (bukan hanya di layar).
- **Test:** setoran mencatat tanggal+penerima+bukti · setoran tanpa bukti ditolak · klik ganda tidak menggandakan · data lama tidak tersentuh · pengaman lama tetap hijau.
- **SSOT:** `SSOT_Alar_Teknisi.md` (setoran kas) + dokumen ini.
- **Izin:** perubahan struktur → tampilkan dulu.

### L3 — Verifikasi transfer/QRIS oleh owner/admin tenant
- **Kerja:** tandai lunas oleh **teknisi** untuk transfer/QRIS → status **"menunggu verifikasi"** (belum masuk Penerimaan). **Owner/admin tenant** menekan "sudah masuk rekening" → tercatat siapa & kapan → baru masuk Penerimaan. Tandai lunas oleh admin/owner langsung dianggap terverifikasi.
- **(DIBATALKAN K12, 2026-10-18)** dulu: "Jangan mewajibkan bukti pada teknisi, atau membuka larangan lama" — kini teknisi **WAJIB bisa & diwajibkan** unggah bukti (K12). Verifikasi (L3) tetap berlaku: **bukti ≠ verifikasi** — bukti di tangan teknisi; verifikasi = admin memastikan dana masuk rekening.
- **Test:** transfer/QRIS oleh teknisi belum masuk Penerimaan · setelah diverifikasi baru masuk · uang tunai tidak terpengaruh · pengaman lama tetap hijau.
- **SSOT:** `SSOT_Alar_Invoicing.md` + dokumen ini.

### L4 — Tampilan posisi uang yang jujur + bukti yang terlihat
- **Kerja:** pecah kartu penerimaan jadi posisi yang jelas — **masuk kantor / menunggu setoran / menunggu verifikasi** — jumlah ketiganya harus cocok dengan total uang yang sudah diterima. Lalu **tampilkan foto bukti** di halaman faktur/tagihan tenant (selama ini tidak pernah terlihat).
- **Pakai:** kartu ringkasan yang sudah ada di halaman laporan (jangan bikin komponen baru).
- **Test:** tiga angka konsisten · bukti tampil hanya untuk tenant yang berhak.
- **SSOT:** dokumen ini + SSOT yang menyebut label status.

### L5 — Daftar setoran untuk owner tenant (penelusuran)
- **Kerja:** daftar setoran: **siapa menyetor → siapa menerima → kapan → fotonya → invoice mana saja**. Di halaman laporan yang sudah ada.
- **Test:** satu setoran muncul utuh dengan bukti yang bisa dibuka.
- **SSOT:** dokumen ini.

### L6 — Label status yang jujur
- **Kerja:** label "Lunas" tidak lagi berdiri sendiri — jelas posisinya (sudah masuk / menunggu setoran / menunggu verifikasi). Satu sumber label untuk seluruh layar.
- **Test:** tidak ada dua halaman yang memberi label berbeda untuk keadaan yang sama.
- **SSOT:** SSOT yang menyebut label.

### L7 — Beres-beres & bukti tuntas
- Seluruh test hijau · pemeriksaan tipe/gaya/build bersih · deploy SOP lewat jalur tunggal · bukti live diperiksa · **K8 (data PT Ase) dikerjakan sesuai izin** · **seluruh SSOT disamakan** · BAGIAN 7 diisi 100% dengan bukti.

### L8 — Perbaikan audit laporan (M7, M8, M9 — keputusan K13)
- **Kenapa:** dikerjakan setelah L7 karena ditemukan saat audit data live tenant Jaya Mandiri (2026-10-18), bukan saat penyusunan rencana.
- **Kerja (jalur yang sudah ada — bukan jalur baru):**
  1. **M7/K13:** `getReceiptPositions` diperluas — cabang CASH+REMITTED tanpa `remittedAt` masuk posisi baru `disetorTanpaJejak`; identitas tetap `penerimaan + menungguSetoran + menungguVerifikasi + disetorTanpaJejak = totalKotor`. Kartu ke-5 di `/app/laporan`. Sumber label: `money-position.ts` dipecah (aturan 12) — label jujur dipakai halaman faktur & laporan.
  2. **M8:** `getRemittances` ditambah `payMethod: "CASH"` (query existing, bukan query baru); baris setoran tanpa jejak tetap tampil dengan **tombol "Lengkapi Bukti"** (K14) yang memakai `markCashRemitted` mode `legacy` + `actionUploadRemitProof` (jalur existing) — **tidak ada service/action/komponen baru**.
  3. **M9:** `getUnremittedCashByTech` diganti nama jadi `getUnremittedCashByHolder` (aturan 12 — nama lama menyesatkan: pemegang bisa pemilik), select peran dari `User`, label baris "Pak Budi (pemilik)". Nama lama wajib **hilang dari `src/`** (anti-fosil).
- **Test (RED→GREEN, aturan 13 — kasus data "kotor" yang menyebabkan bug):** `REMITTED + remittedAt null` → `disetorTanpaJejak` (bukan 0, bukan penerimaan) · identitas 4-posisi · `getRemittances` tidak mengembalikan TRANSFER/QRIS ber-REMITTED · pemegang OWNER ditampilkan berperan · anti-fosil `getUnremittedCashByTech` kosong di `src/`.
- **SSOT:** dokumen ini (M7–M9, K13) + `SSOT_Alar_Teknisi.md` (nama fungsi/kartu kas).

### L9 — Riwayat penerimaan bulanan (keputusan K15)
- **Kenapa:** pemilik bertanya 2026-10-18 bagaimana melihat penerimaan bulan-bulanan sebelumnya — kartu "Penerimaan Bulan Ini" terkunci `now` dan tidak ada layar riwayat sama sekali (verifikasi: hanya satu pemanggil `getReceiptPositions`, selalu rentang bulan berjalan; tidak ada `searchParams` di `/app/laporan`).
- **Kerja (jalur yang sudah ada):**
  1. Helper `monthKeyInZone` di `tenant-timezone.ts` (membangun `monthRangeInZone`/`zoneParts` yang sudah ada) — pengelompokan ikut **zona tenant**, agar kesalahan M5 tidak muncul kembali di riwayat.
  2. `getReceiptHistory` di `ar-service.ts` — **fungsinya mengelompokkan kolom yang sudah dipilih** `getReceiptPositions` (bukan query/konsep baru), sekali baca, kelompok per bulan, sertakan detail invoice.
  3. Kartu "**Riwayat Penerimaan**" di `/app/laporan`: baris per bulan (total + jumlah invoice), expand `<details>` → detail invoice (pola `src/app/app/pengingat/inbox.tsx`) — **tanpa komponen client baru**.
  4. Sub-label kartu Penerimaan dibuat kondisional saat Rp0 (aturan 15).
- **Test (RED→GREEN):** `tests/tenant-timezone.test.ts` (4 test `monthKeyInZone`: zona, kasus 00.30 tanggal 1, zona rusak, konsistensi dengan `monthRangeInZone`) · `tests/ar-receipt-history.test.ts` (5 test service: urutan bulan, **baris tanpa jejak tidak dihitung**, guard query select-jejak-bukan-paidAt, giliran subuh tanggal 1, riwayat kosong) + 3 test kontrak halaman.
- **SSOT:** dokumen ini (K15) + `SSOT_Alar_Invoicing.md` bila menyebut kartu laporan.

### L10 — Riwayat penerimaan naik kelas: pemilih bulan · ringkasan · ekspor · grafik (keputusan K16 a–d)
- **Kenapa:** pemilik menilai L9 belum world-class — bulan tidak bisa dipilih/di-deep-link, tidak ada total tahun & perbandingan, tidak ada ekspor untuk akuntansi, tidak ada tren.
- **Aturan pengikat yang dipakai:** aturan 11 (jalur existing dulu), 12 (satu sumber untuk satu makna), 13 (uji data kotor), 15 (uji kondisi akhir).
- **Kerja (jalur existing — bukti "sudah ada" sebelum menulis):**
  1. **(a)** Helper bulan ditambah di `tenant-timezone.ts` (modul murni yang sudah ada) — bukan modul tanggal baru; `monthRangeForKey` dibuktikan identik `monthRangeInZone`. Halaman memakai `searchParams` (pola `kinerja`), navigasi `MonthNav` pakai `Link` + `buttonVariants` (pola link-tombol mapan) → **0 komponen client baru**.
  2. **(b)** `summarizeReceiptHistory` murni — turunan `history` yang sudah dibaca; **nol query**; pembagian nol ditolak eksplisit.
  3. **(c)** Route export mengikuti pola persis `/app/layanan/export`; `csvCell` dimigrasi ke `src/lib/csv.ts` **dengan pemakaian katalog dipindah di commit yang sama** (definisi lama dihapus, bukan dibiarkan).
  4. **(d)** Grafik memakai `ui/chart` + recharts **yang sudah terbukti dipakai** `serviced-trend-chart` (bukan memilih pustaka baru).
- **Test (RED→GREEN):** `tenant-timezone` +5 (helper bulan, termasuk tolak nilai tidak valid & lintas tahun) · `ar-receipt-history` +16 (ringkasan 6, CSV 4, titik grafik 4, kontrak halaman 5 + kontrak komponen 2; `read()` dibuat toleran berkas belum ada agar RED tampil sebagai assertion, bukan ENOENT).
- **Anti-fosil:** `function csvCell` di `src/` · `fmtMonth` lokal · `monthRangeInZone` di `/app/laporan` · label "Penerimaan Bulan Ini" di `src/` — seluruhnya KOSONG.
- **SSOT:** dokumen ini (K16) + `SSOT_Alar_Invoicing.md`.

---

## BAGIAN 6 — YANG BERLAKU SEBAGAI "SELESAI"

Satu baris BAGIAN 7 hanya boleh `[x]` bila **semuanya** terpenuhi dan buktinya tertulis:

- [ ] test gagal dulu (RED) lalu hijau (GREEN) — sebutkan nama test-nya
- [ ] bila ada jalur lama yang diganti: pencarian membuktikan nama lama sudah **tidak ada** di `src/`
- [ ] pemeriksaan tipe = 0 · gaya = 0 · build = 0
- [ ] seluruh test hijau — sebutkan jumlah berkas/test
- [ ] `bash scripts/deploy-vps.sh` **PASS** — sebutkan SHA commit & SHA live
- [ ] bukti live diperiksa — sebutkan apa yang dicek
- [ ] **SSOT terkait sudah diperbarui dalam commit yang sama**
- [ ] BAGIAN 7 diperbarui
- [ ] (L1, L2, K8) perubahan struktur/data ditampilkan ke pemilik **sebelum** dijalankan

---

## BAGIAN 7 — PROGRES (satu-satunya tempat membaca status)

```
ATURAN: sesi baru membaca bagian ini DULU, lalu melanjutkan dari baris [ ] pertama.
JANGAN ubah/hapus baris [x]. Koreksi = tambah baris baru bertanggal.
```

| # | Butir | Status | BUKTI (test / SHA / ucapan pemilik) |
|---|---|---|---|
| L1 | Kolom zona waktu tenant + isi WIB untuk tenant lama + onboarding | `[x]` | Migrasi `20261017090000_tenant_timezone` **dijalankan & diverifikasi** (6/6 tenant = `Asia/Jakarta`, termasuk PT Ase) · onboarding: field pilihan Zona Waktu di wizard (Select pustaka UI, default WIB) divalidasi `onboardingSchema` — `tests/onboarding-timezone.test.ts` (5 test) · client Prisma ter-regenerate |
| L1 | Semua penanggalan laporan memakai zona tenant | `[x]` | `tests/tenant-timezone.test.ts` (10 test RED→GREEN: bukti bug — uang 00.30 WIB tgl 1 dihitung bulan September oleh jalur lama) · `/app/laporan` & `/t` kini pakai `monthRangeInZone` — jalur lama `new Date(y,m,1)` di kedua berkas **KOSONG** (anti-fosil) · suite 104/873 · tsc=0 · eslint=0 · build=0 |
| L2 | Kolom setoran: tanggal + admin penerima + foto bukti | `[x]` | Migrasi `20261018000000_cash_remit_trace` **dijalankan & diverifikasi**: 3 kolom nullable terpasang (`remittedAt`, `remittedById`, `remitProofUrl`) · verifikasi data lama: **71 invoice, 0 punya jejak** (tidak ada data yang disentuh) |
| L2 | Setoran wajib bukti & penerima; atomik | `[x]` | `markCashRemitted` diperluas (jalur existing) → tulis jejak dalam 1 transaksi; **tolak tanpa foto / tanpa penerima** di SERVICE — `tests/ar-cash-remittance.test.ts` (L2, RED→GREEN) · dialog setoran pakai `Dialog` pustaka UI (confirm() bawaan terganti) · unggah via `putTenantAsset` scope `bukti` (jalur S3 existing) · suite 104/879 · tsc=0 · eslint=0 · build=0 |
| L3 | Transfer/QRIS oleh teknisi → menunggu verifikasi | `[x]` | `markInvoicePaid` diperluas (jalur existing): menandai lunas oleh **TEKNISI** → transfer/QRIS `status=PAID` **tanpa** verifikasi (nullable, tertulis null) · oleh **ADMIN/OWNER** → langsung terverifikasi + catat siapa/kapan · CASH tidak lewat verifikasi ini (jalur setoran L2) — `tests/invoice-verify.test.ts` (6 test RED→GREEN) |
| L3 | Owner/admin verifikasi (catat siapa & kapan) | `[x]` | `verifyInvoicePayment` (service): atomik `WHERE verifiedAt=null` (verifikasi ganda tidak menimpa) · DITOLAK utk CASH / belum lunas / sudah diverifikasi / dokumen lain · aksi `actionVerifyPayment` (guard OWNER/ADMIN) + `VerifyPaymentButton` di halaman faktur admin — pola identik `CancelInvoiceButton` (Button pustaka UI) · migrasi `20261018010000_invoice_verification` **dijalankan** (2 kolom nullable; data lama aman, null = belum diverifikasi) · suite **105/891** · tsc=0 · eslint=0 · build=0 |
| L4 | Kartu penerimaan dipisah 3 posisi | `[x]` | `getReceipts` **DIGANTI PENUH** jadi `getReceiptPositions` (3 posisi; identitas: ketiganya menjumlah tepat ke total lunas) · kartu laporan kini: Penerimaan (sudah masuk) · Menunggu Setoran (di teknisi) · Menunggu Verifikasi — pola `Stat` lokal diperluas (tone violet), 0 komponen baru · tabel per-teknisi dijelaskan lintas periode (K3) — `tests/ar-receipt-positions.test.ts` (7 test RED→GREEN) · anti-fosil: grep `getReceipts` di `src/` = KOSONG |
| L4 | Foto bukti tampil di halaman tenant | `[x]` | `InvoiceView` menampilkan blok "Bukti & status pembayaran" (badge metode + status posisi uang + gambar bukti bila ada; pola `<img>` QRIS yang sudah ada) — bukti kini terlihat (F-10/M4), tampil di halaman teknisi & admin sekaligus (satu komponen dipakai dua peran) |
| L5 | Daftar setoran (siapa→siapa→kapan→bukti) | `[x]` | `getRemittances` + kartu "Riwayat Setoran Kas" di `/app/laporan` (pola kartu existing) — `tests/ar-cash-remittance.test.ts` (L5, RED→GREEN: jejak penerima/bukti/waktu + guard tenant) · setoran lama tanpa jejak TAMPIL "belum tercatat", tidak disembunyikan |
| L6 | Label status jujur & seragam | `[x]` | **Satu sumber label posisi uang**: `src/lib/copy/money-position.ts` (pola `copy/job-status.ts`) — label + penjelasan + warna utk 7 keadaan · dipakai BERSAMA oleh **daftar faktur admin** (`invoices-board` — badge baru, halaman ini kini menunjukkan antrean menunggu verifikasi) dan **`InvoiceView`** (3 cabang badge inline L4 saya ganti jadi 1 fungsi) · label tunai TIDAK pernah menyebut "terverifikasi" · `listInvoicesByBucket` diperpanjang select-nya (bukan query baru) — `tests/money-position-label.test.ts` (7 test RED→GREEN) |
| L7 | Test penuh · tipe/gaya/build bersih | `[x]` | **107 berkas / 905 test hijau** · `tsc` = 0 · `eslint` = 0 error (2 warning lama, bukan milik perbaikan ini) · `next build` = 0 |
| L7 | Deploy SOP PASS + bukti live | `[x]` | `bash scripts/deploy-vps.sh` **PASS** — release live **`a66a01e`** (melengkapi `6c0c11c` L1 · `1a37664` L2+K9 · `11316bc` L3 · `c1e7fc1` L4+L6) · marker live: `https://app.airconet.id/` → 200 & `/login` → 200 · tree bersih · retensi 3 release |
| L7 | K8 data PT Ase — **TIDAK DISENTUH tanpa konfirmasi owner tenant** | `[x]` | Audit read-only 2026-10-18: 6 baris label salah diidentifikasi (5 belum-lunas + 1 transfer INV/2026/0003) · **nol baris diubah** — data tidak bisa membedakan "belum bayar" vs "sudah bayar belum dicatat" · akar (K9) dihapus sehingga pola tidak terulang · tertulis di K8 |
| L7 | Seluruh SSOT disamakan | `[x]` | `SSOT_Alar_Teknisi.md` (L1–L6, K9, L2/L3 diperbarui di commit masing-masing) · `SSOT_Alar_Invoicing.md` **baru diperbarui** (1.1 stempel closing dihapus sesuai K9; blok "POSISI UANG & JEJAK" memuat L2/L3/L4/L6/K7) · dokumen rencana BAGIAN 7 |
| K9 | Hapus stempel label posisi uang saat closing | `[x]` | `worksession-service.ts` — baris `cashRemitStatus: docType === "INVOICE" ? ...` **DIHAPUS** · anti-fosil: grep `cashRemitStatus` di `worksession-service.ts` = **KOSONG** · `tests/worksession.test.ts` RED→GREEN (16 test) · suite 104/879 · tsc=0 · eslint=0 · build=0 |
| K10 | Panel pembayaran sadar peran (laporan pemilik 2026-10-18) | `[x]` | **Masalah dilaporkan**: teknisi memilih foto bukti → tombol "Tandai LUNAS" disabled tanpa penjelasan. **Akar (F-05+F-06)**: panel SAMA dipakai teknisi & admin, guard upload `assertRole(OWNER/ADMIN)` menolak teknisi — kolom bukti terlihat tapi upload ditolak senyap; `disabled={pending\|\|uploading}` tanpa indikator. **Perbaikan**: `PaymentPanel` menerima `role` → teknisi TIDAK melihat kolom bukti (alur K3 tak berubah), admin tetap; tombol menampilkan "Mengunggah…" saat proses. `tests/payment-panel-role.test.ts` (4 test RED→GREEN) · suite 909 · tsc=0 · lint=0 · build=0 |
| K11 | Konsistensi angka laporan (laporan pemilik 2026-10-18) | `[x]` | **Masalah**: kartu "Menunggu Setoran" (Rp225.000) ≠ tabel "Kas Belum Disetor per Teknisi" (Rp2.855.000) di layar yang sama. **Akar (KESALAHAN SAYA)**: kartu berperiode bulan, tabel seluruh waktu — uang fisik di tangan teknisi tidak kedaluwarsa di akhir bulan. **Perbaikan**: posisi `menungguSetoran` & `menungguVerifikasi` = **keadaan seluruh waktu** (identik tabel); `penerimaan` = **arus menurut waktu DITERIMA** (setoran/verifikasi tercatat di rentang — definisi pemilik K1/K2) · sub-label kartu menjelaskan sifat angka · `tests/ar-receipt-positions.test.ts` (8 test, termasuk regression uang lunas bulan lalu) · suite 910 · tsc/lint/build 0 |
| K12 | Bukti dari teknisi DIBUKA (keputusan pemilik 2026-10-18) | `[x]` | **Perintah pemilik**: teknisi **WAJIB** bisa mengirim bukti (terima uang tunai / transfer / QRIS), khususnya pelanggan TOP CASH — membatalkan guard B-2 lama & keputusan K10 saya yang menyembunyikan kolom **tanpa persetujuan** (saya akui itu keliru). **Dikerjakan**: guard `assertRole` dibuka utk `TECHNICIAN`; kolom bukti tampil semua peran; **prop `role` dihapus bersih** (fosil) + kontrak test jadi anti-fosil · `tests/invoice-payment-guard.test.ts` & `tests/payment-panel-role.test.ts` (RED→GREEN) · suite 910 · tsc/lint/build 0 |
| L7 | Uji pemilik (owner/admin tenant) atas alur baru | `[ ]` | — |
| L8 | M7/K13 — tunai disetor TANPA jejak tampil sebagai posisi sendiri | `[x]` | `getReceiptPositions` diperluas: `disetorTanpaJejak` (keadaan seluruh waktu) · identitas **4 posisi** `penerimaan + menungguSetoran + menungguVerifikasi + disetorTanpaJejak = totalKotor` · kartu ke-5 "Disetor — Belum Ada Bukti" di `/app/laporan` · **tidak dihitung sebagai Penerimaan** (tanpa jejak = tanpa bukti, K5) · **tidak dikarang tanggal/penerima/bukti** · test RED→GREEN `tests/ar-receipt-positions.test.ts` (4 test baru: kasus data kotor `REMITTED+remittedAt null`, identitas 4 posisi, angka kasus live Jaya Mandiri Rp3.800.000 — sebelumnya kartu "Penerimaan" = Rp0 untuk uang yang menurut data sudah di kantor — dan anti-dobel) |
| L8 | M7/K13 — label jujur di SATU sumber (halaman faktur & laporan) | `[x]` | `money-position.ts` (aturan 12): kunci baru `CASH_REMITTED_NO_TRACE` ("Tunai — disetor, bukti belum lengkap") · `moneyPositionOf` menerima `remittedAt?` · select `remittedAt` diperpanjang di `listInvoicesByBucket` (bukan query baru) & tipe `InvoiceView` · `tests/money-position-label.test.ts` RED→GREEN — dua halaman tak lagi bisa memberi label berbeda untuk keadaan sama |
| L8 | M8 — Riwayat Setoran Kas hanya uang tunai | `[x]` | `getRemittances` ditambah `payMethod: "CASH"` (query existing) — 8 invoice transfer/QRIS ber-`REMITTED` (Rp4.340.000, sisa kode lama) tak lagi tampil sebagai "setoran kas" · test `tests/ar-cash-remittance.test.ts` RED→GREEN (baris + guard query) |
| L8 | M9 — pemegang uang dinamai menurut PERAN aslinya | `[x]` | `getUnremittedCashByTech` **DIGANTI** jadi `getUnremittedCashByHolder` (aturan 12: nama lama menyesatkan) — select peran dari `User` (bukan query baru) · prop `techId/techName` → `holderId/holderName/holderRole` di service, halaman laporan, dan `RemitButton` · label kartu "per Teknisi" → "per Pemegang Uang", baris tampil "Pak Budi (pemilik)" · **anti-fosil: grep `getUnremittedCashByTech`, `techName`, `u.techId` di `src/` = KOSONG** · test RED→GREEN |
| L8 | Koreksi keheningan `markCashRemitted` (cacat pada jalur existing) | `[x]` | `updateMany` bisa kena 0 baris dan diam-diam kembali `0` → action melaporkan sukses padahal tidak ada data berubah (menyesatkan pemilik) · kini `count ≠ jumlah yang diminta` → DITOLAK + rollback (atomik; `payMethod: "CASH"` ikut di-guard) · test RED→GREEN (sebagian id tak lolos syarat · nol baris terkena) |
| L8 | **K14 — tombol "Lengkapi Bukti" di baris setoran tanpa jejak** | `[x]` | **DIBUKA atas perintah pemilik 2026-10-18** (butir `[ ]` sebelumnya dibatalkan): kartu pengingat tanpa aksi = membebani tenant atas transaksi yang terjadi sebelum jejak diwajibkan. **Kerja:** `markCashRemitted` + mode `"legacy"` (jalur/service YANG SAMA — `CashRemitMode`) yang hanya menyentuh `REMITTED` + `remittedAt` null · `actionMarkCashRemitted` + param mode · `RemitButton` + prop `mode` (label/tombol/dialog jadi "Lengkapi Bukti") · dipasang di baris Riwayat Setoran yang `proofUrl`-nya null · penerima = sesi admin, wajib foto (K5) · **jejak lama tidak pernah ditimpa** · `tests/ar-cash-remittance.test.ts` RED→GREEN (5 test: guard mode, tolak baris bukan milik mode, atomik, K5 tetap berlaku) · suite 926 · tsc/lint/build 0 |
| L8 | Koreksi sub-label kartu ke-5 pada kondisi 0 (kamera helikopter) | `[x]` | **Ditunjuk pemilik 2026-10-18**: tujuan akhir K14 = baris beres → angka 0, tetapi sub-label tetap "jejak setoran lama belum tercatat" (kalimat menyesatkan; perbaikan sebelumnya hanya diuji pada kondisi penuh = kacamata kuda). **Perbaikan**: sub-label KONDISIONAL — `count > 0` seperti sekarang, selain itu "semua setoran sudah tercatat berbukti"; **kartu tetap tampil** (grid tidak berpindah, posisi tetap diaudit utk identitas 4 posisi). **Audit seluruh halaman laporan**: kartu lain netral saat Rp0, 4 blok daftar punya empty-state sendiri — hanya kartu ini yang bermasalah. Test kontrak `tests/money-position-label.test.ts` (RED→GREEN) |
| L8 | Test penuh · tipe/gaya/build bersih | `[x]` | **108 berkas / 927 test hijau** · `tsc` = 0 · `eslint` = 0 error (2 warning lama: `AuthError` di `src/app/t/faktur/actions.ts` & `ACTOR_TECH_OWN` di `tests/invoice-flow.test.ts` — bukan milik perbaikan ini) · `next build` = 0 |
| L8 | Deploy SOP PASS + bukti live | `[x]` | `bash scripts/deploy-vps.sh` **PASS** — release live **`246fc87`** (sebelumnya `a66a01e`) · artefak SHA256 `d5234ede…af31a4` · boot-test lokal & VPS · retensi 3 release · `/` → 200, `/login` → 200 |
| L8 | Deploy K14 PASS + bukti live | `[x]` | `bash scripts/deploy-vps.sh` **PASS** — release live **`61187d2`** · artefak SHA256 `048ff547…30cc0c4` · boot-test lokal & VPS · retensi 3 release · `/` → 200, `/login` → 200 |
| L8 | Deploy koreksi sub-label PASS + bukti live | `[x]` | `bash scripts/deploy-vps.sh` **PASS** — release live **`ccfcb13`** (kini live) · artefak SHA256 `753e812e…9bbbc8e` · boot-test lokal & VPS · retensi 3 release · `/` → 200, `/login` → 200 |
| L9 | K15 — Riwayat Penerimaan per bulan (total + detail) | `[x]` | `monthKeyInZone` (zona tenant) + `getReceiptHistory` (kelompok jejak per bulan + detail invoice) + kartu "**Riwayat Penerimaan**" pakai `<details>` (pola existing, tanpa komponen client baru) · urut terbaru · baris tanpa jejak TIDAK ditempatkan ke bulan mana pun · sub-label kartu Penerimaan kondisional saat Rp0 · **keterbatasan jujur: DB 0 baris berjejak → riwayat kosong & mulai terisi sejak setoran/verifikasi dicatat** · `tests/tenant-timezone.test.ts` (4) + `tests/ar-receipt-history.test.ts` (8) RED→GREEN · suite **109 berkas / 939 test** · tsc=0 · eslint=0 error · build=0 |
| L9 | Deploy PASS + bukti live | `[x]` | `bash scripts/deploy-vps.sh` **PASS** — release live **`5e764e4`** · artefak SHA256 `dfba96d3…3d710f` · boot-test lokal & VPS · retensi 3 release · `/` → 200, `/login` → 200 · SSOT `SSOT_Alar_Invoicing.md` diselaraskan (4 posisi, mode legacy, koreksi typo "TANPAWAJIB") |
| L10 | K16(a) — pemilih bulan + deep-link `?bulan=` | `[x]` | Helper bulan di **modul `tenant-timezone.ts` yang sudah ada** (membangun `fromZone`/`zoneParts`): `parseMonthKey` (**nilai tidak valid DITOLAK → bulan ini, bukan diam-diam**), `monthRangeForKey` (pasangan `monthRangeInZone` — test buktikan identik), `shiftMonthKey` (lintas tahun Des→Jan), `monthKeyLabel`. Halaman baca `searchParams.bulan` (pola `kinerja`) · navigasi ‹ bulan › "Bulan ini" lewat `MonthNav` (server + `Link`/`buttonVariants` — **tanpa komponen client baru**; tata letak pola `kinerja-board`) · **Kartu Penerimaan & Insentif kini mengikuti bulan terpilih**; posisi "menunggu"/"disetor-tanpa-jejak" TETAP seluruh waktu (K11) · label bulan satu sumber (`fmtMonth` lokal dihapus — anti-duplikasi) · test `tests/tenant-timezone.test.ts` RED→GREEN (5) |
| L10 | K16(b) — ringkasan: total tahun + vs bulan lalu | `[x]` | `summarizeReceiptHistory` murni di `ar-service.ts` (turunan `history` yang sudah dibaca — **0 query baru**): total tahun terpilih · bulan ini · bulan lalu (lintas tahun) · **`changePct` NULL bila bulan lalu 0** (pembagian nol ditolak — tanpa Infinity/NaN di layar) · tahan baris ganda per kunci (dijumlahkan, bukan `.find()`) · test RED→GREEN (6 termasuk kondisi 0 & riwayat kosong) |
| L10 | K16(c) — ekspor CSV per bulan / semua | `[x]` | `csvCell` **dipindah ke `src/lib/csv.ts` (satu sumber)**; `service-catalog-service` ikut memakai, definisi lokal dihapus (anti-fosil, grep `function csvCell` di `src/` = KOSONG kecuali satu-satunya di `src/lib/csv.ts`) · **TEMUAN PENTING (aturan 12 — beda makna = beda nama):** `api/agen/reseller-export` punya `csvCell` yang **SAMA NAMA tapi beda makna** — selalu mengutip + mem-prefix apostrof (CWE-1236 anti formula-injection). Awalnya saya berniat menyatukannya; itu akan **MENGHAPUS proteksi keamanan** (escaping biasa tidak mengutip semua sel). Maka **tidak disatukan** — dinamai ulang `csvCellFormulaSafe` dengan komentar eksplisit kenapa berbeda; proteksi tetap utuh (diuji tetap jalan). · `exportReceiptHistoryCsv` di service (pola `exportCatalogCsv`: header Indonesia, `\r\n`, opsi rincian; waktu MENURUT ZONA TENANT) · route `GET /app/laporan/export` **pola persis** `/app/layanan/export` (guard OWNER/ADMIN + tenant dari sesi, BOM UTF-8, `?bulan=` + `?detail=1`; **`bulan` tidak valid → 400**, bukan mengunduh bulan lain) · tombol "Unduh bulan (CSV)" & "Unduh semua" (keduanya ber-Fungsi: bulan terpilih + rincian, atau seluruh riwayat) · test RED→GREEN (4 termasuk escaping) |
| L10 | K16(d) — grafik tren 12 bulan | `[x]` | `receipt-trend-chart.tsx` (client) **pola persis `serviced-trend-chart.tsx`** — `ChartContainer` `ui/chart` + recharts yang sudah ada; **0 komponen chart bespoke** · `receiptTrendPoints` murni (turunan `history`): **tepat 12 titik berakhir pada bulan terpilih**, lintas tahun benar, bulan tanpa jejak = **0 penerimaan tercatat** (fakta; berbeda dari "menempatkan baris tanpa jejak"), bulan di luar jendela tidak ikut, Januari membawa tahun 2 digit sebagai penanda · empty-state saat 12 bulan tanpa jejak · test RED→GREEN (4 + kontrak komponen: wajib `ui/chart`/recharts/"use client") |
| L10 | Test penuh · tipe/gaya/build bersih · anti-fosil | `[x]` | **109 berkas / 966 test hijau** · `tsc` = 0 · `eslint` = **0 error, 2 warning LAMA** (test ini menghasilkan 2 warning baru — keduanya saya bersihkan: parameter `timezone` tak terpakai & helper grafik yang tak terpakai) · `next build` = 0 · anti-fosil (diaudit ulang dengan grep, bukan klaim): definisi `function csvCell` hanya **1** (`src/lib/csv.ts`) + `csvCellFormulaSafe` (beda makna, dilabeli) · `fmtMonth` lokal = KOSONG · `monthRangeInZone` di `/app/laporan` = KOSONG · label "Penerimaan Bulan Ini" di `src/` = KOSONG (sisa di test/dokumen = catatan riwayat) |
| L10 | Deploy PASS + bukti live | `[x]` | `bash scripts/deploy-vps.sh` **PASS** — release live **`aa6ea16`** · artefak SHA256 `60e829d0…36dce5` · boot-test lokal & VPS · retensi 3 release · `/` → 200, `/login` → 200 · route baru `ƒ /app/laporan/export` **terdaftar di build output** |
| L11 | Ringkasan Pekerjaan teknisi = APA YANG DIKERJAKAN (laporan pemilik 2026-10-18) | `[x]` | **Masalah dilaporkan**: `…/t/pekerjaan/cmtebahnp009lnn723gte607n` — kartu "Ringkasan Pekerjaan" hanya menampilkan 1 pekerjaan, padahal 3. **Akibat data (diukur)**: kartu hanya menampilkan `job.serviceType` = **"INSTALL"** (1 nilai jenis job), sedangkan job itu punya **3 item** (Cuci AC ¾–1 PK + Cuci AC 1,5–2 PK + Isi Freon R32 = **Rp325.000**, tercatat di sesi `cmvdq2mye…` CLOSED 11:15:51 → INV/2026/0034). **Akar**: kartu tidak membaca WorkItem; juga membawa **ternary fosil** (kedua cabang `job.serviceType`). **Perbaikan jalur existing**: `getJobCost` (jalur biaya resmi, sudah dipakai halaman admin) **diperpanjang** agar ikut mengembalikan `items` (deskripsi + qty + unit + lineTotal dari kolom DB — **nilai tidak dikarang**); halaman teknisi memanggilnya (nol query baru, nol komponen baru) dan merender daftar item + "Jumlah pekerjaan (N)" · baris "Layanan" tetap sebagai cadangan bila belum ada item · helper `rp` disatukan (format inline duplikat di baris "Menunggu pelunasan" ikut memakai `rp`) · ternary fosil **DIHAPUS** · test RED→GREEN: `tests/job-cost.test.ts` (4 baru — termasuk jumlah item 3 & akurasi Rp325.000) · kontrak halaman `tests/tech-detail-completed-content.test.ts` (4 baru) · suite **109 berkas / 974 test** · tsc=0 · eslint=0 error · build=0 |
| L11 | Deploy PASS + bukti live | `[x]` | `bash scripts/deploy-vps.sh` **PASS** — release live **`773d3b5`** · artefak SHA256 `4710ac8b…a21b1` · boot-test lokal & VPS · retensi 3 release · `/` → 200, `/login` → 200 |
| L12 | K17 — bukti WAJIB utk penandaan lunas TRANSFER/QRIS oleh teknisi | `[x]` | **Masalah (audit INV/2026/0034)**: teknisi Ryan menandai lunas TRANSFER **tanpa bukti** (`paymentProofUrl = null`) — K12 lama hanya membuka kolom, K5 hanya mewajibkan foto utk setoran tunai → celah. **Guard di SERVICE** `markInvoicePaid`: `payMethod ≠ CASH && role = TECHNICIAN && tanpa bukti` → **DITOLAK** (pesan jelas: minta bukti / biarkan Menunggu Verifikasi) · **CASH tetap opsional** utk teknisi (K3) · **ADMIN/OWNER semua metode tetap opsional** (K4: sudah otomatis terverifikasi). **Layar**: prop `requireProof` (boolean semantik — **bukan prop peran**, konsisten anti-fosil K12) → `needsProof = requireProof && method ≠ CASH` → label bukti "wajib"/"opsional", peringatan amber, tombol terkunci · halaman **teknisi** kirim `requireProof`, halaman **admin** tidak (keputusan pemilik: verifikasi utk owner = cukup catat siapa & kapan, **tanpa unggah foto rekening**). **Kontrak lama digugurkan secara terbuka** (pola K12 pada F2): test K3 "teknisi bisa lunas tanpa bukti" ditulis ulang jadi kontrak K17 · test L3 jalur positif kini memakai bukti. Test RED→GREEN: `invoice-payment-guard` +6 (K17) · `payment-panel-role` +5 kontrak (termasuk pemakaian per halaman) · suite **109 berkas / 985 test** · tsc=0 · eslint=0 error · build=0 |
| L12 | Deploy PASS + bukti live | `[x]` | `bash scripts/deploy-vps.sh` **PASS** — release live **`d5539c4`** · artefak SHA256 `f3db497f…52615` · boot-test lokal & VPS · retensi 3 release · `/` → 200, `/login` → 200 |
| L13 | Guard deploy: HEAD harus == origin/main (AGENTS.md:15 + skill) | `[x]` | Commit **`705aeeb`** menambah pengecekan `origin/main` di `scripts/deploy-vps.sh`. Pushed ke GitHub sebelum deploy (`ls-remote` = 705aeeb). `bash scripts/deploy-vps.sh` **PASS** — release live **`705aeeb`** · `current` → `releases/705aeeb…/app` · `source-sha` = 705aeeb · service active · `/` & `/login` → 200 · retensi 2 release (705aeeb, d5539c4) |

**Progres: 18 dari 19 butir lama + 8 butir L8 + 1 butir L9 (K15) + 5 butir L10 (K16) + 1 butir L11 + 2 butir L12 (K17 bukti wajib) — semua `[x]`; K8 tuntas sebagai keputusan (tak disentuh). Sisa terbuka: L7 uji pemilik `[ ]`.**

---

## BAGIAN 8 — SSOT YANG WAJIB IKUT DIPERBARUI

| Perubahan | SSOT |
|---|---|
| Invoice, tagihan, kwitansi, pembayaran, verifikasi | `docs/SSOT_Alar_Invoicing.md` |
| Alur teknisi: penutupan pekerjaan, penandaan lunas, setoran kas | `docs/SSOT_Alar_Teknisi.md` |
| Penerimaan, kartu laporan, kas, zona waktu | dokumen ini |

Bila ada SSOT lain yang menyebut alur terkait, ikut diperbarui pada commit yang sama.

---

## BAGIAN 9 — RIWAYAT (bukan status)

- Rencana versi lama `docs/RENCANA_Kas_Tunai_Tampilan_Keuangan.md` — **dihapus 2026-10-16**, isinya digantikan dokumen ini.
- Penomoran lama (`G1-G6`, `D1-D5`, `D-A..D-E`, `F1-F7`, `U1-U5`, `F-01..F-17`, `DOM-1..DOM-5`, `C1..C6`, `WP0..WP7`) **tidak dipakai lagi**.
- Pemetaan cepat: `C1→K1`, `C2→K2`, `C3→K3+K4`, `C4→K5`, `C5→K6 (dibatalkan)`, `C6→K8`, `WP0→BAGIAN 3`, `WP1→L2`, `WP2→L3`, `WP3→L4`, `WP4→L2+L5`, `WP5→K6 (tidak dikerjakan)`, `WP6→L6`, `WP7→L7`. Zona waktu (**K7**) adalah keputusan baru.
- Item yang **sengaja TIDAK dikerjakan**: batas waktu setoran/peringatan keterlambatan, saldo kas berjalan, pembukuan pengeluaran, halaman pengaturan zona waktu terpisah, laporan kualitas data.
