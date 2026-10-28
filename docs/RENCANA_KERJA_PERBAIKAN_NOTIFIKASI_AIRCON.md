# Rencana Kerja Tuntas — Perbaikan Notifikasi Aircon

- **Status:** F1 deployed; HTTP smoke PASS; F2–F6 open; live CMS correction pending
- **Acuan audit:** `docs/GAP_ANALYSIS_NOTIFIKASI_SAAS_AIRCON.md`
- **Base commit (sebelum pekerjaan):** `688690197eafb8bb7cd98a714f2c576535d14c49`
- **Commit F1 (live):** `6f3897f` → release `6f3897f2cb4b50bb4c9906f3bb1aa49a5dd53b68`
- **Repo state saat F0:** bersih; hanya 2 dokumen belum di-commit (`GAP_ANALYSIS_…`, `RENCANA_KERJA_…`).
- **Tujuan:** perbaiki semua temuan notifikasi secara menyeluruh, utamakan jalur yang sudah ada, cegah duplikasi dan regresi lintas fitur.

## Disiplin progress wajib — lintas sesi dan context compaction

Bagian ini adalah instruksi operasional untuk setiap sesi/agent yang melanjutkan rencana ini. Baca sebelum mengerjakan; jangan mengandalkan ingatan percakapan.

1. **Update dokumen ini pada sesi yang sama saat item berubah status**, termasuk setelah kode, test, migration, review, atau deployment. Jangan menunggu akhir fase atau laporan akhir.
2. **Ubah status menjadi DONE & VALID hanya setelah seluruh acceptance criteria item lulus dan diverifikasi.** Implemented, code written, unit test only, merged, atau deployed tanpa verifikasi bukan DONE & VALID.
3. Untuk setiap item, catat: `status`, `progress`, `evidence` (file/test/command/result; untuk live sertakan release SHA/timestamp/log/record yang relevan), `remaining`, dan `updatedAt` (tanggal lokal WIB). Bukti harus konkret dan dapat diulang; jangan tulis klaim umum.
4. Jika hasil validasi gagal, parsial, tidak dapat dibuktikan, atau bertentangan, status `BLOCKED`/`IN PROGRESS`/`NEEDS REVIEW`; catat kegagalan dan langkah berikutnya. Jangan menghapus bukti kegagalan sebelumnya.
5. **Catat sebelum context compaction, pergantian sesi, atau menyerahkan pekerjaan.** Bila compaction terjadi tanpa update, sesi berikutnya wajib membaca repo dan melanjutkan update tracker terlebih dahulu sebelum coding.
6. Setelah setiap update, verifikasi perubahan tersimpan dan tampilkan ringkasan item/status/evidence yang berubah. Jangan menyatakan done jika dokumen tracker belum terbarui.
7. Progress ini berlaku lintas sesi: file ini adalah sumber kebenaran kerja (SSOT), bukan transcript/chat. Simpan kode, dokumen ini, dan audit analisis di repo; perubahan sesi lain wajib mempertahankan sejarah serta memperbaiki status dengan bukti baru.

## Tracker status terkini

Status per 27 Oktober 2026 (WIB). F1 local implementation gates lulus; belum commit/deploy. F2–F6 belum dikerjakan; tracker memisahkan implementation status dari production status.

| Item | Status | Progress / evidence | Remaining | UpdatedAt |
|---|---|---|---|---|
| F0 baseline dan safety rails | DONE & VALID (baseline read-only) | Base `688690197eafb8bb7cd98a714f2c576535d14c49`; 27 Okt live: systemd timers enabled; latest dunning/reminder runs exit 0; queue snapshot tercatat (PlatformNotification SENT 42, FAILED 17, QUEUED/SENDING 0; MessageLog WA FAILED 10, QUEUED/SENDING 0); PlanConfig Basic autoReminder=false. | Rencana menyebut backup & safe-mode; keduanya TIDAK dilakukan (F0 read-only, tak ada schema change). Revisi definisi dilakukan: backup wajib sebelum migration (F5), bukan sebelum coding. | 2026-10-27 |
| F1 correctness produk P0 | DONE & VALID (lokal) — AWAIT DEPLOY | G1 G2 G3 G7 G19: implemented + tested. G4: runtime/UI retired; DB column `trialDays` retained for F5 migration. G15: code copy aligned; live CMS row pending. G2 hardened: CAS `updateMany.count` gate; CTA from purchased plan `autoReminder`; period date only from Tenant/Subscription `currentPeriodEnd`, never `new Date()` — if both null the confirmation is skipped and an error is logged. Final validation 27 Okt 11:40: `tsc` PASS; `vitest` **118 files / 1047 tests PASS**; `eslint --quiet` PASS; `git diff --check` PASS; `pnpm run build` PASS. No production write, commit, push, or deploy yet. | Commit + push + deploy + smoke/live verification; correct live `LandingContent.heroSubtitle` after deploy; then F2. | 2026-10-27 |
| F2 billing/dunning/WA lifecycle | MOSTLY DONE — live, run-cron verification pending | Bagian 1-3 live: milestone overdue; event WA per transisi (epoch); duplikasi kanal tagihan dihapus (WA platform → email); {sisa} reconcile dengan tenggat purge nyata; 6 tahap cron terisolasi. Bukti live: queue persis baseline (42/17 PlatformNotification), cron tanpa secret 401, HTTPS 200. | Sisa G22 (rentang 0..3 hari berbasis jam + dedupe UTC). Verifikasi run cron 29 Okt 01:00 WIB (perilaku milestone + tahap terisolasi). Status DONE hanya setelah bukti itu. | 2026-10-28 |
| F3 reliability/observability | NOT STARTED | Risks: stale `SENDING`, global manual dispatch, booking lead+notification non-atomic. | Lease/reconciliation, alert/replay tooling, crash/concurrency tests. | 2026-10-26 |
| F4 agent/reseller lifecycle | NOT STARTED | Audit: no outbound notices; dashboard/manual actions present. | Event ownership/privacy/channel policy required before coding. | 2026-10-26 |
| F5 template center/legacy cleanup | IN PROGRESS — bagian 1, 2 & G18 LIVE | Bagian 1 (template store DB + editor admin untuk 6 template platform) commit `811d0aa`, deploy release `811d0aa1e240aabc23d5e30becde73db3f0e839e`, migrasi `20261027090000` diterapkan (backup logis terverifikasi). Bagian 2 (renderer tunggal + validasi placeholder copy dunning/inactivity) commit `b9ccebf`; G18 (teks in-app booking dari katalog) commit berikut. Sisa: versioning/rollback + test-send allowlist (G18/G12), cleanup kolom `trialDays`, preview/test-send allowlist, riwayat versi/rollback, cleanup `trialDays`.| Platform templates hardcoded; dunning/inactivity independently editable. | Versioned template editor, adapters, backup/migration after data review. | 2026-10-27 |
| F6 E2E rollout/cleanup | NOT STARTED | No lifecycle deployment. | Deploy, smoke live, timer/queue verification, rollback/runbook, close residuals. | 2026-10-26 |

## Log perubahan progress

