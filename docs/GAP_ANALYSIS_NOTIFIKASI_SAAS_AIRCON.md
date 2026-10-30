# Audit Mendalam & Gap Analysis Notifikasi SaaS Aircon

- **Status:** audit 26 Okt 2026; code/status claims below are historical and superseded where contradicted by the dated SSOT in `RENCANA_KERJA_PERBAIKAN_NOTIFIKASI_AIRCON.md`. Reconciled 29 Okt 2026: core P0/F1, F4 partner engine, F3 lease/replay foundations, F5 template center and G23 have since been implemented; phase status/evidence/remaining live in the SSOT. This gap analysis is retained as findings/source map, not a current completion checklist.
- **Tanggal audit:** 26 Oktober 2026
- **Cakupan:** platform Aircon ↔ tenant; platform ↔ agent/reseller; tenant ↔ pelanggan/teknisi; email, WhatsApp, push, in-app, dan pesan pada UI.
- **Prinsip:** bedakan notifikasi yang benar-benar dikirim, notifikasi yang hanya tampil di aplikasi, tindakan yang membuka WhatsApp pengguna, dan usulan fitur. Keberadaan copy atau fungsi belum membuktikan delivery berhasil.

## Ringkasan eksekutif — snapshot audit 26 Okt 2026, direkonsiliasi 29 Okt

Bagian-bagian audit di bawah memuat **kondisi awal 26 Okt**, bukan seluruh kondisi aplikasi hari ini. Implementasi sesudahnya telah menutup banyak temuan. Jangan gunakan temuan historis di bawah sebagai daftar pekerjaan aktif tanpa memeriksa `RENCANA_KERJA_PERBAIKAN_NOTIFIKASI_AIRCON.md`.

Dokumen ini adalah snapshot audit 26 Okt 2026, bukan open-work ledger. Setelah itu, code/deploy evidence menutup banyak temuan: correctness P0 & paket, pembayaran dan WA lifecycle, partner email/in-app engine, booking idempotency/reference, push fallback, leases/UNKNOWN, template center/versioning, kill switches, alert kegagalan job, G23 retirement BillingPolicy copy, manual-send MessageLog trace, F3 no-run/stale alert, template test-send dan katalog 27 key. Status/fase terbaru dan blockers ada di SSOT `docs/RENCANA_KERJA_PERBAIKAN_NOTIFIKASI_AIRCON.md`; jangan memakai status historis di snapshot ini sebagai keadaan saat ini. Catatan pemilik 30 Okt: Jaya Mandiri dan ABC DEPOK adalah demo/seed; tenant asli lainnya, dan PT Ase satu-satunya tenant asli berbayar. Jangan menyimpulkan masalah produksi dari data demo. Sisa bukti produksi/approval-gated (email alert self-test, satu WA uji ke nomor milik pemilik/karyawan, partner E2E recipient) dilacak di SSOT. Fitur tidak dinyatakan rusak hanya karena E2E belum dilakukan.

**Rekomendasi arsitektur** tetap relevan sebagai prinsip, tetapi daftar spesifik/implementation status mengikuti SSOT: satu routing per domain, policy di kode, template divalidasi, status delivery tidak disamakan, dan jangan melakukan send nyata tanpa allowlist + approval.

---

## 1. Fakta paket dan aturan yang menjadi acuan

- `PlanConfig` memuat `autoReminder`, kuota pelanggan/unit, dan nama paket; Admin → Paket dapat mengubah konfigurasi tersebut (`src/app/admin/paket/*`, `src/lib/services/admin-config-service.ts`).
- `TRIAL` ditampilkan sebagai **Basic**, harga Rp0 (`src/lib/billing/plans.ts`).
- Onboarding membuat tenant `plan: TRIAL`, `status: ACTIVE`, `nextDueDate: null` dengan komentar bahwa tidak ada masa habis untuk gratis (`src/lib/services/onboarding-service.ts`, sekitar 134–139).
- Cron reminder mengambil `PlanConfig.autoReminder`; paket dengan flag false tidak masuk pengiriman otomatis. Tenant tetap dapat melihat due reminders (`src/lib/services/reminder-service.ts`, 140–156; `listDueReminders()` tidak melakukan gate paket).
- Halaman Pengingat memiliki tombol **Kirim Pengingat** yang membuka `wa.me` dengan teks template dan tombol untuk menandai terkirim manual. Aplikasi **tidak dapat memverifikasi** bahwa pengguna benar-benar mengirim pesan itu (`src/app/app/pengingat/actions.ts`, 64–75 dan 113–127; `inbox.tsx`). Ini adalah manual dari WhatsApp pemilik, bukan pengiriman otomatis platform.
- **Historical 26 Okt:** `trialDays` ada di `BillingPolicy`/Admin dan `trial_ending` masih di katalog. **Superseded:** G4 retired field/key dan migration 20261028150000 live; G23 retired four copy columns separately. Rujuk SSOT G4/G19/G23 untuk bukti.

## 2. Inventaris mekanisme — baseline 26 Okt (parsial kini; lihat SSOT)

Tabel ini adalah snapshot awal; partner/template/queue capabilities telah berubah pasca audit dan tabel **bukan inventory current-state**.

| Mekanisme | Tujuan | Sumber/trigger | Template saat ini |
|---|---|---|---|
| PlatformNotification | Lumite/Aircon → tenant | onboarding, cycle tagihan, callback WA putus, aksi admin | 5 template hardcode at audit date; now DB-backed platform catalog/versioning |
| Dunning MessageLog | Aircon → owner tenant tertunggak | cron harian berdasar kebijakan tagihan | template edited in Kebijakan at audit date; G23 now PlatformTemplate/Admin → Notifikasi |
| Inactivity MessageLog | Aircon → tenant gratis/tidak aktif | cron harian; master switch default OFF, dry-run default ON | template edited in Kebijakan at audit date; G23 now PlatformTemplate/Admin → Notifikasi |
| Tenant MessageLog | tenant → pelanggan | auto reminder; invoice/kwitansi; pesan operasional | reminder editable per tenant; invoice/kwitansi hardcode |
| TenantNotification | aplikasi → tenant | booking online baru | in-app; title/body hardcode |
| Push | aplikasi → perangkat pengguna/teknisi | tugas ditugaskan | push opsional, copy hardcode |
| WhatsApp manual | tenant → pelanggan | klik tombol di halaman Pengingat | link wa.me, bukan bukti terkirim |
| Pesan agent/reseller | Aircon → mitra | partner lifecycle hooks (post-audit) | email queue + in-app live; E2E pending (F4 SSOT) |

## 3. Alur proses: Aircon platform ↔ tenant

**Snapshot historis 26 Okt.** Perubahan implementasi/deploy sesudahnya membatalkan klaim “saat ini” di bagian ini; cek phase evidence SSOT untuk status terkini.

