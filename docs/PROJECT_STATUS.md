# PETA KONDISI AIRCON — Status & Rencana Lanjutan (SUMBER KEBENARAN)

> Dokumen tunggal untuk melanjutkan dengan aman kapan pun. Diperbarui tiap milestone.
> Terakhir diperbarui: 20 Agustus 2026. Commit HEAD saat ditulis: a811971.
> Jika sesi baru: BACA FILE INI DULU untuk tahu persis di mana kita berhenti.

## 1. RINGKAS SATU PARAGRAF
Aircon (AC Service Growth OS) — SaaS PWA multi-tenant untuk usaha servis AC kecil Indonesia,
Digital Asset #1 dari "12 SaaS/tahun". Aplikasi LIVE di Vercel, infrastruktur WhatsApp+MQTT
LIVE di VPS BiznetGio (systemd-native, tanpa Docker), HTTPS via gw.lumite.biz.id. Progress
menuju go-komersial ~93%. Sisa mayoritas = konfigurasi eksternal + validasi pilot, bukan coding.

## 2. YANG SUDAH LIVE & TERBUKTI
- App produksi: https://aircon-peach.vercel.app (Vercel Hobby, project aircon, team lumite1)
- DB: Supabase Tokyo (ref ksvdjtzfpictmwuksmuu)
- Gateway WhatsApp: https://gw.lumite.biz.id (HTTPS Let's Encrypt, auto-renew, port 8080 ditutup)
- VPS-INFRA: 103.127.138.16 (rad4ssh, key ~/.ssh/aircon-ssh.pem) — 3 service systemd aktif+enabled:
  mosquitto, aircon-gateway (:8080, MemoryMax 2500M), aircon-bridge. Swap 2GB. RAM idle ~275MB.
- WhatsApp TERBUKTI dua-arah: kirim (money loop) + terima balasan, nomor pilot 085880181816
  tertaut (sesi persisten, reconnect tanpa QR ulang). Nomor tujuan uji: 6281284848901.
- S3 BiznetGio NEO AKTIF: bucket aircon, endpoint https://nos.jkt-1.neo.id, region idn,
  path-style. Teruji upload/GET/delete. 7 env di Vercel.
- Money loop end-to-end: cron reminders -> MessageLog QUEUED -> flusher -> gateway -> WA. Terbukti
  (MessageLog SENT + gatewayMessageId nyata).
- Tenant demo di-seed: /demo hidup (AC Jaya Demo, 2 pelanggan, money loop terisi).
- Kualitas: 177 test lulus, tsc 0, build hijau. Review keamanan independen tiap batch.

## 3. FITUR SELESAI (per domain)
- Inti: multi-tenant, onboarding, 4 peran (owner Google SSO / admin / teknisi phone+PIN / customer booking publik)
- Job Order FSM + app teknisi (checklist, foto S3, timeline) + kuota per paket
- Billing Midtrans (langganan + IoT jual-putus) — MASIH SANDBOX; PPN PKP-aware; faktur/kwitansi
- Dunning otomatis + teks penagihan editable admin
- Program keagenan LENGKAP: F1 mesin uang (komisi/clawback/PPh) + F2/F3 portal agen & reseller + CSV
- IoT: ingest + deteksi alert (ambang editable admin) + 1-tap buat pekerjaan
- Shared WA+MQTT gateway multi-app (untuk 12-SaaS) + dokumentasi developer (docs/infra/)
- No-hardcode 100%: semua aturan bisnis DB-driven + editable admin (paket, kebijakan, infra,
  keagenan, perusahaan, IoT, template WA tenant /app/pesan, checklist /app/checklist)

## 4. YANG BELUM SELESAI (prioritas menuju go-komersial)
### KRITIS (butuh input/keputusan owner)
1. Midtrans PRODUCTION — ✅ SELESAI (20 Agu 2026). MIDTRANS_ENV + NEXT_PUBLIC_MIDTRANS_ENV =
   production di Vercel; server key production terverifikasi VALID (HTTP 200 api.midtrans.com);
   webhook via X-Override-Notification -> NEXT_PUBLIC_APP_URL. Merchant G523181402.
   CATATAN: kini pembayaran = UANG NYATA (kartu test tak berlaku). Belum ada transaksi produksi nyata.