- 2026-10-26 — Rencana dibuat; fase F0–F6 dan traceability G1–G30 ditetapkan. Implementasi belum dimulai. Cron aktif terverifikasi; G17 adalah verifikasi infra, bukan penyelesaian perbaikan.
- 2026-10-27 11:40 — `subscription_activated` tidak lagi memakai tanggal hari ini sebagai fallback. Periode dicari dari `Tenant.currentPeriodEnd`, lalu `Subscription.currentPeriodEnd`; bila keduanya null, konfirmasi tidak diantre dan error eksplisit dicatat. Tes meliputi fallback/no-date.
- 2026-10-27 11:45 — F1 commit+deploy: commit `6f3897f2cb4b50bb4c9906f3bb1aa49a5dd53b68`; push `main` berhasil; deploy script exit 0; artifact SHA256 `e887cd1dc167c079444db57ff61104051987f46ad6a2d19059cf3297ee1bb2f5`; release marker cocok; HTTPS `/` dan `/login` 200.
- 2026-10-27 11:52 — Verifikasi live read-only pasca-deploy F1 (tanpa mutasi, tanpa kirim pesan): release `6f3897f…` aktif; timer dunning/reminders/reconcile berjalan (run 01:00/02:00/03:00 WIB). PlanConfig: TRIAL(Basic) autoReminder=false; PROFESSIONAL & BUSINESS autoReminder=true. Tenant TRIAL dengan nextDueDate terisi = 0. PlatformNotification SENT 42, FAILED 17 (belum ada event F1 baru). Payment PENDING 5, PAID 7. Temuan: `LandingContent.heroSubtitle` live masih copy lama "semua otomatis" — koreksi lewat editor Admin → Landing, bukan UPDATE DB langsung. Belum dikerjakan.
- 2026-10-27 19:26 — F5 bagian 1 (kode): model `PlatformTemplate` + migrasi additive `20261027090000_platform_template_store`. Renderer `renderPlatformTemplate` menerima copy aktif; `validateTemplateCopy` menolak variabel tak dikenal, requiredVars hilang, kurung rusak, isi pendek. Service `platform-template-service` (get/list/save/reset, audit log). `notifyPlatform` membaca copy aktif, fallback default kode. Admin → Notifikasi: editor per template (admin-only). Test `platform-template-center` (9 tes); update mock `platform-notification-plan`. Gate: vitest **119 files / 1058 tests PASS**, tsc, eslint --quiet, build, diff-check PASS.
- 2026-10-27 19:40 — F5 migrasi DB produksi (diizinkan pemilik): (1) backup logis read-only 61 tabel `public` → `/opt/aircon-app/backups/pre-platform-template-20261027T120000Z` (2290 baris; manifest terverifikasi; izin 700). `pg_dump` tidak tersedia di VPS, jadi backup logis via `scripts/backup-db-logical.cjs`. (2) SQL `20261027090000_platform_template_store` diterapkan dalam satu transaksi (tabel baru saja) dan dicatat di `_prisma_migrations`; SQL identik semantik dengan `prisma migrate diff`. (3) Verifikasi pasca: 60 tabel data lama baris-identik dengan backup; `PlatformTemplate` 6 kolom sesuai schema; 0 baris (default = kode). Temuan (di luar pekerjaan ini, tidak diubah): 2 migrasi lama (`20260909060000_tenant_wa_verified_phone`, `20260909070000_page_visit`) berstatus rolled back di `_prisma_migrations` padahal objeknya ada di DB; drift default `BillingPolicy`, `CommissionLedger.plan`, `IpaymuConfig.updatedAt` sudah ada sebelumnya.
- 2026-10-27 19:50 — F5 bagian 2 LIVE (commit `b9ccebf`, release `b9ccebf2013837ce54904dc44ab35e4dd5a32025`, HTTPS 200, timer 3 aktif): (a) fallback subjek email hardcode `Pemberitahuan Lumite` → konstanta `EMAIL_SUBJECT_FALLBACK` (jalur mati, tidak terpakai dari notifyPlatform). (b) Copy tenant dunning & inactivity: dua renderer identik (`fillSingle`/`fillTpl`) disatukan ke `renderTenantCopy` di `src/lib/domain/tenant-copy.ts`; validasi admin sebelumnya hanya `min(10)` — kini `validateTenantCopy` menolak placeholder tak dikenal, kurung rusak, dan mewajibkan `{sisa}` pada peringatan. Default schema diverifikasi identik dengan tes. Jalur kirim tetap MessageLog (tenant→pelanggan), tidak dipindah ke PlatformNotification (sesuai rencana §2.1). Gate: vitest **120 files / 1066 tests PASS**, tsc, eslint --quiet, build, diff-check PASS.
- 2026-10-27 21:55 — F2 (bagian 1, lokal): `subscription_overdue` (owner, PlatformNotification) kini hanya diantre pada milestone `BillingPolicy.dunningReminderDays` (default 0,3,7,14,30), bukan tiap hari; dedupe per periode+milestone `subscription_overdue:<tenant>:<nextDueDate>:d<late>`. Bukti live sebelum perubahan: 1 tenant PROFESSIONAL overdue sejak 18 Okt menerima 13 SENT + 6 FAILED overdue harian. Dampak live: tenant itu (hari ke-9) tidak lagi menerima overdue sampai hari ke-14. Modul murni `domain/overdue-milestone.ts`; tes 5 + 2 cycle. Gate: vitest **121 files / 1073 tests PASS**, tsc, eslint --quiet, build, diff-check PASS. Belum: subscription_due/dunning orchestrasi, callback connected/disconnected, reconcile warning (`deleteWarningDay`), tahapan cron terisolasi.
- 2026-10-27 22:10 — F2 bagian 1 LIVE: commit `2427e949a20e318b5f45275bbc7eb3f70292eea6`, HTTPS 200, service aktif, timer aktif. Verifikasi perilaku overdue-milestone di cron live BELUM terjadi (run berikutnya 28 Okt 01:00 WIB) — akan dicek dari journal `aircon-dunning` dan tabel PlatformNotification.
- 2026-10-28 06:50 — F2 bagian 2 LIVE (G6 event sesi WA): kolom `Tenant.waSessionEpoch` (migrasi `20261028090000_tenant_wa_session_epoch`) diterapkan setelah backup logis terverifikasi (62 tabel / 2292 baris, tanpa mismatch; 61 tabel lama tanpa selisih pasca-migrasi; 7 tenant ter-backfill 0). Service `wa-transition-service`: kenaikan epoch atomik (predicate), idempoten untuk callback berulang, gate `PlanConfig.autoReminder` (Basic tanpa pesan), kegagalan antre tak membatalkan state. Callback gateway `ready` kini menghasilkan `wa_connected` (template baru); `disconnected` memakai dedupe per epoch, bukan per hari. Dari unknown → tersambung: dicatat tanpa pesan (bukan "kembali"); unknown → terputus: tetap kirim pesan. Live pasca-deploy: release `5c97d8ff2457631c291041f5eb84a4a84b83926b` aktif; HTTPS 200; callback tanpa secret 401; PlatformNotification 42 SENT / 17 FAILED **persis baseline** (nol pesan tak terencana); epoch semua tenant 0. Gate lokal: vitest **122 files / 1082 tests PASS**, tsc, eslint --quiet, build, diff-check PASS. Verifikasi perilaku live menunggu transisi sesi nyata (event `ready`/`disconnected` berikutnya dari gateway).
- 2026-10-28 07:15 — F2 bagian 3 (lokal, G5 + reconcile hapus + isolasi cron): (a) G5 — pesan TAGIHAN ke owner kini EMAIL SAJA (cycle `subscription_due`/`subscription_overdue` → `channels:["EMAIL"]`). Bukti live yang mendasarinya: `Tenant.phone` == nomor OWNER untuk 6 dari 7 tenant; tenant Jaya Mandiri menerima WA+EMAIL `subscription_overdue` di hari yang sama 5 hari berturut-turut, plus WA dunning ke nomor sama. Dunning (WA tenant) tetap satu-satunya pesan tagihan via WA. Keputusan kanal dicatat di matriks §1B. (b) Reconcile `{sisa}`: sebelumnya `daysBeforeDelete - late` (meleset ~2 hari, mengabaikan purgeGraceHours). Sekarang `sisaHapusSebelumPurge` memakai tenggat purge nyata dari kode: mark saat late>N (≥due+N+1), purge setelah `markedForDeletionAt < now-24h` (ketat) + 1 run harian → earliest = due+N+3 (policy live N=37 → 40 hari). `PURGE_GRACE_HOURS` jadi konstanta bersama dunning+purge. (c) Isolasi tahap cron: `/api/cron/dunning` menjalankan 6 tahap terpisah; kegagalan satu tahap tak melewatkan yang lain; 500 + daftar `failed` bila ada (run-cron.sh `curl -fsS` → journal non-zero). Gate: vitest **123 files / 1092 tests PASS** (tes baru `cron-dunning-stage` 5 tes, `dunning` +5 tes), tsc, eslint --quiet, build, diff-check PASS.
- 2026-10-28 07:30 — G22 (lokal): hari telat & rentang "0..3 hari" & dedupe harian kini memakai HARI KALENDER ZONA TENANT, bukan durasi 24 jam / zona server. Bukti live: tenant Jaya Mandiri jatuh tempo 18 Okt 07:39 WIB; cron 19 Okt 01:00 WIB → hitungan lama memberi 0 hari (17j21m) walau kalender sudah 1 hari, sehingga semua milestone dunning bergeser satu hari. Implementasi: `daysLate`/`shouldSendReminderToday` menerima `tz`; `overdue-milestone` pakai `dayDifferenceInZone`/`dayKeyInZone`; helper baru `dayDifferenceInZone` + `dayKeyInZone` di `domain/tenant-timezone` (jalur existing); `platform-notify-cycle` menyeleksi `timezone` tenant. Bug yang ditemukan & diperbaiki saat pengerjaan: `lateDays` di-clamp 0 sehingga milestone 0 terpicu SEBELUM jatuh tempo → `overdueMilestoneDue` kini mengecek instan (`now < nextDueDate` = tidak due). Gate: vitest **123 files / 1094 tests PASS** (tes kasus live ditambahkan), tsc, eslint --quiet, build, diff-check PASS.
- 2026-10-28 07:30 — F2 bagian 3 LIVE: commit `a01e13d636c0063609b4bd1bfe66739dfb09c00a`; HTTPS 200; cron tanpa secret 401; PlatformNotification 42/17 dan MessageLog 37/5/10/4 **persis baseline** (nol pesan tak terencana). Timer: run terakhir 01:00/02:00/03:00 WIB 28 Okt (sebelum deploy); perilaku cron baru teruji pada run 29 Okt 01:00 — verifikasi live tahap terisolasi + milestone overdue menunggu run itu. Sisa F2: G22 (rentang 0..3 hari berbasis jam, dedupe UTC — belum dikerjakan).
- 2026-10-28 07:40 — G22 LIVE: commit `80ee6c4870d1125d843c11029a87a83d8f91df06`; HTTPS 200; service aktif; PlatformNotification 42/17 persis baseline. Semua tenant berbayar timezone=Asia/Jakarta (diverifikasi live). Perilaku milestone/zona teruji pada run cron 29 Okt 01:00 WIB.
- 2026-10-28 07:50 — F3 bagian 1 (G10 lease & UNKNOWN): migrasi `20261028100000_queue_lease_unknown` (enum MessageStatus + nilai `UNKNOWN`; kolom `sendingAt`/`leaseExpiresAt` di MessageLog & PlatformNotification + indeks) sudah diterapkan ke produksi setelah backup logis terverifikasi (62 tabel / 2293 baris; MessageLog lama 37/5/10/4 tak berubah). Fakta pembatas: gateway TIDAK punya endpoint lookup job → hasil provider tak bisa dipastikan, jadi stale lease ditandai UNKNOWN (BUKAN dikirim ulang — duplikat ke pelanggan lebih buruk). Modul murni `domain/queue-lease.ts` (default 10 menit, clamp 2..120, ENV `MESSAGE_LEASE_MINUTES`/`PLATFORM_NOTIFICATION_LEASE_MINUTES`). Kedua dispatcher: catat lease saat klaim, bersihkan di status terminal, recovery stale→UNKNOWN. Bug yang ditemukan lewat tes: (a) `leaseMinutesFromEnv(undefined)` = 2 menit (Number("")=0 → clamp) → default diperbaiki ke 10; (b) `staleSendingOutcome` dan query SQL tak konsisten soal lease NULL (legacy) → diseragamkan ke stale-unknown; (c) `daysLate` clamp memicu milestone sebelum jatuh tempo (diperbaiki di G22). Gate: vitest **125 files / 1103 tests PASS** (termasuk smoke read-only DB produksi yang menangkap drift skema), tsc, eslint --quiet, build PASS. Status UNKNOWN belum tampil di UI admin (F3 berikutnya).
- 2026-10-28 08:00 — G10 LIVE: commit `bbecb7e3de67b2917e2b5130ca67d5999664526e`; HTTPS 200; service aktif; PlatformNotification 42/17 dan MessageLog 37/5/10/4 persis baseline; baris SENDING = 0 (tak ada yang macet). Perilaku recovery stale→UNKNOWN baru terbukti bila ada lease kedaluwarsa (belum terjadi di live) — verifikasi live menunggu insiden nyata.
- 2026-10-28 08:50 — G18 LIVE (siap deploy): teks notifikasi in-app "booking online baru" tak lagi hardcode. Copy dibaca dari katalog template platform (`booking_inapp`, editable di Admin → Notifikasi), fallback dirender dari template yang sama — satu sumber copy. `booking_inapp` tidak bisa dikirim manual (butuh `nama` pemesan; tujuannya inbox in-app tenant, bukan antrean platform). Variabel `nama`/`layanan` ditambahkan ke daftar variabel known. Tanpa migrasi DB (memakai tabel `PlatformTemplate`). Tes `booking-inapp-notification` 4/4. Gate: vitest **128 files / 1116 tests PASS**, tsc, eslint --quiet, build PASS.
- 2026-10-28 08:45 — G11 LIVE: commit `1249cb74906390d640b52b7c24eb0253e4d8723a`; artifact SHA256 `5dd8f93feecee2739eaaa8f98f4052ce83ba83cf8f5caf13f0993a7fb2010c77`; HTTPS 200; service aktif; 3 timer. Halaman booking `/p/abc-teknik` 200 DAN hidden field `requestId` (UUID 36 char) terverifikasi ada di HTML live. PlatformNotification 42/17, MessageLog 37/5/10/4, Lead 10 — persis baseline (nol booking/pesan tak terencana dari verifikasi).
- 2026-10-28 08:20 — F3 bagian 3 (G11 booking idempoten & failure-safe): migrasi `20261028110000_lead_booking_request_id` (kolom `Lead.requestId` nullable + UNIQUE per tenant) sudah diterapkan setelah backup logis terverifikasi (62 tabel / 2295 baris; 10 lead lama tanpa token, tak berubah). Implementasi: token `randomUUID()` per render halaman publik (halaman `no-store`, jadi token selalu fresh per render) → hidden field `requestId`; `createLeadFromBooking(tenantId, input, requestId)` mengembalikan lead yang sama bila token sudah dipakai, dan menangani balapan P2002; kegagalan notifikasi owner TAKAN membatalkan booking (lead sudah tersimpan = fakta bisnis) — dicatat di log agar operator tahu (G21). Tes `booking-idempotency` 5/5. Gate: vitest **127 files / 1112 tests PASS**, tsc, eslint --quiet, build PASS.
- 2026-10-28 08:25 — F3 bagian 2 LIVE: commit `e6474a25d053a08475ab3f2f5e8e7a4bea0ca8af`; artifact SHA256 `15e18fbfcb589f89018caf0b106cc9f9a8061f6d4cebbbc05bc2ed284c3b8053`; HTTPS 200; service aktif; 3 timer aktif; PlatformNotification 42/17 dan MessageLog 37/5/10/4 persis baseline; Lead 10 (tak berubah) — nol pesan tak terencana.
- 2026-10-28 08:10 — F3 bagian 2 (G20 kirim terarah + G9/G29 status UNKNOWN di admin): (a) `notifyPlatform` kini mengembalikan `ids` baris yang dibuat; `dispatchPlatformNotifications(limit, onlyIds)` menerima daftar id — kirim manual admin dispatch HANYA baris itu (sebelumnya menyedot antrean global, jadi satu klik ikut mengirim antrean tenant lain). Batas `attempts` tidak berlaku untuk kirim manual (keputusan operator) dan recovery stale tidak dijalankan pada dispatch terarah. (b) Admin → Notifikasi menampilkan kartu "Tak Pasti" (count UNKNOWN) + badge status UNKNOWN + penjelasan bahwa pesan tak dikirim ulang otomatis. (c) Label tombol "Kirim Antrean Tertahan" → "Kirim Semua Antrean Tertahan" (jujur soal cakupannya). Gate: vitest **126 files / 1107 tests PASS** (tes baru `platform-dispatch-targeted` 4 tes), tsc, eslint --quiet, build PASS.
## 1A. Baseline F0 terverifikasi (26–27 Okt 2026)