### 3.1 Tenant mendaftar / onboarding selesai

**Saat ini:** `onboarding-service.ts` memanggil `notifyPlatform({templateKey: "welcome"})` untuk tenant baru tanpa mengecek `PlanConfig.autoReminder`. `notifyPlatform()` membuat antrean per saluran yang memiliki alamat penerima. Default-nya WA dan EMAIL; WA dikirim ke `tenant.phone || owner.phone`, email ke `OWNER.email`. Dispatcher menggunakan sesi gateway `lumite-platform` untuk WA dan SMTP untuk email. Kegagalan onboarding tidak dibatalkan bila antrean welcome gagal.

**Gap:** satu copy welcome dipakai untuk Basic dan paket berbayar. Copy meminta “hubungkan WhatsApp usaha” dan menjanjikan pengingat otomatis; ini menyesatkan Basic, yang memakai pengingat manual melalui WhatsApp pemilik.

**Usulan:** welcome berbasis paket/fitur, satu kali per tenant, dengan varian yang dipilih kode. Jangan meminta tautkan WA dari Basic.

**Copy Basic yang disarankan:**
> Halo {{nama_pemilik}}, selamat datang di Aircon. Paket Basic Anda aktif gratis selamanya. Anda dapat mencatat pelanggan dan unit AC sesuai batas paket. Pengingat servis yang jatuh tempo tersedia di menu Pengingat untuk dikirim manual melalui WhatsApp Anda. Jika usaha membutuhkan pengingat otomatis dan koneksi WhatsApp dari Aircon, Anda dapat melihat paket Professional atau Business di {{tautan_langganan}}.

**Copy Professional/Business yang disarankan:**
> Halo {{nama_pemilik}}, paket {{nama_paket}} Aircon Anda aktif. Untuk mengirim pengingat servis otomatis kepada pelanggan, sambungkan nomor WhatsApp usaha di Pengaturan → Hubungkan WhatsApp. Setelah tersambung, periksa status koneksi sebelum jadwal pengingat berikutnya: {{tautan_pengaturan_wa}}.

### 3.2 Paket Gratis → upgrade / pembayaran berhasil

**Saat ini:** checkout melalui iPaymu membuat payment PENDING; webhook memproses status dan memanggil `activateSubscription()` saat transisi ke PAID. Fungsi ini mengaktifkan paket, mengisi periode, mereset dunning, dan memperbarui Subscription. Tidak ada `notifyPlatform`, email, WA, atau in-app notification setelah aktivasi. `processIpaymuNotification()` mengakru komisi secara terpisah bila tenant teratribusi.

**Gap:** pelanggan yang baru upgrade tidak diberi ucapan aktivasi maupun instruksi menghubungkan WhatsApp; tidak ada reminder yang menerangkan setup otomasi. Halaman paket berbayar memang menampilkan fitur, tetapi itu bukan pesan pascapembayaran.

**Usulan:** event `subscription_activated`/`plan_upgraded` hanya setelah transisi payment→PAID dan aktivasi sukses. Idempotency harus terkait payment/order ID, bukan tiap webhook. Copy:
> Pembayaran berhasil. Paket {{nama_paket}} Aircon aktif hingga {{tanggal_akhir}}. Untuk mulai mengirim pengingat servis otomatis, sambungkan WhatsApp usaha di Pengaturan → Hubungkan WhatsApp: {{tautan_pengaturan_wa}}. Pengingat otomatis baru berjalan setelah koneksi berstatus tersambung.

Sertakan ringkasan pembayaran, durasi, faktur/riwayat transaksi, dan kanal bantuan di email atau halaman sukses. Jangan menyatakan koneksi WhatsApp aktif sebelum ada verifikasi status gateway.

### 3.3 Pembayaran belum selesai / gagal / kedaluwarsa

**Saat ini:** payment memiliki status PENDING/FAILED/EXPIRED dan halaman langganan dapat menampilkan transaksi serta tombol bayar/ulangi. Audit tidak menemukan notifikasi otomatis khusus payment pending/failed/expired yang dikirim ke tenant.

**Usulan:** in-app state pada halaman Langganan segera; satu pesan email (jika alamat tersedia) untuk instruksi melanjutkan pembayaran; batasi reminder agar tidak berulang dan jangan mengirim tautan bayar yang sudah kedaluwarsa. Copy:
> Pembayaran paket {{nama_paket}} belum berhasil diselesaikan. Paket belum berubah dan belum ada tagihan yang dianggap lunas. Anda dapat mencoba kembali melalui halaman Langganan: {{tautan_langganan}}. Jika saldo sudah terpotong, hubungi {{kontak_bantuan}} dengan ID transaksi {{order_id}}.

### 3.4 Tenant berbayar mendekati jatuh tempo

**Saat ini:** `runPlatformNotifyCycle()` melihat tenant dengan `nextDueDate` 0–3 hari, status ACTIVE/PAST_DUE/TRIAL, lalu mengantrikan `subscription_due` bagi status non-TRIAL. Dedup harian per tenant/channel. Template hardcode memuat `{{paket}}`, `{{tanggal}}`, `{{nominal}}`, `{{link}}`, tetapi cycle hanya mengirim tanggal dan link. Renderer mengganti placeholder hilang dengan string kosong.

**Nuansa jadwal:** cron **terverifikasi aktif di live** — `aircon-dunning.timer` (01:00), `aircon-reminders.timer` (02:00), `aircon-reconcile.timer` (03:00) semuanya enabled di VPS, dan `aircon-dunning.service` memanggil `/opt/aircon-app/run-cron.sh dunning` yang POST ke `/api/cron/dunning` dengan `CRON_SECRET`. Journal 26 Okt 2026: `dunning.checked:1`, `remindersSent:1`, tenant flush `sent:1`, `platformNotify.overdue:1`, `platformDispatch.sent:2`, exit 0. Route menjalankan tahapan dalam satu `try`; exception di tahap awal dapat melewati dispatch dan platform cycle hari itu (`src/app/api/cron/dunning/route.ts:24-36`).

**Gap:** isi bisa menjadi kurang informatif karena paket dan nominal hilang. Siklus ini adalah reminder platform WA/email, terpisah dari dunning WA harian. Tidak ada event invoice/tagihan terstruktur yang ditautkan pada notifikasi.

**Usulan:** hitung nominal dari subscription/payment invoice yang authoritative; jangan mengarang jumlah dari plan default jika ada pajak/diskon. Copy:
> Halo {{nama_tenant}}, langganan Aircon {{nama_paket}} sebesar {{nominal_tagihan}} jatuh tempo pada {{tanggal_jatuh_tempo}}. Silakan periksa rincian tagihan dan metode pembayaran di {{tautan_tagihan}}. Jika Anda sudah membayar, abaikan pesan ini.