2. Warm-up nomor WA — 7 hari (by-design pelan agar tak diblokir). Mulai setelah nomor bisnis final.
3. Pilot 3-5 tenant NYATA — penemu bug lapangan, tak tergantikan.

### PENTING
4. Status PKP Lumite — konfirmasi (default isPkp=false). Pengaruh ke PPN faktur.
5. Rotate kredensial — SEMUA kredensial pernah lewat chat (S3, gateway key, MQTT, VPS, Midtrans,
   PARTNER_ENC_KEY, IOT_BRIDGE_TOKEN). Setelah stabil, regenerate di panel masing-masing.

### NICE-TO-HAVE (pasca-launch)
6. Kwitansi PDF untuk job/servis (kini hanya langganan)
7. Portal customer akhir (tracking servis mandiri)
8. Dashboard metrik admin (activation/retensi)
9. Migrasi app Vercel->VPS-APP (saat menagih massal / keluar batas Hobby)
10. TLS MQTT (port 8883) untuk device IoT dari internet — kini Mosquitto 127.0.0.1:1883 lokal

### KEPUTUSAN DESAIN TERTUNDA — "Catatan medis mesin AC" lintas-tenant (26 Agu 2026)
Owner mempertimbangkan: bila 1 pelanggan dilayani 2+ tenant, riwayat perawatan unit AC pecah;
usulan awal = catatan GLOBAL lintas-tenant agar 1 unit = 1 riwayat.
KESIMPULAN (setelah analisis): JANGAN global-otomatis. 3 alasan penentu:
 (a) IDENTITAS: tak ada registry AC nasional; serial sering kosong/salah/terhapus → sistem tak bisa
     andal tahu 2 tenant menyervis unit fisik yang sama (risiko salah-gabung/gagal-gabung).
 (b) PRIVASI/HUKUM: catatan memuat harga, diagnosis, data pribadi pelanggan (UU PDP). Global =
     bocor kompetitif antar-tenant + rusak model kepercayaan CRM privat (nilai jual inti).
 (c) KEPEMILIKAN: konflik edit/koreksi lintas badan usaha.
ARAH YANG BENAR (analogi rekam medis: ikut PASIEN, pindah atas IZIN):
 - Riwayat tetap PRIVAT per-tenant (isolasi tak dirusak).
 - Portabilitas ATAS-IZIN pelanggan: pemilik unit membagikan riwayat ke tenant baru saat booking
   (consent-driven copy via halaman booking/QR di unit) — BUKAN visibilitas global.
LANGKAH BERTAHAP (belum dibangun; tunggu bukti kebutuhan — di pilot kemungkinan ~nol):
 1) SEKARANG (opsional, low-risk): kuatkan identitas unit (serial/brand/model/PK/installedAt rapi)
    + dedupe DALAM-tenant (1 unit fisik = 1 record). Menyiapkan data utk portabilitas nanti.
 2) NANTI: portabilitas atas-izin. 3) JANGAN bangun global lintas-tenant.
Model saat ini: Asset {tenantId, customerId, serial?(opsional), deviceId?@unique} — riwayat via JobOrder.

### KEPUTUSAN DESAIN TERTUNDA — Identitas unit AC & kasus banyak-unit-kembar (26 Agu 2026)
Konteks nyata (PASTI terjadi): dalam 1 tenant, 1 pelanggan ditangani teknisi berbeda dari waktu
ke waktu → kalau identitas unit kabur, teknisi kedua bikin record baru → DUPLIKAT → rekam medis pecah.
FAKTA KODE (sudah baik, tak perlu ubah):
 - Reminder SUDAH per-mesin (RepeatReminder.assetId, unique [tenantId,assetId,dueDate]).
 - Reminder SUDAH di-BATCH per pelanggan (374b93e): banyak unit due hari sama = 1 WA berisi daftar
   (template reminder_multi, editable /app/pesan). Cegah banjir notifikasi institusi.