### Repo & test
- Base commit: `688690197eafb8bb7cd98a714f2c576535d14c49`, branch `main`, working tree bersih kecuali 2 dokumen baru.
- Test baseline: `pnpm exec vitest run` → **112 file / 1017 test PASS** (26 Okt). Subset notifikasi: `platform-notification`, `platform-notification-duplicate`, `wa-callback-status`, `onboarding`, `reminder-plan-gate` → 39 test PASS.

### Infra live
- Systemd timers enabled: `aircon-dunning.timer` (01:00), `aircon-reminders.timer` (02:00), `aircon-reconcile.timer` (03:00). Run 27 Okt: dunning `checked=0, sent=0, queued=0`, platform notify 0; reminders `tenants=1, sent=0, failed=0`. Channel WA+email terkonfigurasi (nama env dicek, nilai tidak dibaca).

### Antrean produksi (sebelum perubahan)
| Antrean | Status | Jumlah | Tertua |
|---|---|---|---|
| PlatformNotification | SENT | 42 (WA 16, EMAIL 26) | 16 Sep 2026 |
| PlatformNotification | FAILED | 17 (WA 16, EMAIL 1) | 27 Sep 2026 |
| PlatformNotification | QUEUED / SENDING | 0 | — |
| MessageLog outbound WA | FAILED | 10 | 26 Sep 2026 |
| MessageLog outbound WA | QUEUED / SENDING | 0 | 0 record SENDING >10 menit |