### 3.5 Tagihan lewat jatuh tempo, penangguhan, penghapusan

**Saat ini (jalur A):** `platform-notify-cycle.ts` mengantre `subscription_overdue` setiap hari untuk tenant eligible dengan `nextDueDate < now`, status TRIAL/ACTIVE/PAST_DUE; dedupe harian, sampai keluar dari kelompok kandidat. Template hardcode hanya menyebut terlambat dan tautan langganan; tidak menyatakan hari telat atau tenggat spesifik.

**Saat ini (jalur B):** `runDunningCycle()` di cron memindahkan status PAST_DUE/SUSPENDED/marked-for-deletion berdasarkan `BillingPolicy`, dan mengantre pesan WA `MessageLog` memakai `dunningReminderTemplate` atau `dunningWarningTemplate`. Template dapat diubah di Admin → Kebijakan. Dunning menggunakan `tenant.phone` serta `MessageLog` tenant dan dispatcher pesan tenant; bukan `PlatformNotification` melalui sesi `lumite-platform`. Penghapusan dilakukan oleh tahap purge terpisah dengan grace period.

**Gap/risiko:** dua jalur berbeda dapat mengirim pesan tagihan yang berdekatan/duplikat; jadwal, audience, link, data status dan kanal tidak dikelola bersama. Copy peringatan penghapusan harus konsisten dengan ambang kebijakan dan waktu purge aktual. Copy harus menyatakan tindakan yang benar, bukan “akun dinonaktifkan” bila yang berlaku berbeda.

**Usulan tahapan/copy:**
- Jatuh tempo: gunakan copy subscription_due di atas.
- Lewat jatuh tempo (sekali pada milestone yang dikonfigurasi, bukan tiap hari tanpa batas):
  > Langganan Aircon {{nama_paket}} untuk {{nama_tenant}} telah lewat jatuh tempo sejak {{tanggal}}. Saat ini status layanan: {{status_layanan}}. Selesaikan pembayaran atau hubungi tim kami sebelum {{tanggal_tindakan}}: {{tautan_tagihan}}.
- Penangguhan:
  > Akses fitur berbayar Aircon untuk {{nama_tenant}} ditangguhkan mulai {{tanggal}} karena tagihan belum dibayar. Data Anda belum dihapus. Selesaikan pembayaran di {{tautan_tagihan}} atau hubungi {{kontak_bantuan}}.
- Peringatan penghapusan hanya jika kebijakan dan proses purge benar-benar menetapkan deadline yang pasti:
  > Data usaha {{nama_tenant}} dijadwalkan untuk dihapus permanen pada {{tanggal_penghapusan}} karena tagihan belum diselesaikan. Sebelum tanggal tersebut, pulihkan akun melalui {{tautan_pemulihan}} atau hubungi {{kontak_bantuan}}. Jangan gunakan copy ini jika status/retensi datanya belum diverifikasi.

### 3.6 Koneksi WhatsApp tenant terputus

**Saat ini:** callback gateway memanggil `notifyPlatform(wa_disconnected)` dengan dedupe harian ketika mendeteksi event putus. Ini pesan ke tenant melalui kanal WA Lumite/email berdasarkan alamat yang tersedia. Templatenya hardcode. Copy menyebut semua reminder servis ke pelanggan berhenti dan meminta scan QR.

**Gap:** untuk Basic, koneksi WA gateway memang tidak tersedia, sehingga event disconnect harus dipastikan hanya berlaku untuk paket yang berhak otomatis. Jika event berulang, dedupe harian tetap dapat mengirim berulang setiap hari. Perlu status koneksi actual/last-seen dan dampak yang tepat; jangan mengklaim reminder berhenti jika tidak ada reminder otomatis yang eligible.

**Copy Pro/Business yang disarankan:**
> Koneksi WhatsApp usaha {{nama_tenant}} terputus pada {{waktu}}. Pengingat otomatis belum dapat dikirim selama koneksi terputus. Sambungkan kembali nomor usaha di Pengaturan → Hubungkan WhatsApp: {{tautan_pengaturan_wa}}. Pengingat yang tertunda dapat diperiksa di menu Pengingat. Jangan kirim ulang sebelum memeriksa status pesan untuk menghindari duplikasi.

### 3.7 WhatsApp berhasil disambungkan kembali

**Gap:** tidak ditemukan pemberitahuan recovery/connection-restored. Tenant bisa melihat status di halaman Hubungkan WhatsApp, tetapi tidak ada event pemulihan yang mengonfirmasi otomasi siap.

**Usulan (in-app, opsional email):**
> WhatsApp usaha Anda tersambung kembali pada {{waktu}}. Pengiriman otomatis dapat dilanjutkan. Periksa menu Pengingat untuk melihat pesan yang masih menunggu; pesan yang sudah terkirim tidak akan dikirim ulang otomatis.

### 3.8 Keamanan, akun, data, gangguan, perubahan produk

Audit tidak menemukan katalog notifikasi platform untuk perubahan email/nomor/PIN, login baru, perubahan owner, gangguan layanan, pemeliharaan, atau insiden data. Ini adalah **gap audit**, bukan klaim bahwa semua faktor autentikasi eksternal tidak punya mekanisme sendiri.

**Usulan:** notifikasi keamanan via email/in-app untuk perubahan kredensial dan aktivitas sensitif; pemberitahuan gangguan/resolusi lewat status page/email hanya jika ada insiden nyata. Jangan mengirim data sensitif, OTP, PIN, token aktivasi, atau nomor rekening penuh melalui pesan.

## 4. Alur proses: Aircon platform ↔ agent/reseller

**Snapshot historis 26 Okt.** Partner email/in-app lifecycle telah dikembangkan sesudah audit; lihat rekonsiliasi §6.4 dan fase F4 SSOT.

**Bukti Absence (26 Okt 2026):** pencarian outbound primitive (`sendEmail`, `gatewaySend`/`gatewaySendAs`, `notifyPlatform`, `notifyAssignees`) pada `src/lib/partner/**`, `src/app/agen/**`, `src/app/reseller/**`, dan `src/app/admin/keagenan/**` menghasilkan **nol hasil**. Seluruh pemanggilan `sendEmail()` di repository hanya satu: `platform-notification-dispatch.ts:46`, yang pengirimannya `PlatformNotification` ke tenant. Tidak ada tabel notifikasi untuk agent/reseller: model `TenantNotification` hanya terikat `tenantId`; model `PlatformNotification` juga `tenantId`. Field `Agent.picEmail`/`picPhone` hanya dipakai untuk penyimpanan, login (`loginAgent` mencari berdasarkan `picEmail`), dan tampilan admin — bukan sebagai alamat pengiriman.