KEPUTUSAN identitas unit (owner setuju arah, BELUM dibangun — tunggu bukti pilot):
 - Lokasi = FREE-TEXT (bukan dropdown baku; tiap tempat beda). RENCANA: combobox free-text yang
   MENYARANKAN lokasi yang pernah dipakai (per pelanggan → per tenant) agar seragam & anti-duplikat
   "kamar depan" vs "k.tamu". Data membangun dirinya; tak perlu tabel preferensi manual.
 - Anti-duplikat utama = ALUR find-before-create (pilih unit existing dulu; "tambah unit" opsi terakhir).
   CATATAN: di form JOB sudah ada (filter unit per pelanggan). Yang kurang: saat TAMBAH unit baru.
 - Dedup-warning HARUS LUNAK (warn, jangan blokir) — unit kembar itu SAH.
 - STIKER/KODE UNIT = OPT-IN (revisi 26 Agu, owner): JANGAN wajib/global. Untuk RUMAH pelanggan sering
   menolak → jangan paksa. Untuk INSTITUSI (masjid/kantor banyak unit KEMBAR) stiker kode kecil
   (mis. U-001..U-008) JUSTRU membantu: satu-satunya cara andal bedakan unit identik + pengelola ikut
   kontrol riwayat. Jadi: fitur opsional per-unit (generate kode pendek, boleh ditempel bila mau),
   bukan kewajiban. Kode ini kelak = jembatan ke portabilitas atas-izin (tunjukkan kode → riwayat unit).
KASUS BANYAK-UNIT-KEMBAR (mis. masjid 8 AC merek/tipe/PK/lokasi SAMA — atribut identik, teknisi pun
sulit bedakan unit fisiknya):
 - KEPUTUSAN default = Pola B: 1 aset + field JUMLAH unit (quantity), diservis sekaligus. Ringan,
   realistis untuk borongan. Riwayat = "8 unit dicuci tgl X".
 - Bisa "PECAH" ke Pola A (per-unit dg label posisi: 'Ruang Utama 1..8' / 'Dekat Mimbar') HANYA saat
   1 unit butuh riwayat khusus (mis. sering bocor).
 - Butuh perubahan skema: Asset + kolom `quantity Int @default(1)` (+ opsi pecah). BELUM dibangun.
STATUS: konsep matang & disepakati arah; implementasi ditunda sampai pilot membuktikan kebutuhan
(hindari kompleksitas skema spekulatif). Reminder-batch sudah live sebagai fondasi.