Rincian FAILED PlatformNotification: `wa_disconnected` WA 5, `subscription_overdue` WA 5 + EMAIL 1, `subscription_due` WA 3, `welcome` WA 3. Semua FAILED berumur >3 hari → tidak ada retry otomatis; tidak boleh direplay tanpa klasifikasi per baris (G10/G21).

### Data paket & tenant (live)
| Plan | Display | autoReminder | maxCustomers | maxAcUnits | Aktif |
|---|---|---|---|---|---|
| TRIAL | Basic | **false** | 20 | 50 | ya |
| PROFESSIONAL | Professional | true | 200 | 600 | ya |
| BUSINESS | Business | true | unlimited | unlimited | ya |

Tenant: 5 × `TRIAL/ACTIVE` (Basic), 1 × `PROFESSIONAL/ACTIVE`, 1 × `PROFESSIONAL/SUSPENDED`. Semua 5 tenant Basic punya nomor telepon terisi (tidak ada tenant Basic tanpa target).
Belum ada tenant berstatus `PAST_DUE`. `PlanConfig.autoReminder` Basic = false, jadi gate reminder otomatis sudah benar di kode; yang rusak adalah **copy** pesan yang tetap menjanjikan otomatis (G1).

### Baseline yang harus dijaga saat perbaikan
1. Reminder otomatis hanya untuk paket `autoReminder=true` (perilaku ini benar hari ini — jangan sampai rusak).
2. Tenant Basic tetap punya akses inbox pengingat + tombol kirim manual `wa.me` (jalur manual bukan otomatis).
3. Halaman Pengaturan → Hubungkan WhatsApp untuk Basic tetap menampilkan kartu paket (plan-locked), bukan QR.
4. Tidak ada perubahan pada `MessageLog` (jalur tenant→pelanggan) selain perbaikan reliability yang disepakati.
5. Records FAILED tidak boleh dihapus/replay massal tanpa klasifikasi dan approval.

## 1B. Matrix event × penerima × plan × kanal (baseline Fase 0, finalisasi Fase 1)

Sumber kebenaran: `PlanConfig.autoReminder` + status tenant/payment/subscription + status koneksi WA. Copy tidak pernah menentukan eligibilitas.

| Event | Trigger (transisi) | Penerima | Basic (autoReminder=false) | Professional/Business | Kanal | Dedupe identity |
|---|---|---|---|---|---|---|
| `welcome` | tenant dibuat | Owner | **ya**, copy tanpa ajakan connect WA & tanpa janji otomatis | ya, copy memandu connect WA | WA platform + email (+in-app) | `welcome:<tenantId>` |
| `subscription_activated` | payment→PAID & subscription aktif | Owner | n/a (Basic tidak punya tagihan) | ya | email + in-app (+WA opsional) | `payment:<orderId>:PAID` |
| `payment_failed` / `payment_expired` | payment→FAILED/EXPIRED | Owner | n/a | ya (pembelian paket berbayar) | email + halaman Langganan | `payment:<orderId>:<status>` |
| `subscription_due` | nextDueDate ≤ +3 hari | Owner | n/a | ya | **email saja** (WA platform dihapus — nomor sama dengan dunning WA) | `subscription_due:<tenantId>:<tanggal>` |
| `subscription_overdue` | nextDueDate < now, **hanya pada milestone** `dunningReminderDays` | Owner | n/a | ya | **email saja** (idem) | `subscription_overdue:<tenantId>:<nextDueDate>:d<late>` |
| `wa_disconnected` | callback state→DISCONNECTED | Owner | **tidak** (Basic tak punya gateway) | ya | in-app + email (+WA platform bila terjangkau) | `wa:<tenantId>:DISCONNECTED:<epoch>` |
| `wa_connected` | callback state→CONNECTED | Owner | tidak | ya | in-app (+email opsional) | `wa:<tenantId>:CONNECTED:<epoch>` |
| `dunning_reminder` | telat ≥ hari terjadwal | Owner | n/a | ya | WA tenant (MessageLog) — **satu-satunya pesan tagihan via WA** | dedupe harian `lastDunningReminderAt` |
| `dunning_warning` | telat ≥ `deleteWarningDay` | Owner | n/a | ya | WA tenant (MessageLog) | dedupe harian |
| `inactivity_reminder` | idle ≥ R1/R2 & switch ON | Owner | ya | ya | WA tenant (MessageLog) | stage 1→2 |
| `tenant_notified_new_lead` | Lead dibuat (booking publik) | Owner | ya | ya | in-app | `new-lead:<leadId>` |
| `technician_invite` | owner mengInvite teknisi | Teknisi | ya | ya | WA tenant (aksi manual owner) | invite token |
| `job_assigned` | penugasan kerja | Teknisi | ya | ya | Web Push (fallback in-app) | job assignment |

Event agent/reseller (Fase 4) memakai matriks serupa dengan penerima = PIC/reseller; kanal awal email + in-app portal; WA hanya dengan consent + nomor terverifikasi.

**Keputusan produk yang masih harus dikunci sebelum Fase 1 Endsi:**
1. Kanal resmi `welcome`: WA platform + email + in-app, atau email + in-app saja? (WA platform memakai nomor bisnis tenant — bisa membingungkan bila tenant menyangka pesan dari nomor usaha sendiri.) **KEPUTUSAN (28 Okt 2026, berbasis bukti live): pesan TAGIHAN ke owner memakai EMAIL SAJA.** Fakta: `Tenant.phone` == nomor owner untuk 6 dari 7 tenant; WA platform + WA dunning mendarat di nomor sama (bukti: WA+EMAIL overdue di hari sama, 5 hari berturut-turut). `welcome` tetap WA+email (bukan tagihan).
2. Placeholder yang dipakai pengaman `{{nama_pemilik}}` → sumber nama owner (User.fullName) atau nama usaha? Saat ini template memakai `{{tenant}}` = nama usaha.
3. Nominal tagihan authoritative: `Payment.amount` (termasuk pajak & diskon) atau `Subscription.amountMonthly`? Default: `Payment.amount`.
4. Nomor CS/dukungan resmi untuk placeholder `{{kontak_bantuan}}` — sumber tunggal, bukan nomor hardcode.