**Pada baseline audit 26 Okt saja**, lifecycle mitra belum memiliki outbound. Ini sudah superseded oleh F4: email melalui PlatformNotification + in-app PartnerNotification/event hooks live. E2E lifecycle penuh tetap pending; lihat SSOT F4.

### 4.1 Agent dibuat / portal diaktifkan

**Saat ini:** Admin membuat agent dan dapat menerbitkan token/URL aktivasi. UI menyalin URL dan meminta admin membagikannya ke PIC. Tidak ditemukan email/WA otomatis yang mengirim undangan. Agent mengaktifkan portal dengan tautan lalu membuat PIN.

**Gap:** proses bergantung pada salin-tempel; tidak ada jejak undangan terkirim/diterima, expiry reminder, atau konfirmasi aktivasi. Email/nomor PIC tersedia di schema, tetapi tidak berarti sistem menggunakannya untuk notifikasi.

**Usulan copy undangan (email):**
> Subjek: Undangan mengaktifkan portal mitra Aircon
>
> Halo {{nama_pic}}, {{nama_perusahaan}} telah didaftarkan sebagai agen Aircon. Aktifkan akses portal melalui tautan aman berikut: {{tautan_aktivasi}}. Tautan berlaku sampai {{masa_berlaku}} dan hanya dapat digunakan satu kali untuk membuat PIN. Jika Anda tidak mengharapkan undangan ini, abaikan pesan ini dan hubungi {{kontak_aircon}}.

Jangan mengirim PIN awal. Token harus sekali pakai, kedaluwarsa, dan tidak dicatat dalam log biasa.

### 4.2 Reseller mendaftar lewat agen

**Saat ini:** Reseller mendaftar pada tautan join agent. Record dibuat status PENDING. Tidak ditemukan pemberitahuan otomatis kepada agent maupun reseller. Dashboard agen menampilkan pendaftar pending.

**Usulan:** in-app notification/dashboard untuk agent + email pengakuan penerimaan kepada reseller. Copy reseller:
> Pendaftaran Anda sebagai reseller Aircon telah diterima dan sedang menunggu peninjauan oleh {{nama_agen}}. Kami akan memberi tahu Anda setelah keputusan dibuat. ID pendaftaran: {{registration_id}}.

Copy agent:
> Pendaftaran reseller baru menunggu tinjauan: {{nama_reseller}} ({{email}}). Tinjau profil dan putuskan di Portal Agen → Reseller: {{tautan_portal}}.

### 4.3 Reseller disetujui atau ditolak

**Saat ini:** Agent dapat menyetujui/menolak dari portal. Approval mengaktifkan reseller, membuat kode partner dan token login; rejection mengubah status. Tidak ada kiriman email/WA otomatis. Reseller yang disetujui perlu menerima token/tautan secara manual; UI hanya menampilkan daftar.

**Usulan copy persetujuan:**
> Pendaftaran Anda sebagai reseller Aircon disetujui. Aktifkan portal melalui tautan aman ini: {{tautan_aktivasi}}. Kode referral Anda: {{kode_referral}}. Aturan komisi per paket tersedia di portal. Tautan aktivasi bersifat pribadi dan sekali pakai.

**Usulan copy penolakan (profesional dan tidak membuka alasan internal):**
> Terima kasih telah mendaftar sebagai reseller Aircon. Setelah peninjauan, kami belum dapat menyetujui pendaftaran Anda saat ini. Untuk pertanyaan atau pengajuan kembali, hubungi {{kontak_agen}}.

### 4.4 Tenant baru teratribusi / referral digunakan

**Saat ini:** onboarding mencoba mencatat `TenantAttribution` permanen bila referral code valid; kegagalan attribution tidak membatalkan onboarding. Tidak ditemukan pesan kepada agent/reseller tentang tenant baru atau status atribusi. Dashboard/ledger menjadi sumber informasi manual.

**Usulan copy:**
> Tenant baru berhasil terhubung dengan kode referral Anda: {{nama_tenant}} ({{tanggal}}). Atribusi tercatat sesuai ketentuan program. Komisi baru dicatat setelah pembayaran tenant berhasil diselesaikan.

Harus berhati-hati terhadap privasi tenant: kirim hanya nama usaha/status atribusi yang diperlukan; jangan mengirim data owner atau pelanggan.

### 4.5 Komisi diakru / payment direfund / komisi dibalik

**Saat ini:** webhook pembayaran memanggil `accrueCommission()` untuk tenant beratribusi; refund/failed transition setelah PAID dapat membuat reversal. Ini dicatat di `CommissionLedger`. Portal agen/reseller memiliki dashboard/breakdown untuk melihat angka; tidak ditemukan email/WA/in-app event otomatis saat accrual maupun reversal.

**Usulan copy accrual (bukan janji pencairan):**
> Komisi sementara tercatat untuk transaksi tenant {{nama_tenant}}. Paket: {{nama_paket}}; periode: {{periode}}; estimasi komisi Anda: {{nominal}}. Komisi masih mengikuti status pembayaran/refund dan ketentuan program. Lihat buku komisi di portal: {{tautan_portal}}.

**Usulan copy reversal:**
> Penyesuaian komisi dilakukan untuk transaksi {{referensi_transaksi}} karena status pembayaran berubah menjadi {{status}}. Nilai penyesuaian: {{nominal}}. Rincian dan dasar transaksi tersedia di portal: {{tautan_portal}}. Hubungi {{kontak_bantuan}} bila ada perbedaan.

Kirim hanya setelah ledger transaction berhasil commit; gunakan idempotency key ledger entry supaya webhook berulang tidak menggandakan pesan.

### 4.6 Penyusunan payout, persetujuan, dan pembayaran ke agent

**Saat ini:** pencairan bulanan hanya untuk Agent (bukan reseller). Admin membangun payout DRAFT, lalu menandai PAID setelah transfer dengan referensi transfer. Tidak ditemukan notifikasi otomatis saat payout dibuat, disetujui, atau PAID. Reseller tidak memiliki payout otomatis pada tahap aktif ini.

**Usulan copy payout siap ditinjau:**
> Rekap komisi periode {{bulan}} tersedia untuk ditinjau. Total bruto {{bruto}}, potongan/reversal {{potongan}}, pajak {{pajak}}, estimasi bersih {{net}}. Status saat ini {{status}}. Periksa rincian di portal sebelum menghubungi tim pembayaran.

**Usulan copy pembayaran selesai:**
> Pembayaran komisi Aircon untuk periode {{bulan}} telah ditransfer pada {{tanggal}}. Nilai bersih: {{net}}. Referensi transfer: {{referensi}}. Jika dana belum terlihat setelah waktu kliring bank, hubungi {{kontak_keuangan}}.

Jangan menyatakan sudah dibayar sebelum status payout dan referensi transfer tersimpan.

## 5. Alur tenant ↔ pelanggan/teknisi (agar tidak tertukar dengan notifikasi platform)