### KEPUTUSAN QR STICKER + IDENTITAS UNIT — arah final disepakati owner (26 Agu 2026)
Owner memutuskan: QR sticker unik (4x4/5x5cm) = identitas per-unit RECOMMENDED-OPTIONAL. Masjid 8 unit
= tetap 8 KARTU per-unit (Pola A), notifikasi tetap 1 bila due bareng (sudah live). Sticker = pembeda
fisik yang MEMBUAT per-unit feasible untuk unit kembar. Lumite jual sticker (bisnis sampingan); tenant
besar boleh generate kode sendiri + export Excel + cetak sendiri.
LIMA KEPUTUSAN TEKNIS PENENTU (hasil pertimbangan, jadi acuan implementasi):
 A. Kode UNIK GLOBAL lintas semua tenant (bukan per-tenant) — cegah tabrakan + jadi jangkar
    portabilitas atas-izin nanti (pelanggan pindah tenant, tunjukkan kode, riwayat ikut).
 B. QR isi = kode buram + URL (mis. https://aircon.id/u/{CODE}), BUKAN ID database. Kode tak bermakna
    sampai "di-bind" ke unit (seperti tag bagasi). Kamera HP biasa bisa scan (tak wajib buka app).
 C. PRIVASI scan: publik/orang asing = tampil minimal ("terdaftar di [Tenant], hubungi utk servis");
    terautentikasi (teknisi tenant itu / pelanggan via portal) = riwayat penuh. Cegah bocor harga/pola.
 D. JANGAN kunci fitur di balik beli sticker. Kemampuan KODE gratis/termasuk; barang fisik = upsell.
    Model: tenant kecil beli sticker praktis (margin Lumite), tenant besar generate+export+cetak sendiri
    dari pool unik-global yang sama. Software gratis, sticker fisik monetisasi.
 E. MATERIAL wajib tahan panas/lembab/UV (vinyl/polyester laminasi), tempel di UNIT INDOOR (adem,
    terlindung, mudah dijangkau). Kertas biasa = gagal dalam bulanan.
SINTESIS MODEL (best-of-both): utama per-unit (Pola A) + fitur "BUAT MASSAL" (isi form sekali:
merek/PK/lokasi + jumlah 8 → app bikin 8 record terpisah otomatis → opsional scan 8 sticker berurutan
utk bind). Cepat seperti Pola B saat input, hasil granular seperti Pola A. `quantity` murni jadi
fallback bila pelanggan tolak sticker + banyak unit kembar.
ALUR TEKNISI: kunjungan-1 = buat/buat-massal unit → tempel sticker → scan (3 dtk/unit, nol ketik).
Kunjungan berikut (teknisi mana pun) = scan sticker → rekam medis unit langsung terbuka.
BELUM DIBANGUN. Butuh: tabel UnitCode (kode unik-global + status pool/assigned/bound + batchId),
generator batch + export Excel, scan QR via kamera HP (browser, tanpa app native), buat-massal unit,
halaman publik /u/[code] dgn aturan privasi (C). Urutan bangun MENUNGGU keputusan profil pilot
(rumahan vs institusi) — owner masih menimbang.

### KLARIFIKASI — 1 KODE untuk 3 TUJUAN (privasi scan / poin C, 26 Agu 2026)
Owner menetapkan 3 fungsi 1 QR: (1) pendaftaran unit pertama kali oleh teknisi via app;
(2) pencarian cepat utk update kartu perawatan oleh teknisi via app; (3) info publik TANPA login
utk pelanggan/siapa pun: (a) identitas AC (MESIN, bukan pemilik), (b) spek AC, (c) riwayat perawatan
seluruh periode — HANYA daftar tanggal+aktivitas, TANPA tenant/teknisi/biaya.
JAWABAN: YA, 1 kode 1 URL bisa 3 tujuan. Pembeda = SIAPA pembuka (sesi auth), bukan kode berbeda.
 - PWA + sesi login: URL /u/{code} dirender beda per konteks. Teknisi login (unit milik tenant-nya):
   kode belum-bind → "daftarkan unit" (fn1); sudah-bind → kartu perawatan + update (fn2).
   Tanpa sesi (kamera HP orang asing) → halaman publik stripped (fn3).
KEPUTUSAN TEKNIS TAMBAHAN (revisi poin C — owner benar, riwayat BOLEH publik asal stripped):
 - Public view = MESIN + riwayat kesehatan saja. BUANG: tenant, teknisi, biaya, DAN identitas pelanggan
   (nama/alamat/HP JANGAN publik). "Identitas AC" = merek/tipe/PK/kode unit, bukan pemilik.
 - KODE HARUS ACAK ber-entropi tinggi (mis. 7F3K9M2), BUKAN berurutan → cegah enumeration/crawl massal
   riwayat semua unit (karena fn3 publik). Nomor urut boleh utk cetak/Excel internal; yang di QR/URL acak.
 - Otorisasi mode-teknisi = "login DAN unit milik tenant si teknisi" (bukan sekadar login). Teknisi
   tenant lain scan → jatuh ke public view.
 - Status kode: pool (dicetak, belum dipakai) → bound (kawin ke 1 unit, permanen) → pindah tenant via
   izin nanti tapi kode TETAP (jangkar portabilitas).
 - TIMBANG (belum diputus): riwayat-publik default ON atau toggle per-tenant? Cenderung default ON +
   opsi tenant matikan (prinsip configurable). Owner belum tetapkan.

### OPSI FINAL DISEPAKATI — model scanner (simple, owner 26 Agu 2026)
Owner pilih opsi SIMPEL (lebih baik dari ide "render per-sesi"): 1 kode, 1 URL pendek.
 - Scanner UMUM (app luar) → buka URL → halaman PUBLIK sederhana (identitas mesin + spek + riwayat).
 - Scanner IN-APP Aircon → potong URL, ambil KODE saja → tampilkan detail LENGKAP di dalam app.
KOREKSI KEAMANAN (WAJIB, dari asisten — owner setuju arah): keamanan TIDAK boleh bergantung pada
"scanner mana". URL bisa dibuka siapa saja di browser → SERVER yang menentukan berdasar LOGIN:
 - /u/{code} tanpa sesi login = SELALU public view sederhana (dumb, cacheable, tak mungkin bocor).
 - Detail lengkap HANYA via API terproteksi di dalam app setelah login (teknisi pemilik unit / portal
   pelanggan bila dibangun). Scanner in-app = UX cepat, bukan mekanisme keamanan.
PENYEMPURNAAN:
 - "Pelanggan via app = info lengkap" butuh PORTAL PELANGGAN (belum ada; pelanggan kini via WA+booking).
   Saran: sekarang pelanggan cukup public view; portal pelanggan (riwayat+biaya sendiri) = nanti.
   Biaya yg pelanggan lihat = yg DIA bayar (data sendiri); catatan internal teknisi = ranah tenant.
 - URL PENDEK: domain pendek + kode pendek (mis. 7F3K9M2 ~34 miliar kombinasi). Trik density: QR
   "mode alfanumerik" lebih rapat utk HURUF BESAR+angka → seluruh URL uppercase (HTTPS://ACN.ID/U/7F3K9M2)
   = QR lebih kecil/mudah dibaca di stiker 4cm. Maka kode = UPPERCASE saja.
 - Scanner in-app: validasi URL cocok pola domain kita sebelum ambil kode (QR asing → "kode tidak dikenal").
 - Riwayat DESCENDING (terbaru di atas); tonjolkan baris "Perawatan terakhir: {tgl} — {aktivitas}".

## 5. ARSITEKTUR & KEPUTUSAN KUNCI (jangan diubah tanpa alasan)
- Portofolio 2-VPS: VPS-INFRA (WA+MQTT bersama semua app, sudah disewa) + VPS-APP (nanti saat go-komersial)
- Gerbang skala WA = migrasi ke WhatsApp Cloud API (bukan beli RAM besar). Gateway sudah abstraksi API
  supaya penukaran mesin WA = 1 perubahan untuk semua app.
- systemd-native (bukan Docker) di VPS 4GB — lebih hemat ~200MB. Alternatif Docker ada di repo.
- Migrasi app Vercel->VPS = murah (cuma Dockerfile+nginx, nol ubah kode) -> tunda sampai go-komersial.
- Vercel Hobby: cron MAKS 1x/hari. Semua cron aircon harian.

## 6. LOKASI PENTING
- Kredensial live: /home/rad/aircon/.secrets/vps-infra-credentials.txt (GITIGNORED, jangan commit)
- Dokumen infra: docs/infra/ (README + panduan WA/MQTT + kapasitas + deploy runbook)
- Analisis arsitektur: docs/Hosting_Architecture_Decision.md, Capacity_Planning.md,
  Portfolio_Shared_Gateway_Architecture.md
- Artefak deploy native: infra/vps-infra/native/ (provision, unit systemd, gw.conf nginx, redeploy)
- GTM: docs/GoToMarket_Strategy_ROI.md

## 7. CARA MELANJUTKAN DI SESI BARU
1. `cd /home/rad/aircon && git pull && git log --oneline -5`
2. Baca file ini (docs/PROJECT_STATUS.md) + docs/infra/README.md
3. Cek infra hidup: `ssh -i ~/.ssh/aircon-ssh.pem rad4ssh@103.127.138.16 'systemctl is-active mosquitto aircon-gateway aircon-bridge'`
   + `curl https://gw.lumite.biz.id/health`
4. Verifikasi app: `pnpm run test && pnpm run build`
5. Lanjut dari bagian "BELUM SELESAI" sesuai prioritas.