## 1. Prinsip wajib

1. **Jangan membangun dispatcher/channel paralel.** Perbaiki `PlatformNotification` + `platform-notification-service` + `platform-notification-dispatch` untuk pesan Aircon→penerima platform; pertahankan `MessageLog` + `message-dispatch-service` untuk tenant→pelanggan. Tambah kemampuan yang diperlukan ke jalur tersebut.
2. **Setiap jalur lama harus punya nasib eksplisit.** Pertahankan, migrasikan, atau hapus setelah consumer/data/test membuktikan aman. Tidak boleh meninggalkan template, key, cron, enum, kolom, fallback, atau kode mati yang masih memberi perilaku berbeda.
3. **Aturan produk bukan isi template.** Paket Basic/Professional/Business, `autoReminder`, status payment/subscription, dan status koneksi menentukan eligibilitas di kode. Editor template hanya mengubah copy, bukan mengubah policy.
4. **Sumber kebenaran tunggal per kejadian.** Satu state transition bisnis menghasilkan maksimal satu event logis; channel WA/email tidak menjadi dua event terpisah. Satu dedupe/idempotency identity bertahan lintas retry dan channel.
5. **Tidak ada klaim delivery tanpa bukti.** Bedakan `QUEUED`, `SENDING`, `SENT`/provider accepted, `DELIVERED`, `READ_CONFIRMED`, `FAILED`, `SUPPRESSED`. `SENT` bukan delivered/read. Untuk WhatsApp manual via `wa.me`, catat konfirmasi pengguna sebagai manual, bukan ACK gateway.
6. **Kegagalan notification tidak boleh membatalkan transaksi bisnis yang sudah commit**, kecuali proses tidak dapat berfungsi tanpa komunikasi tersebut. Gunakan transaksi/outbox yang tepat; hindari error palsu yang memicu submit ulang.
7. **Setiap perubahan backward-compatible dan berurutan.** Expand schema → dual-read/compatibility → backfill → switch writes/reads → verify → remove fosil. Jangan drop kolom/key sebelum semua consumer dan antrean lama aman.
8. **Tidak ada pesan pelanggan/partner sungguhan selama QA** tanpa nomor/email test allowlist, consent, dan approval pengiriman.

## 2. Target arsitektur (memakai jalur existing)

### 2.1 Dua domain pengiriman tetap jelas

- **Platform → tenant/agent/reseller:** pertahankan antrean dan dispatcher `PlatformNotification`. Generalisasi target penerima agar dapat mewakili tenant, agent, atau reseller dengan foreign key nullable yang saling eksklusif (atau struktur target setara yang memenuhi integritas referensial). Jangan membuat dispatcher partner sendiri.
- **Tenant → pelanggan/teknisi:** pertahankan `MessageLog` dan `message-dispatch-service`. Perbaiki retry, status, dan observabilitas pada jalur ini; jangan pindahkan reminder tenant ke `PlatformNotification`.
- **In-app:** pertahankan `TenantNotification` untuk inbox tenant; perluas prinsip/event storage hanya jika dibutuhkan untuk inbox mitra, bukan membuat delivery engine paralel. Pusatkan event dan idempotensi agar email/push/in-app tidak saling menggandakan.

### 2.2 Template editable, policy tetap aman

Buat storage template versioned untuk platform melalui service/DB yang terintegrasi ke `PlatformNotification` yang ada. Template minimum: key/event, locale, channel/subject/body, required placeholders, version, active state, updatedBy/updatedAt. Antrean menyimpan snapshot copy + versi yang dipakai sehingga perubahan template tidak mengubah pesan queued. Admin → Notifikasi menjadi control panel: daftar event, edit, preview, validasi placeholder, test ke alamat allowlisted, publish/rollback, history. `notifyPlatform()` dan semua pemanggil tetap lewat service yang sama.

### 2.3 Event/outbox dan idempotensi

Gunakan row PlatformNotification sebagai outbox pengiriman yang sudah ada, bukan membuat antrean baru. Event ID logis dibuat dari sumber bisnis dan transisi stabil—contoh `payment:<orderId>:PAID`, `wa:<tenantId>:DISCONNECTED:<connectionEpoch>`, `payout:<payoutId>:PAID`. Buat event hanya saat transisi valid, bukan setiap webhook/cron run. Setiap recipient/channel derivation idempoten.

## 3. Tahapan kerja dan acceptance gates

### Fase 0 — Baseline, inventaris dan safety rails

**Pekerjaan**
- Kunci daftar seluruh call sites, template, placeholder, kanal, status, cron, pengaturan admin, dan model data dari gap analysis.
- Catat current behavior melalui tests characterization. Verifikasi policy paket live, status Basic, callback WA, timeout/retry provider, antrean queued/sending/failed, cron systemd dan journal.
- Backup DB/migration plan. Siapkan test recipients dan safe mode/allowlist yang mencegah pengiriman QA ke pelanggan/partner riil.
- Definisikan matrix event × penerima × plan × kanal × dedupe × delivery evidence. Pemilik produk menyetujui copy dan istilah Basic/berbayar sebelum publish.

**Gate**
- Semua jalur dan pemiliknya terpetakan; production baseline tidak berubah.
- Tidak menjalankan replay/retry massal sebelum status ambiguous direkonsiliasi.

### Fase 1 — Correctness produk P0

**Pekerjaan**
1. **Basic/Gratis:** `welcome` tidak meminta tautkan WA, tidak menyebut masa trial, tidak menjanjikan auto-reminder. Copy menyebut gratis selamanya, kuota paket, dan manual send via WhatsApp pemilik.
2. **Paid welcome:** copy Pro/Business memandu sambungkan WA; hanya dikirim jika paket mengizinkan auto-reminder. Jangan mengubah halaman Pengingat Basic atau jalur `wa.me` manual.
3. **Upgrade/payment:** pada transisi payment ke PAID dan subscription aktif, enqueue satu konfirmasi idempoten untuk paket baru. Sertakan tanggal/periode dan CTA Hubungkan WhatsApp hanya jika `PlanConfig.autoReminder=true`. Jangan mengirim CTA sebelum activation transaction sukses.
4. **Pembayaran pending/failed/expired:** gunakan state yang benar dan link yang masih berlaku; hindari menyatakan paket aktif/lunas.
5. **`subscription_due`:** pasok placeholder paket, nominal authoritative, tanggal, link yang benar. Validasi render menolak placeholder wajib kosong/unknown; gagal render masuk error/monitoring dan tidak dikirim sebagai copy rusak.
6. **Trial fosil:** audit tenant live `plan/status/nextDueDate` dan payment history. Basic adalah gratis selamanya. Hentikan pemicu `trial_ending` untuk Basic; kemudian hapus `trial_ending`, `trialDays`, UI field, schema field/migration, validator, tests, dan teks "trial habis" hanya setelah seluruh consumers dan data historis direview. Jangan mengubah tenants berstatus TRIAL secara massal tanpa dry-run/review.
7. **Marketing:** konsistenkan landing, FAQ, structured metadata, help, plan cards, login/onboarding dengan klaim Basic manual / paid auto setelah koneksi ready.

**Tests/Gate**
- Unit: varian template dan policy matrix; tests: Basic tidak pernah menerima connect/auto copy; paid welcome/upgrade mendapat CTA; payment retries idempoten.
- Template test memastikan semua placeholder wajib terisi, nominal sesuai checkout/payment authoritative, tanggal timezone benar.
- E2E pembayaran test/sandbox → webhook PAID → subscription active → tepat satu event, tanpa kirim live.
- Search gate: tidak ada user-facing teks “trial habis” untuk Basic.