Snapshot audit sumber; pengecualian berstatus current yang terkonfirmasi ditandai di SSOT §F5/G23 residuals. Jangan menyimpulkan direct WA paths telah memakai MessageLog.

| Proses | Perilaku aktual | Gap / batas |
|---|---|---|
| Reminder jatuh tempo | Auto runner membuat satu WA per pelanggan untuk beberapa unit due; memakai template `reminder`/`reminder_multi` per tenant. Runner mem-filter paket dengan `autoReminder`; Basic tidak otomatis. | Manual dari Pengingat membuka `wa.me`; status terkirim manual hanya konfirmasi tenant. Tidak ada bukti WhatsApp delivery/read dari tindakan manual itu. |
| Invoice/kwitansi | `invoice-service.ts` membentuk pesan dari data dokumen lalu memanggil gateway tenant. | Teks builder bukan editor pesan pusat; hanya boleh dinilai sebagai tenant→pelanggan, bukan platform→tenant. Audit ini tidak menyarankan mengubah isi transaksional secara global tanpa kebutuhan admin yang jelas. |
| Booking online | Form publik membuat Lead dan TenantNotification in-app “Booking online baru” untuk tenant; halaman mengembalikan “kami akan hubungi Anda” ke pemohon. | Tidak ditemukan email/WA konfirmasi otomatis kepada pemesan; tenant notification tidak sama dengan outbound customer notification. |
| Undangan teknisi | Owner mengirim undangan melalui gateway WhatsApp tenant dari `masuk-teknisi/actions.ts`. | Pesan dipicu tindakan admin, bukan broadcast otomatis; copy hardcode. Perlu status link/expiry dan kegagalan yang terlihat. |
| Tugas teknisi | Assignment mengirim Web Push opsional: “Tugas baru”, “Anda ditugaskan ke {{job}}”. | Tidak ada fallback SMS/WA yang ditemukan; push bergantung subscription perangkat. Perlu UI status jika push gagal/ditolak. |
| Inbound pelanggan | Callback menerima event inbound; jangan menganggap setiap pesan inbound menjadi percakapan yang ditangani manusia. | Periksa kebutuhan auto-reply/queue CS secara terpisah; tidak termasuk platform notification tanpa bukti jalur outbound. |

## 6. Audit template & konfigurasi saat ini

### 6.1 Historical baseline — superseded by implementation after 26 Oct

**Jangan baca uraian di bawah sebagai kondisi saat ini.** Per 26 Okt audit, `src/lib/domain/platform-templates.ts` mempunyai lima keys: `welcome`, `trial_ending`, `subscription_due`, `subscription_overdue`, `wa_disconnected`. Subject/body/label statis. Header file menyebut “Editable admin menyusul”; tidak ada tabel PlatformTemplate. `PlatformNotification` menyimpan snapshot `templateKey`, `subject`, `body`, recipient, channel, status dan dedupe key pada saat queued.

Admin → Notifikasi menyediakan manual send, cycle/dispatch, daftar dan summary status, serta kontrol sesi WA Lumite. Dropdown mengambil label dari konstanta; tidak menyediakan editor subject/body. Manual send dapat memilih template/channel tanpa aturan eligibilitas paket.

Verifikasi UI (26 Okt 2026): `src/app/admin/notifikasi/notif-panel.tsx` merender tiga `select` (Tenant, Template, Saluran) dan tiga tombol aksi; **nol** `Input`/`Textarea` untuk isi pesan. Copy bawaan halaman di baris 104 masih menyebut "tenant jatuh tempo/trial habis" — Istilah "trial habis" tidak sesuai model Basic gratis selamanya dan harus diganti menjadi "jatuh tempo langganan" ketika copy platform dirapikan.

### 6.2 Historical baseline — retired in G23

**Koreksi 29 Okt 2026:** empat kolom copy `BillingPolicy` sudah dihapus oleh migrasi `20261029060000`; copy tenant sekarang dikelola sebagai key katalog `PlatformTemplate` di Admin → Notifikasi. Uraian berikut hanya merekam kondisi sebelum G23. `BillingPolicy` memiliki `dunningReminderTemplate`, `dunningWarningTemplate`, `inactivityReminder1Template`, `inactivityReminder2Template`; diedit di Admin → Kebijakan. Ambang dunning/inactivity juga dikonfigurasi. Ini hanya mencakup dua flow di atas, bukan semua pesan platform.

`MessageTemplate` per tenant mendukung pesan reminder pelanggan. Ini bukan konfigurasi pesan platform; tenant adalah pemilik copy.

### 6.3 Validasi template yang disarankan

- Registry event + daftar placeholder valid per template; tampilkan preview dengan contoh realistis.
- Simpan versi dan audit siapa mengubah kapan; perubahan template hanya memengaruhi pesan baru, tidak mengubah snapshot antrean lama.
- Validasi wajib: tidak boleh ada placeholder tak dikenal/kosong untuk field penting (nominal, tanggal, URL, status).
- Pilih channel per event dan fallback yang eksplisit; jangan mengirim nomor tenant melalui jalur yang tidak tersedia untuk paketnya.
- Uji kirim ke admin/test recipient sebelum publish; preview WA/email berbeda dan batasi link.
- Pesan penghapusan dan keamanan perlu review/approval tambahan.

## 6.4 Reconciliation hasil audit dengan SSOT — 29 Okt 2026

Gap di §7 dan reliability list §7.1 adalah snapshot 26 Okt, **bukan status sekarang**. Gunakan tabel ini bersama phase/traceability SSOT:

| Finding (ID SSOT) | Kondisi terkini yang terbukti | Status / bukti |
|---|---|---|
| Welcome/payment/template/P0, G1–G4/G7/G19 | Implementasi correctness + template validator; `trialDays`/kolom fosil ditangani migrasi | DONE & LIVE menurut SSOT; lihat F1/G1–G4/G7/G19, release dan tests di progress log. |
| G5/G22 schedule/billing | Code dan unit tests live; run 29 Okt 01:00 berstatus sukses tetapi `checked=0`, jadi tak mengeksekusi perilaku milestone | IMPLEMENTED, runtime behavior NOT EXERCISED; masih terbuka untuk bukti applicable. |
| G8, F4 partner lifecycle | Shared platform email queue + in-app partner inbox, hooks, expiry/replay safety | IMPLEMENTED & LIVE; E2E lifecycle real/test recipient belum lulus/diizinkan. |
| G9/G10/G20/G29 | Lease + UNKNOWN, targeted dispatch, replay controls, evidence-tier dashboard/reconcile | Implemented/live per SSOT; masih perlu cek keseluruhan permukaan UI tier dan operasional replay/alert queue. |
| G11/G13 booking | Request idempotency + reference/confirmation behavior | Live per SSOT; historical statement “no customer confirmation” sudah superseded. |
| G12/G18/F5 | DB template editor + version history/rollback | Live; preview/test-send allowlist belum ditemukan dalam code audit 29 Okt (`admin/notifikasi/page.tsx`, `platform-template-service.ts`). |
| G14 push fallback | Push fallback implemented/live per SSOT 1c6a9eb | Historical P2 gap superseded; verify tests/live evidence in SSOT. |
| G21/G30 job failure alerts | Audit log + admin email alerts live (`43d6e17`); WA plan partial failures also alert (`5a2e30d`) | Live; no full injected failure/email delivery performed (avoid real recipient without approval). Stale/old-queued/no-run alerts remain open. |
| G23 BillingPolicy copy | Four copy columns removed after R1, backup + migration + verify | DONE & VALID per SSOT, release `d64c6d4` + migration `20261029060000`. |
| Direct WA invoices/receipts/technician invite | Direct `gatewaySend` paths still bypass MessageLog/status/lease | Confirmed residual by source search 29 Okt; explicitly open in SSOT; no unapproved migration. |