### Fase 2 — Siklus WhatsApp paid dan billing/dunning

**Pekerjaan**
- Pastikan callback disconnected/connected hanya mengirim event untuk tenant dengan `autoReminder=true` dan hanya saat state berubah. Tambah reconnect notice; jangan memberitahu Basic bahwa reminder otomatis berhenti.
- Validasi phone destination dan owner fallback; missing contact menjadi `SUPPRESSED`/reason yang terlihat, bukan hilang diam-diam.
- Satukan makna `subscription_due` dan `subscription_overdue` dengan dunning `MessageLog` tanpa menghapus jalur kirim yang sudah berjalan. Tetapkan satu orchestrator/business event dan satu jadwal/milestone per tenant; dunning tetap menggunakan dispatch yang sudah ada untuk pesan tenant jika itu jalur yang dipilih. Pastikan tidak ada dua pesan identik akibat dua flow.
- Reconcile template warning dengan `graceDaysBeforeSuspend`, `deleteWarningDay`, `daysBeforeDelete`, `purgeGraceHours`, status aktual dan tanggal purge yang benar. Pesan penghapusan hanya bila deadline pasti.
- Pisahkan kegagalan per tahap cron: setiap subtask log hasil; failure dunning tidak boleh diam-diam mencegah platform notify, atau sebaliknya. Timer aktif yang ada dipertahankan dan diverifikasi sesudah deploy.
- Inactivity sweep tetap master-switch OFF/dry-run ON sampai kebijakan retensi disetujui; jangan mengaktifkan atau mengubah penghapusan sebagai bagian dari template work.

**Tests/Gate**
- Callback duplicate/out-of-order; disconnect→reconnect; Basic vs paid; status monotonic.
- Dunning milestones, recovery after payment, no duplicate across PlatformNotification/MessageLog, warning date matches policy.
- Cron service tests isolate failures; live dry-run/QA and timer journal verified.

### Fase 3 — Reliability dan observabilitas antrean existing

**Pekerjaan**
- Tambah `updatedAt`/lease token/lease expiry atau mekanisme setara pada claim PlatformNotification dan MessageLog SENDING; implementasikan recovery worker di dispatcher existing.
- **Jangan blindly requeue stale SENDING.** Rekonsiliasi berdasarkan gateway idempotency key/job status. Jika outcome provider tidak dapat dipastikan, tandai `UNKNOWN`/needs review atau rekonsiliasi sebelum kirim ulang; cegah duplicate customer reminders.
- Buat state model yang konsisten lintas jalur: queued, sending, accepted/sent, delivered, read-confirmed/unobserved, failed, suppressed, unknown. Pertahankan kompatibilitas enum lama lewat migrasi bertahap; konversi terminal states hanya dengan mapping eksplisit.
- Pastikan callback status mengupdate row domain tepat (platform notification atau MessageLog), bukan menebak dari isi pesan. Tampilkan ACK terkini di admin dan tenant; email menunjukkan hanya accepted/send status bila provider tidak memberi delivery receipt.
- Buat alert/dashboard untuk stale SENDING, queued terlalu lama, failed, channel tidak configured, tidak ada cron run. Penanganan/replay manual harus tenant-scoped, permission-checked, audit-logged.
- Perbaiki aksi booking: lead persist dan confirmation/in-app notification memiliki failure semantics yang tidak membuat user submit ulang dan duplikasi lead. Gunakan transactional outbox/idempotent request; jangan mengubah pengalaman booking tanpa regression test.
- Kirim manual admin harus dispatch row yang baru dibuat/targeted, bukan menyedot global antrean; dukung dedupe key/manual action ID dan preview.

**Tests/Gate**
- Crash simulation sebelum/sesudah provider acceptance, timeout ambiguity, concurrent dispatch, provider duplicate 409, stale lease recovery.
- Tidak ada auto resend bila outcome unresolved; tidak ada pesan ganda dalam E2E.
- Alert dan rekonsiliasi terbukti, termasuk failed/SENDING lama dari data lama.

### Fase 4 — Lifecycle agent/reseller melalui platform engine

**Pekerjaan**
- Extend target model/service `PlatformNotification` untuk agent/reseller, bukan membuat mailer/WA sender khusus. Identitas target harus FK/integrity-safe; satu target per row; tidak ada `tenantId` wajib yang dipalsukan untuk partner.
- Tambahkan in-app inbox partner hanya jika kebutuhan UX mengharuskannya; gunakan event/template/dedupe/policy yang sama dan portal existing. Email sebagai kanal awal; WA hanya jika consent + nomor terverifikasi + operasional sesuai. Jangan mengirim data tenant/pelanggan atau data bank sensitif.
- Event: agent invite/token issued; agent activated; reseller registration received (ke reseller + agent); approved/rejected (ke reseller); reseller activated; tenant attributed (nama/status minimum); commission accrued; reversal/refund; payout draft/approved/paid.
- Buat event commission hanya setelah ledger commit. Gunakan ledger ID dan payout ID untuk idempotensi. Reversal menjelaskan status sumber; accrual bukan janji payout.
- Perbaiki token aktivasi: expiry field/policy, sekali pakai atomik, reissue revokes prior token; link publik memakai configured HTTPS base URL; jangan log token. Hindari membuat link aktif tanpa masa berlaku yang disampaikan.
- Implementasi approval/rejection tetap melalui `approveReseller`/`rejectReseller`; tambah enqueue melalui service setelah transaction commit/outbox. Payout notice hanya setelah `markPayoutPaid` berhasil dan `transferRef` tersimpan.
- Pusatkan kontak/support placeholders dan opt-out preference yang sesuai; audit privacy untuk email PIC, reseller phone, referral attribution.

**Tests/Gate**
- Lifecycle E2E agent invite → activate; reseller register → approve/reject → activate; referral attribution; PAID commission; refund reversal; payout PAID.
- Webhook duplicate menghasilkan satu notice/event; recipient isolation agent/reseller; approval commit tetap sukses bila provider down, event tertahan/retry aman.
- No leakage of bank account, PIN, activation token, unrelated tenant/customer information.

### Fase 5 — Template Center dan retirement fosil

**Pekerjaan**
- Migrasi kelima hardcoded `PLATFORM_TEMPLATES` ke template store dengan default seed/version. Semua read/write harus lewat satu renderer/service; jangan ada call site membaca konstanta bypass DB setelah cutover.
- Gabungkan template dunning/inactivity `BillingPolicy` ke editor katalog **tanpa mengubah runtime semantics sekaligus**. Pertahankan compatibility adapter sampai semua consumers pindah; lalu migrasikan nilai yang sudah diedit (snapshot live) dan baru retire kolom lama dalam migration terpisah.
- Kelola reminder tenant template per tenant secara terpisah domainnya: tetap `MessageTemplate`, editor tenant dan placeholders yang sudah ada. Jangan pindahkan copy tenant ke global template platform.
- Tambahkan kategori template: transactional, operational/security, product onboarding, partner lifecycle. Simpan bahasa, channel, subject/body, placeholder schema, version, status, audit actor/timestamp.
- UI: edit draft → preview per recipient/plan/channel → validation → test send ke allowlist → publish/rollback. Batasi admin role; sanitasi HTML/email; larang body mengubah plan eligibility.
- Hapus konstanta dan adapter legacy setelah search, tests, migrations, antrean old snapshot, dan prod logs membuktikan tidak ada consumer. Hapus schema fields `trialDays` hanya setelah migration + rollback plan dan data review.

**Tests/Gate**
- Migration from existing BillingPolicy values preserves exact text/threshold and test edit/publish/rollback.
- Unknown placeholder rejected; required variables validated; queued snapshot unchanged after edit.
- Repo search confirms no obsolete template key or dead config references; DB migration and rollback tested on copy.

### Fase 6 — End-to-end verification, rollout, cleanup

**Pekerjaan**
- Run typecheck, lint, unit tests, integration tests, route tests, schema/migration checks, and isolated E2E for each event and channel.
- Verify all timers and recent run journals; measure counts before/after; reconcile existing queued/failed/SENDING records. No bulk replay without per-row classification and approval.
- Deploy expand migrations first, then application; enable new event producers after code compatibility verified. Roll out template/admin UI behind feature flag if needed; keep old sender path functioning until cutover evidence passes.
- Smoke-test WA platform/tenant/partner only to allowlisted test destinations; verify provider message ID and callbacks; verify database status and admin UI. Verify email using test mailbox.
- Observe at least one full cycle for cron reminders/dunning, billing due, and partner event; compare expected event count against actual queue/delivery statuses.
- Remove dead code, old keys, duplicate template definitions, stale feature copy, unused columns only after zero reads/writes and retention sign-off. Update gap analysis and SSOT/runbooks.

**Release gate**
- No increase in duplicate sends; no Basic automatic WA; no empty template placeholders; no unsupported Trial expiry message.
- Payment/commission/payout state and notification log reconcile one-to-one by source transition.
- No stale SENDING without alert/recovery decision; no unobserved failed event.
- Cron timer last success and event outputs verified live.
- All modified rows have source ID, recipient, template version, channel, dedupe key, attempt history and delivery evidence tier.
- Rollback path tested; operator runbook covers stop-send switch, queue hold, safe replay, and cleanup.

## 4. Matrix utama event → penerima → copy

Copy berikut adalah rancangan untuk proses implementasi; publish hanya setelah owner menyetujui variabel dan policy.

| Urutan | Event | Penerima/channel awal | Copy ringkas |
|---|---|---|---|
| Basic signup | Basic welcome | Owner; email + in-app, WA Lumite bila nomor contact sah dan consent/policy mengizinkan | “Paket Basic Anda aktif gratis selamanya. Pengingat jatuh tempo dikirim manual dari menu Pengingat melalui WhatsApp Anda.” |
| Paid signup | Pro/Business welcome | Owner; email + WA Lumite, in-app | “Paket {{paket}} aktif. Sambungkan WhatsApp usaha di Pengaturan agar pengingat otomatis dapat berjalan.” |
| Upgrade PAID | Subscription activated | Owner; email + in-app (WA opsional) | “Pembayaran berhasil; paket {{paket}} aktif hingga {{tanggal}}. Sambungkan WhatsApp usaha untuk memulai pengingat otomatis.” |
| Payment not completed | Payment failed/expired | Owner; email + halaman Langganan | “Pembayaran belum selesai; paket belum berubah. Periksa transaksi atau coba lagi melalui {{link}}.” |
| WA disconnected | Paid connected tenant | Owner; in-app + email; WA Lumite bila dapat dijangkau | “Koneksi WhatsApp terputus pada {{waktu}}. Pengingat otomatis tertahan. Sambungkan kembali di {{link}}.” |
| WA restored | Paid connected tenant | Owner; in-app | “WhatsApp tersambung kembali. Periksa antrean pengingat tertunda; pesan terkirim tidak akan dikirim ulang.” |
| Invoice due / overdue | Paid owner | Email + in-app; WA platform optional | “Tagihan {{paket}} sebesar {{nominal}} jatuh tempo {{tanggal}}. Rincian dan pembayaran: {{link}}.” |
| Suspend/restore | Owner tenant | Email + in-app; staged | Nyatakan status aktual, fitur terdampak, tanggal berlaku, dan cara pulih; tanpa mengklaim data dihapus jika belum. |
| Agent invite | Agent PIC | Email | “Undangan portal Aircon. Aktifkan lewat tautan aman yang berlaku hingga {{expiry}}.” |
| Reseller registration | Reseller + agent | Email/in-app portal | Reseller: “Pendaftaran diterima, menunggu review.” Agent: “Pendaftaran {{nama}} menunggu keputusan.” |
| Reseller decision | Reseller | Email + portal | Approved: tautan aktivasi + kode referral. Rejected: keputusan sopan + kontak agen. |
| Referral attribution | Agent/reseller terkait | In-app/email | “Tenant {{nama_usaha}} tercatat melalui kode referral Anda; komisi mengikuti pembayaran berhasil.” |
| Commission accrual/reversal | Agent, reseller sesuai entitlement | Email/in-app | Nilai/status ledger, transaksi referensi, penjelasan accrual/reversal; bukan janji payout. |
| Payout PAID | Agent | Email + portal | “Payout periode {{bulan}} ditransfer sebesar {{net}}; referensi {{ref}}.” |

**Policy penting:** Basic tidak menerima CTA connect WA. CTA untuk paid hanya ketika `autoReminder=true`; status WA belum ready berarti instruksi setup, bukan klaim otomasi sudah berjalan. WA platform ke nomor tenant dapat gagal ketika nomor itu belum tercatat/valid; fallback email/in-app harus dilaporkan, bukan diasumsikan.

## 5. Dependency, urutan dan keputusan produk

Urutan implementasi: **Fase 0 → 1 → 2 → 3 → 4 → 5 → 6**. Fase 0–3 memperbaiki jalur tenant yang ada terlebih dahulu. Fase 4 memperluas engine existing untuk partner setelah model penerima dan privacy disepakati. Fase 5 mengcentralize templates tanpa membongkar domain MessageLog. Fase 6 baru menutup legacy setelah bukti.

Keputusan yang perlu dikunci sebelum implementasi terkait:
- Kanal resmi per event (email/WA/in-app), consent dan preference/opt-out.
- Apakah WA Lumite boleh mengirim transactional welcome/billing ke nomor yang dipakai sebagai nomor usaha tenant; fallback saat tidak ada email.
- Nama resmi Basic vs enum `TRIAL`; mapping data tenant historis; jangan mengubah status hanya dari nama plan.
- Apakah reminder dunning dikirim melalui WA nomor Lumite (platform) atau nomor tenant (saat koneksi available). Jangan mengubah kanal saat menyatukan duplicate events tanpa approval bisnis.
- Masa berlaku token aktivasi mitra dan kebijakan reissue.
- Apakah reseller berhak melihat/menerima komisi sendiri atau komisi hanya ke agent; schema saat ini menyimpan reseller amount sebagai kewajiban/INFO agent dan payout otomatis hanya untuk agent.
- Bahasa, jam tenang, frekuensi maksimum, dan alamat kontak/support resmi.

## 6. Rencana bersih-bersih jalur lama (tidak meninggalkan fosil)

Setiap item hanya boleh dihapus setelah checklist ini lulus:

1. Cari semua referensi key/field/function di app, API, cron, tests, seeds, docs, migration, admin UI dan build artifacts.
2. Catat data produksi yang sudah memakai key/field, queued snapshots, status, dan backfill mapping; export/backup sebelum perubahan schema.
3. Terapkan compatibility reader/writer sementara; ukur penggunaan lama. Jangan memperbarui snapshot queued.
4. Pindahkan seluruh caller ke service/registry baru dalam commit terukur; tests menolak referensi legacy yang tak disetujui.
5. Jalankan production read-only audit untuk memastikan tidak ada consumer/write lama dan tidak ada antrean aktif yang bergantung pada key lama.
6. Hapus API/key/adapter/UI/config hanya melalui migration dan release terpisah; verifikasi schema drift dan deployment.
7. Hapus copy di help/landing/docs yang sudah tidak benar. Arsipkan keputusan/rollback di SSOT, jangan sisakan TODO “editable menyusul” bila telah selesai.
8. Setelah deploy, search ulang repo dan live schema; laporkan item legacy yang benar-benar dihapus beserta bukti.

## 7. Traceability: temuan gap analysis → fase penanganan

Setiap temuan dari `docs/GAP_ANALYSIS_NOTIFIKASI_SAAS_AIRCON.md` dipetakan ke fase dan bukti penutupannya. Tidak ada temuan yang boleh tersisa tanpa pemilik fase.