## 7. Gap analysis berprioritas — historical findings (26 Okt), not open-work ledger

Findings below are audit-time gaps. Many were closed by subsequent implementation; use §6.4 reconciliation + SSOT traceability to determine current state. Rows with residuals must be assessed against current source/release evidence.

| Prioritas | Gap | Dampak | Rekomendasi |
|---|---|---|---|
| P0 (G1) | Welcome tidak gate paket dan copy salah untuk Basic (historical) | Salah ekspektasi, instruksi fitur yang tidak dimiliki | **CLOSED & LIVE** per SSOT G1: varian welcome berbasis `autoReminder`; Basic dilarang menerima klaim tautkan/otomatis. |
| P0 (G2) | Tidak ada notifikasi upgrade/aktivasi sukses (historical) | Pengguna Pro tidak tahu langkah setup WA | **CLOSED & LIVE** per SSOT G2: event pasca-PAID idempoten; status detail di SSOT. |
| P0 (G3) | Placeholder paket/nominal subscription_due tidak diisi (historical) | Pesan tagihan tidak lengkap | **CLOSED & LIVE** per SSOT G3: nominal/paket diisi dan validasi wajib. |
| P0 | trial_ending/trialDays (historical gap) | Potensi ancaman palsu masa habis | **CLOSED** per SSOT G4/G19: `trial_ending`, policy field `BillingPolicy.trialDays`, dan kolom DB retired; jangan memperlakukan sebagai gap aktif. |
| P1 (G5) | Dunning dan platform overdue overlap, kanal/routing berbeda | Duplikasi, status dan link bisa bertentangan | Implementasi email-only platform owner vs tenant WA dunning LIVE; G5 operational no-duplicate belum exercised pada run 29 Okt (eligible rows=0), jadi behavior runtime pending verification. |
| P1 (G6) | Tidak ada recovery WA connected; disconnect template tak paham paket (historical) | Tenant tidak tahu otomasi pulih; false warning Basic | **CLOSED & LIVE** per SSOT G6: callback transition + epoch, `autoReminder` gate. |
| P1 (G7) | Tidak ada event gagal/tertunda pembayaran (historical) | Tenant bingung status upgrade | **CLOSED & LIVE** per SSOT G7: pending→terminal payment outcome events idempotent. |
| P1 (G8/F4) | Tidak ada notifikasi agent/reseller (historical) | Operasi mitra bergantung portal/manual share | Partner event/email/in-app implemented live; E2E lifecycle remains pending. |
| P1 (G9) | Tidak ada sent/read outcome konsisten di UI untuk platform log (historical) | Admin sulit membedakan accepted/ delivered/read | Dashboard evidence tiers LIVE (`5565638`); inspect residual scope in SSOT F3 if any. |
| P1 (G10) | Baris PlatformNotification berstatus SENDING tanpa lease (historical) | Pesan dapat tertahan atau terkirim ganda saat retry naif | **G10 core CLOSED & LIVE:** lease/stale→UNKNOWN; no auto resend. Stale/queued/no-run escalation masih residual F3. |
| P1 (G11) | Booking Lead bisa tersimpan tetapi action mengembalikan error (historical) | Pemesan dapat submit ulang dan menyisakan lead duplikat | **Core G11 CLOSED & LIVE:** request idempotency/failure safety; lihat SSOT. Residual customer confirmation G13 independently addressed. |
| P1 (G12/G18) | Tidak ada template center lintas flow (historical) | Copy tersebar | DB editor/version/rollback LIVE; preview/test-send allowlist remains OPEN per SSOT F5/G18. |
| P2 (G13) | Booking hanya notifikasi in-app tenant; customer tanpa receipt (historical) | Pemesan tak punya bukti permintaan | **CLOSED & LIVE** per SSOT G13: reference/confirmation implemented. Audit legacy `booking_confirm_customer` key has zero consumer and was removed under G23. |
| P2 (G14) | Push tugas hardcode dan tak ada fallback eksplisit (historical) | Teknisi bisa melewatkan assignment | **G14 fallback CLOSED & LIVE** per release `1c6a9eb`; see SSOT. |
| P2 (G15) | Klaim landing mencampur fitur paket (historical) | Akuisisi menyampaikan janji tak sesuai gate | **CLOSED & LIVE** per SSOT G15/release `b560629`; preserve owner-approved copy. |
| P2 (G16) | Security/maintenance events not catalogued (historical) | Pengguna tidak mendapat informasi penting | Security events G16 live; broad maintenance/outage/status-page catalog remains unverified/out of current closure evidence. |

## 7.1 Temuan reliability & bukti yang belum tegas — snapshot audit-time, 26 Okt

Bagian ini merekam temuan awal yang diverifikasi saat itu, bukan klaim current-state. Sejak audit, G10 lease, G11 booking idempotency, G20 targeted dispatch, G21 alerts, dan G29 reconcile telah berubah; tabel §6.4 mengklasifikasikan ulang. Temuan direct gateway paths tetap perlu audit terpisah.

**Batas verifikasi delivery:** audit independen terhadap subsystem PlatformNotification mengonfirmasi source/test (3 file, 21 tes lulus), tetapi tidak memverifikasi delivery gateway/SMTP live atau bahwa seluruh source snapshot sama dengan release produksi. Secara terpisah, pemeriksaan VPS pada 26 Okt membuktikan timer cron aktif dan journal satu run menunjukkan `platformDispatch.sent:2`, `failed:0`; ini bukti dispatcher melaporkan dua operasi terkirim pada run tersebut, bukan bukti perangkat penerima membaca pesan atau bukti setiap event selalu berhasil. Status `SENT` tidak boleh disamakan dengan `DELIVERED`/`READ_CONFIRMED`.

1. **Baris SENDING dapat macet permanen (platform).** Dispatcher hanya mengambil `QUEUED`, lalu mengklaim `QUEUED → SENDING`. Tidak ditemukan lease, timeout, atau sweeper reclaim untuk baris SENDING basi; pencarian `SENDING` di luar dispatcher/admin tidak menemukan mekanisme pemulihan. Bila proses mati sesudah claim, baris itu tertinggal dan tidak pernah dicoba lagi (`src/lib/services/platform-notification-dispatch.ts:22-39`).
   Peringatan: percobaan ulang otomatis tanpa rekonsiliasi dapat menggandakan pesan bila hasil provider sebenarnya ambigu (timeout setelah provider menerima). Requeue harus berbasis bukti hasil, bukan sekadar aging baris.
2. **Pola serupa ada di jalur tenant (money loop).** `message-dispatch-service.ts` juga mengklaim MessageLog sebagai SENDING dan mengambil hanya QUEUED; tidak ditemukan reclaim stale pada source yang diperiksa. Karena kekhawatiran operasional utama adalah reminder pelanggan, ukur antrean SENDING tenant secara eksplisit sebelum menyatakan retry tuntas.
3. **Booking: Lead bisa tersimpan sementara action gagal.** Penulisan `TenantNotification` berada dalam try yang sama dengan pembuatan Lead; bila write notifikasi gagal setelah Lead berhasil, action mengembalikan error ke pemesan padahal data sudah ada (`src/app/p/[slug]/actions.ts:69-91`). Pemesan yang mencoba ulang dapat menyisakan lead ganda.
4. **Kegagalan antrean welcome dan WA-disconnect sengaja ditelan.** Ini menjaga alur utama, tetapi membuat notifikasi hilang tanpa jejak yang terlihat di pemanggil (`onboarding-service.ts:181-190`; `api/wa/callback/route.ts:107-112`).
5. **Kirim manual berpotensi duplikasi.** Aksi manual tidak menyertakan `dedupeKey`, dan dispatcher memproses antrean QUEUED global, bukan hanya baris yang baru dibuat (`actions.ts:18-30`; `platform-notification-service.ts:24,55-59`).
6. **`SENT` bukan bukti pengiriman.** Status SENT berarti gateway/SMTP menerima operasi; hanya callback WA yang dapat menaikkan ke DELIVERED/READ_CONFIRMED. Jalur email tidak memiliki ACK sama sekali (`platform-notification-dispatch.ts:48-53`; `api/wa/callback/route.ts:80-99`).
7. **Jadwal cron telah diverifikasi aktif di live (koreksi hasil audit awal).** VPS menjalankan `aircon-dunning.timer` pukul 01:00, `aircon-reminders.timer` pukul 02:00, dan `aircon-reconcile.timer` pukul 03:00; ketiganya enabled. `aircon-dunning.service` memanggil `/opt/aircon-app/run-cron.sh dunning`, yang mengirim POST ke `/api/cron/dunning` dengan `CRON_SECRET`. Journal live untuk 26 Okt 2026 menunjukkan dunning `checked:1`, `remindersSent:1`, tenant flush `sent:1`, dan platform dispatch `sent:2`, exit status 0. Jadi **cron bukan gap**; jangan menyatakan tidak aktif. Catatan ini merupakan bukti run terbaru, bukan jaminan semua hari selalu sukses. Route tetap membungkus tahapan dalam satu `try`, sehingga exception di tahap awal dapat melewati siklus notifikasi platform hari itu (`api/cron/dunning/route.ts:24-36`).
8. **G22 historical, superseded:** masalah timestamp/UTC di atas diperbaiki via kalender zona tenant (`dayDifferenceInZone`/`dayKeyInZone`) dan release `80ee6c4`; unit tests mencakup boundary. Run 29 Okt tidak punya tenant eligible (`checked=0`), jadi live runtime milestone behavior belum terekspos. Lihat SSOT G22.

## 8. Urutan business process dan katalog event yang direkomendasikan

Urutan ini adalah **rekomendasi produk**, bukan klaim semua event sudah ada.

### A. Platform Aircon ↔ Tenant

1. **Pendaftaran selesai** → welcome varian Basic vs paid (WA/email/in-app sesuai alamat dan kebijakan consent).
2. **Setup Basic** → onboarding checklist in-app: tambah pelanggan/unit; jelaskan pengingat manual; jangan tampilkan tautkan WA.
3. **Pilih upgrade/checkout dibuat** → status payment pending dan instruksi lanjut (in-app; email jika diperlukan).
4. **Pembayaran gagal/kedaluwarsa** → jelaskan paket belum aktif, aksi retry dan dukungan.
5. **Pembayaran berhasil / upgrade aktif** → konfirmasi periode/nominal + langkah sambungkan WA untuk paket autoReminder=true.
6. **WhatsApp mulai tersambung** → QR/scan serta status tersambung; jangan menyatakan aktif sebelum gateway confirm.
7. **WhatsApp putus / pulih** → pemberitahuan transisi untuk paket otomatis; dampak dan tindakan jelas.
8. **Pengingat pelanggan otomatis dijalankan** → ringkasan agregat opsional (jumlah terkirim/gagal); jangan mengirim satu notifikasi platform per customer ke owner secara berlebihan.
9. **Subscription mendekati jatuh tempo** → invoice/nominal/tanggal; satu pemilik event agar tidak duplikat dengan dunning.
10. **Tunggakan dan grace period** → milestone yang terkonfigurasi, tanggal/tindakan akurat, tombol bayar.
11. **Penangguhan / pemulihan setelah bayar** → status dan batas fitur/data yang nyata; konfirmasi restore setelah aktivasi.
12. **Perubahan email/nomor/PIN, login atau akses sensitif** → security notice; jangan kirim secret.
13. **Akun tak aktif** → reminder hanya jika master switch aktif, tenant tidak dikecualikan, serta masa/tanggal retensi aktual konsisten.
14. **Gangguan/pemeliharaan/resolusi** → kanal status/in-app/email seperlunya; jangan gunakan WA untuk semua event rutin.

### B. Platform Aircon ↔ Agent/Reseller

1. **Agent diundang** → secure activation link + masa berlaku; manual share saat ini.
2. **Agent mengaktifkan portal** → konfirmasi aktivasi dan panduan kode referral.
3. **Reseller mendaftar** → receipt ke reseller + pemberitahuan pending ke agent.
4. **Agent menyetujui/menolak** → keputusan dan langkah berikutnya ke reseller; saat ini tidak dikirim.
5. **Reseller mengaktifkan portal** → konfirmasi dan referral code pribadi.
6. **Tenant mendaftar dengan referral** → konfirmasi atribusi ke mitra tanpa data pribadi berlebihan.
7. **Payment tenant sukses dan komisi accrued** → nominal perkiraan/status ledger, bukan janji payout.
8. **Refund/reversal/chargeback** → notifikasi penyesuaian dan dasar transaksi.
9. **Payout disusun/disetujui** → rekap dan kesempatan koreksi sebelum transfer.
10. **Payout ditransfer** → nilai bersih, pajak dan reference transfer; saat ini hanya admin menandai Paid.
11. **Perubahan komisi/kebijakan/akun** → pemberitahuan version/effective date, acknowledgment bila material.
12. **Keamanan portal/reset akses** → in-app/email, token sekali pakai.