| # | Temuan (dokumen audit) | Fase | Bukti penutupan | Status |
|---|---|---|---|---|
| G1 | Welcome tidak gate paket; copy salah untuk Basic (P0) | 1 | `resolveWelcomeTemplateKey` pilih dari `PlanConfig.autoReminder`; tes matrix Basic/paid (`platform-notification-plan`, `platform-notification`) | Dikerjakan lokal — menunggu deploy |
| G2 | Tidak ada notifikasi upgrade/aktivasi sukses (P0) | 1 | `subscription_activated` enqueue setelah PAID; CAS gate; CTA dari `autoReminder` paket dibeli; 6 tes (`subscription-activated-notify`) | Dikerjakan lokal — E2E live menunggu deploy |
| G3 | Placeholder `{{paket}}`/`{{nominal}}` subscription_due kosong (P0) | 1 | Validator menolak placeholder wajib kosong & menyisakan `{{…}}`; cycle isi `paket`+`nominal`; 3 tes cycle + tes render | Dikerjakan lokal — menunggu deploy |
| G4 | `trial_ending`/`trialDays`fosil bertentangan dengan Basic gratis (P0) | 1, 5 | `trial_ending` dihapus dari katalog/runtime; UI/validator `trialDays` dihapus; label & health Basic diperbaiki | Sebagian — kolom DB `trialDays` + `gating.trialDays()` ditahan untuk migrasi F5 |
| G5 | Dunning vs platform overdue overlap, kanal berbeda (P1) | 2 | Tagihan owner = EMAIL saja; WA tagihan hanya dunning MessageLog; matriks diperbarui; perilaku cron menunggu run 29 Okt 01:00 | Dikerjakan & live — verifikasi run cron pending |
| G6 | Tidak ada event WA connected/recovery; disconnect tak paham paket (P1) | 2 | Callback `ready`→`wa_connected`, `disconnected`→epoch; gate autoReminder; tes 8 (`wa-transition`) + 4 (callback plan) | Dikerjakan lokal & live — perilaku live menunggu transisi sesi nyata |
| G7 | Tidak ada event payment pending/failed/expired (P1) | 1 | `payment_failed`/`payment_expired` pada PENDING→terminal saja; dedupe `payment:<orderId>:<status>`; nama paket yang dibeli; copy menolak klaim aktif; 7 tes (`payment-outcome-notify`) | Dikerjakan lokal — menunggu deploy |
| G8 | Tidak ada notifikasi agent/reseller sama sekali (P1) | 4 | — | Belum dikerjakan |
| G9 | Status SENT dipakai seolah delivered/read (P1) | 3 | — | Belum dikerjakan |
| G10 | Baris SENDING tanpa lease/reclaim; retry duplikasi (P1) | 3 | — | Belum dikerjakan |
| G11 | Booking: lead tersimpan tapi action gagal (P1) | 3 | — | Belum dikerjakan |
| G12 | Template center lintas flow tidak ada (P1) | 5 | — | Belum dikerjakan |
| G13 | Booking: pemesan tanpa bukti/ konfirmasi (P2) | 1, 3 | — | Belum dikerjakan |
| G14 | Push tugas hardcode, tanpa fallback (P2) | 3 | — | Belum dikerjakan |
| G15 | Marketing mencampur fitur paket (P2) | 1 | Landing/FAQ/JSON-LD/help/kartu dashboard diselaraskan: Basic manual, berbayar otomatis setelah tersambung | Sebaran — kode lokal beres; baris `LandingContent` live masih copy lama |
| G16 | Tidak ada katalog event keamanan/gangguan (P2) | 1, 6 | — | Belum dikerjakan |
| G17 | Cron tidak terbukti aktif (semula dianggap gap) | 2, 6 | Terverifikasi aktif via systemd timer + journal; guard kegagalan per subtask | Terverifikasi |
| G18 | Admin Notifikasi tanpa editor isi pesan (P1) | 5 | Editor isi pesan per template (subject+body, validasi placeholder, reset default, audit log) — 10 template platform | Sebagian — versioning/rollback & test-send allowlist belum |
| G19 | Copy admin masih menyebut "trial habis" | 1, 5 | Teks diganti "jatuh tempo langganan"; `trial_ending` hilang dari katalog | Dikerjakan lokal — menunggu deploy |
| G20 | Kirim manual tanpa dedupe; dispatch sedot antrean global | 3 | `notifyPlatform` mengembalikan ids; dispatcher menerima `onlyIds`; kirim manual dispatch terarah; recovery stale hanya di dispatch global | Sebagian — replay UNKNOWN oleh operator & audit log manual belum |
| G21 | Kegagalan antrean welcome/disconnect ditelan tanpa jejak | 3 | Tahap cron terisolasi + 500/failed list (route `/api/cron/dunning`); log per tahap | Sebagian (cron dunning) — alert dashboard masih menunggu F3 |
| G22 | Rentang "0..3 hari" berbasis jam, dedupe UTC | 2 | `daysLate`/`shouldSendReminderToday`/`overdue-milestone` pakai hari kalender zona tenant (`dayDifferenceInZone`, `dayKeyInZone`); kasus live diuji; release `80ee6c4` | Dikerjakan & live — verifikasi run cron 29 Okt 01:00 |
| G23 | Dunning/inactivity punya template sendiri di luar katalog | 5 | Digabung ke katalog dengan adapter kompatibilitas, lalu kolom lama di-retire | Belum dikerjakan |
| G24 | Partnership: token aktivasi tanpa expiry | 4 | Expiry + sekali pakai atomik + reissue revoke token lama | Belum dikerjakan |
| G25 | Partnership: kode/aktivasi dibagikan manual | 4 | Email undangan + tautan sekali pakai; no log token | Belum dikerjakan |
| G26 | Reversal/akrual komisi tanpa notifikasi | 4 | Notice setelah ledger commit; idempotency by ledger/payout ID | Belum dikerjakan |
| G27 | Payout tanpa notifikasi ke agent | 4 | Notice setelah `markPayoutPaid` + `transferRef` tersimpan | Belum dikerjakan |
| G28 | Nomor tujuan hilang → hilang diam-diam | 2, 3 | `SUPPRESSED` + alasan tercatat | Belum dikerjakan |
| G29 | Ringkasan admin tak membedakan evidence tier | 3 | Dashboard tier + reconcile tool | Belum dikerjakan |
| G30 | Tidak ada prosedur stop-send / safe replay | 6 | Runbook operasional + kill switch + replay tenant-scoped | Belum dikerjakan |

## 8. Definition of Done

Pekerjaan dianggap tuntas hanya setelah seluruh gates di atas lolos dan bukti disimpan:

- Matrix business event lengkap dengan recipient, plan eligibility, channel, cadence, copy, required variables, dedupe, fallback, retention, owner.
- Kode lama yang bermasalah telah diperbaiki atau dihapus; semua user-facing copy sinkron.
- Migration expand/backfill/switch/contract tervalidasi; tak ada fosil key/config/code tanpa owner.
- Regression test meliputi tenant, pembayaran, reminder manual/otomatis, dunning, WA callback, partner, booking, push/in-app, retry dan duplikasi.
- E2E menelusuri event dari sumber sampai status provider/ACK yang tersedia, termasuk UI admin.
- Cron/systemd timers aktif dan tiap subtask terobservasi; alert memicu saat job/dispatch gagal atau antrean stale.
- Live smoke-test hanya ke recipient allowlist dan bukti dibatasi pada yang terukur; tidak menyamakan send dengan read.
- Dokumen gap analysis, SSOT, runbook deployment/incident dan changelog diperbarui.
- Release dibuktikan dengan commit SHA, test totals, migration result, release SHA, timer/journal, dan status queue sebelum/sesudah.

## 8. Batas rencana ini

Ini adalah rencana kerja, bukan klaim implementasi. Belum ada migration, feature flag, sender baru, template admin, perubahan paket, pengiriman partner, retry replay, maupun deployment yang dilakukan. Jangan mulai Fase 1–6 sebelum Fase 0 mencatat live data dan kebijakan yang belum diputuskan.