## 9. Arsitektur rekomendasi (tanpa membongkar jalur pengiriman yang sudah terbukti)

Bangun **control plane notifikasi**, bukan gateway baru:

1. Event business seperti `tenant.created`, `subscription.activated`, `whatsapp.disconnected`, `invoice.due`, `partner.reseller.approved`, `commission.accrued`, `payout.paid` dicatat dengan source ID dan status transisi.
2. Registry policy menetapkan penerima, plan eligibility, channel, dedupe/idempotency, retry policy, severity, serta apakah in-app wajib. Aturan ini kode/schema, bukan teks yang dapat diubah bebas.
3. Template tersimpan dengan key + locale + subject/body + daftar placeholder + version. Admin dapat mengedit copy, preview, test, publish/rollback; perubahan dibatasi RBAC dan dicatat audit log.
4. Render harus gagal-terang jika placeholder wajib kosong. Jangan simpan/mengirim pesan dengan template unresolved.
5. Masukkan event ke outbox secara idempoten bersama perubahan bisnis yang terkait (contoh subscription/payment); dispatcher yang ada tetap dipakai.
6. Pisahkan `QUEUED`, `SENT/accepted by provider`, `DELIVERED`, `READ`, `FAILED`, `SUPPRESSED` dan sumber bukti. Status gateway `SENT` bukan bukti telah dibaca.
7. Retry terukur, dead-letter/failed visibility, alert admin, dan manual replay aman; no retry yang dapat menggandakan pesan akibat ambiguous provider result.
8. Consent/preference dan channel fallback: email untuk invoice/security; WA hanya jika penerima dan kanal tepat. Batasi frekuensi dan sediakan opt-out untuk pesan non-transaksional.
9. Simpan audit record event, template version, destination snapshot, outcome, delivery IDs, dan actor tanpa menyimpan secret.
10. Untuk paket Basic, kebijakan autoReminder false harus memblokir seluruh jalur gateway otomatis per pelanggan. UI manual tetap membuka WhatsApp pemilik melalui `wa.me`; jangan mencatatnya sebagai delivery gateway.

## 10. Rencana implementasi yang disarankan

**Tahap 0 — correctness/safety:** koreksi marketing yang menyebut semua paket otomatis; matikan `trial_ending` untuk Basic; perbaiki welcome Basic; isi placeholder invoice due; pastikan disconnect hanya untuk Pro/Business; audit data tenant dengan `status TRIAL` dan due date sebelum mematikan key lama.

**Tahap 1 — event pasca-upgrade dan state WA:** konfirmasi aktivasi pembayaran idempoten; tampilkan CTA sambungkan WA untuk `autoReminder=true`; event connected/disconnected; test email/WA/in-app dan delivery status.

**Tahap 2 — template center platform:** migrasi template lama ke storage versioned; editor + preview + placeholder validation; mempertahankan snapshot isi di PlatformNotification; admin send manual tetap melalui dispatcher existing.

**Tahap 3 — agent/reseller lifecycle:** in-app dashboard + email untuk invite/approval/attribution/commission/payout; mulai dari email dan portal notice, lalu WA hanya dengan consent. Uji privacy, idempotency, dan ledger/outbox.

**Tahap 4 — operasi/observability:** gabungkan timeline komunikasi per penerima, metrik suppression/delivery/failure, alert retry macet, serta prosedur replay dan pemulihan.

## 11. Kriteria acceptance sebelum menyatakan tuntas

- Basic/Gratis tidak menerima ajakan menghubungkan WA atau pesan masa Trial; landing menyebut reminder manual secara konsisten.
- Pro/Business baru mendapat CTA sambungkan setelah aktivasi benar-benar sukses; reminder otomatis hanya setelah koneksi gateway ready.
- `subscription_due` tidak memiliki placeholder kosong dan nilai nominal sama dengan invoice authoritative.
- Dunning tidak menggandakan pesan `subscription_overdue`; suspend/delete warning cocok dengan kebijakan aktual dan tanggal aktual.
- Disconnect/reconnect diuji berdasarkan callback state transition dan plan eligibility; duplicate/out-of-order callbacks tidak menggandakan atau menurunkan status.
- Agent/reseller menerima event yang benar untuk pending/approved/rejected/attribution/commission/reversal/payout; payment webhook berulang menghasilkan satu notifikasi per ledger transition.
- Template editor rejects unknown/missing variables; perubahan versi tidak mengubah antrean lama.
- Tes end-to-end membuktikan queued → provider response → delivery ack (bila disediakan provider) dan UI menunjukkan level bukti yang tepat.
- Catatan deployment menyertakan commit, test suite, release SHA, dan smoke test live; audit dokumen ini sendiri bukan bukti deployment.

## Lampiran A — titik kode utama yang diperiksa

- `src/lib/domain/platform-templates.ts`
- `src/lib/services/platform-notification-service.ts`
- `src/lib/services/platform-notification-dispatch.ts`
- `src/lib/services/platform-notification-admin.ts`
- `src/lib/services/platform-notify-cycle.ts`
- `src/lib/services/onboarding-service.ts`
- `src/lib/services/subscription-service.ts`
- `src/lib/services/dunning-service.ts`
- `src/lib/services/inactivity-sweeper-service.ts`
- `src/lib/services/reminder-service.ts`
- `src/app/api/wa/callback/route.ts`
- `src/app/api/cron/dunning/route.ts`, `src/app/api/cron/reminders/route.ts`
- `src/lib/partner/partner-admin-service.ts`, `partner-portal-service.ts`, `partner-service.ts`
- `src/app/admin/keagenan/actions.ts`, `src/app/agen/actions.ts`
- `src/lib/services/tenant-notification-service.ts`
- `src/lib/services/push-notification-service.ts`
- `src/lib/services/invoice-service.ts`, `src/app/masuk-teknisi/actions.ts`
- `src/app/app/pengingat/actions.ts`, `src/app/app/pengingat/inbox.tsx`
- `src/lib/billing/plans.ts`, `src/lib/billing/plan-display.ts`, `src/app/page.tsx`
- `prisma/schema.prisma` (`PlatformNotification`, `BillingPolicy`, `PlanConfig`, `Agent`, `Reseller`, `CommissionLedger`, `AgentPayout`)
