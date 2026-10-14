# RENCANA PERSIAPAN — Web Push Notifikasi Penugasan Teknisi/Kernet (Aircon)

**Status: DESIGN COMPLETE — menunggu arah eksekusi. Nol kode ditulis untuk fitur ini.**
Tanggal: 2026-10-14 · Repo: aircon · Sumber: audit kode live 2026-10-14

---

## §1. Masalah (dari laporan pemilik)

Admin tenant menugaskan 1 teknisi/kernet ke 1 pekerjaan → data masuk ke aplikasi
teknisi (/t) → **teknisi TIDAK TAHU ada tugas**. Tidak ada notifikasi yang muncul
atau berbunyi di HP mereka.

**Bukti dari kode (audit, bukan dugaan):**
- `src/app/t/layout.tsx` → **nol** bell, nol polling, nol Notification API
- Penugasan dibuat di 2 titik: `assignment-service.ts:133` (assignJob, deleteMany+
  createMany) dan `job-management-service.ts:105` (createJob) → **nol notifikasi**
- `TenantNotification.create` hanya dipanggil dari `createTenantBookingNotification`
  (booking online) — TIDAK dari penugasan
- Panel owner punya `TenantNotificationBell` (polling 15 dtk + Web Audio + browser
  Notification), tapi itu **in-app only** dan hanya untuk booking, bukan tugas
- Tabel `TenantNotification` = punya owner; **TIDAK ADA tabel notifikasi teknisi**
- `public/manifest.json` ada (PWA standalone) tapi **TIDAK ADA service worker** —
  syarat wajib Web Push

---

## §2. Keputusan desain (dari pemilik, 2026-10-14)

**OPSI B — Web Push PWA** (bukan in-app bell, bukan WhatsApp).
Alasan pemilik tersirat: notifikasi harus muncul & berbunyi **di HP teknisi**
bahkan saat aplikasi tidak dibuka. Opsi C (WA gateway) tidak dipilih.

**KONTRAINTS (dari rencana A1–A3 guard plan yang sudah live):**
- Plan gate A1 mengunci **sesi tenant** (init/pair/status). Web Push TIDAK lewat
  gateway → **tidak terpengaruh guard** — jalur ini sah untuk semua plan.
- Gateway tidak disentuh (kontrak REST & callback tetap).

---

## §3. Fakta teknis TERVERIFIKASI (syarat keberhasilan)

```
BROWSER TARGET   : HP teknisi — Chrome/Android (push terbaik), Safari/iOS
                   (terbatas: hanya saat "Add to Home Screen" di iOS 16.4+)
PROTOCOL         : Web Push (VAPID) via push.googleapis.com — HTTP 404 di root
                   = TERJANGKAU dari VPS Aircon (sudah diuji 2026-10-14)
AUTH /t          : cookie TECH_COOKIE (tech-crypto), hanya userId —
                   tenantId/role dari DB via getServerContext() — SUDAH ADA
Pola cron        : systemd timer (aircon-reminders 02:00 dst) + route dengan
                   CRON_SECRET timing-safe — SUDAH ADA, tinggal ikuti
Prisma migration : prisma/migrations/ (folder per-waktu) + prisma generate
                   dalam "build" — JALUR SUDAH MAPAN
next.config      : output standalone; middleware.ts ada (route guard kasar)
Deps sekarang    : web-push, @types/web-push, serwist, next-pwa → SEMUA TIDAK ADA
                   (belum ditambahkan — ini persiapan)
HTTPS            : app.airconet.id 200 (syarat service worker terpenuhi)
VAPID            : BELUM dibuat (butuh sekali generate keypair utk environment)
```

---

## §4. Komponen target (arsitektur)

```
A. DATA
   PushSubscription baru (Prisma):
     id, tenantId, userId (→ User), technicianId? (→ Technician, nullable utk
     owner/admin yang juga pakai bell), endpoint (unique), keys{p256dh,auth},
     userAgent?, createdAt, lastSeenAt, revokedAt?
   + migration via prisma/migrate (jalur yang sudah ada)

B. SERVER (jalur yang sudah ada, tanpa modul baru)
   - POST subscribe  : server action /t (tech-session sudah ada)
   - POST unsubscribe: saat logout / deteksi 410 Gone saat kirim gagal
   - kirimPush()     : wrapper web-push (VAPID dari env: PUSH_VAPID_PUBLIC_KEY,
     PUSH_VAPID_PRIVATE_KEY, PUSH_SUBJECT=mailto:...)
   - pemanggil: assignment-service (assignJob) + job-management (createJob)
     → INSERT notifikasi + kirim push best-effort (aman-gagal, jangan blokir)
   - cron route baru /api/cron/push-retry: tarik subscriptions gagal,
     ikuti pola CRON_SECRET + systemd timer baru

C. CLIENT (/t)
   - Service worker /public/sw.js (register di layout /t)
   - "Aktifkan notifikasi" button (Notification.requestPermission +
     pushManager.subscribe) — pola SAMA dengan TenantNotificationBell
   - Handler push di sw.js: notificationclick → buka /t/pekerjaan/[id]
   - Badge counter sederhana (jika mau — opsional fase lanjut)

D. PENGIRIM PUSAT
   - notifyTechnicians(tenantId, jobId, {type:"ASSIGNED"}) dipanggil dari
     dua titik assignment yang sudah ada — jangan duplikasi logika
```

---

## §5. Risiko & mitigasi (persiapan agar mulus)

```
1. iOS Safari: push hanya jalan di standalone (Add to Home Screen).
   Mitigasi: dokumentasikan ke tenant; Chrome Android = target utama
   (teknisi lapangan mayoritas Android — asumsi perlu dikonfirmasi ke pemilik).

2. "Notifications not granted" (izin ditolak) → fitur mati senyap.
   Mitigasi: UI jujur (badge "izin notifikasi belum aktif" + tombol aktifkan),
   plus fallback: tampilan tugas tetap ada saat /t dibuka (tetap in-app).

3. Subscription basi (endpoint 410 Gone) → kirim gagal berulang.
   Mitigasi: hapus subscription saat 410; lastSeenAt utk prune >90 hari.

4. Duplikasi notifikasi (assignJob deleteMany+createMany = replace all).
   Mitigasi: dedupeKey unik per (jobId, personId, type) — pola dedupeKey
   SUDAH ADA di TenantNotification & PlatformNotification.

5. Plan gate (A1): Web Push tidak lewat gateway → TIDAK terkunci.
   Tapi pastikan notifyTechnicians tidak memanggil gatewayInitSession.

6. Keamanan: endpoint subscription berisi data perangkat → wajib scoped
   (tenantId+userId dari server context, JANGAN dari body klien).

7. Biaya & ukuran: web-push = lib kecil; sw.js statis; nol biaya bulanan
   (FCM gratis utk Web Push).
```

---

## §6. Urutan implementasi (gerbang — RED→GREEN tiap tahap)

```
G-A1  Deps + VAPID + migration PushSubscription      (RED: migration test)
G-A2  kirimPush() wrapper + unit test                (RED→GREEN, mock web-push)
G-A3  subscribe/unsubscribe server action + test     (RED: butuh auth tech-session)
G-A4  service worker + tombol izin di /t             (RED: nol modul render; test murni)
G-A5  notifyTechnicians dari 2 titik assignment      (RED: assignJob → push terpanggil)
G-A6  VAPID di VPS + retry inline 1× (TANPA cron/timer — direvisi, lihat G-A6)
G-A7  E2E manual di HP Android asli (BUKTI wajib):
       assign → push muncul di layar HP → bunyi → klik → buka tugas
G-A8  Deploy exact-SHA + verifikasi live + update dokumen
```

**Definisi SELESAI (jujur):**
- Bukan "test lulus" — tapi **G-A7: notifikasi benar-benar muncul di HP
  teknisi asli saat admin menugaskan**. Tanpa bukti itu, status = "prototype
  complete", bukan "production accepted".

---

## §6b. Keputusan pemilik (2026-10-14, EKSEKUSI DIAHKAN)

```
1. Mayoritas HP teknisi : ANDROID (push PWA jalan penuh)
2. Uji E2E (G-A7)       : tenant JAYA MANDIRI (akun demo) — pemilik terdaftar
                          sbg teknisi dgn nomor pribadi 081284848901
3. Standar              : world-class; WAJIB ada DOKUMEN ARSITEKTUR di repo
                          setelah selesai & valid 100%
4. Lingkup fase 1       : PENUGASAN SAJA (fita pengembangan menyusul
                          setelah fase 1 valid 100%)
5. Gaya kerja           : jalur sudah ada dikembangkan/diperbaiki; jalur baru
                          hanya bila benar-benar dibutuhkan + jalur lama TIDAK
                          boleh jadi fosil
```

### TEMUAN JALUR MIGRATION (blocker untuk G-A1 — 2026-10-14)

Fakta live `_prisma_migrations` (53 baris):
```
2 PENDING sejak 09 Sep : 20260909060000_tenant_wa_verified_phone
                         20260909070000_page_visit
status DB              : Tenant.waVerifiedPhone SUDAH ADA,
                         tabel PageVisit SUDAH ADA
file migration.sql     : SUDAH HILANG dari repo & VPS (tak ditemukan)
```
**Artinya:** 2 baris ini FOSIL — kolom sudah diterapkan lewat jalur lain, tapi
tak pernah ditandai `finished_at`. `prisma migrate deploy` utk migration baru
akan menabraknya (file tak ada). **Penanganan (jalur resmi Prisma, bukan
edit-manual DB):** `prisma migrate resolve --applied <nama>` untuk keduanya —
menandai applied tanpa menjalankan file yang sudah hilang. Dilakukan SEBELUM
apply migration PushSubscription. (Tidak mengubah data — hanya baris status.)

**Catatan skill `aircon-live-deploy`:** `deploy-vps.sh` TIDAK menjalankan
migration (hanya `prisma generate`); "Batasan: skill ini tidak melakukan
migrasi database — pekerjaan terpisah yang diminta & diverifikasi". Jadi apply
migration = langkah terpisah, dijalankan & dibuktikan tersendiri sebelum deploy
kode yang membutuhkan tabel (pola expand: tabel dulu → kode kemudian).

## §7. Yang BELUM diketahui (butuh keputusan/fakta sebelum G-A1)

1. **HP teknisi** — mayoritas Android/iOS? (menentukan prioritas + ekspektasi iOS)
2. **Apakah PEMILIK menguji G-A7 sendiri** atau menyediakan HP teknisi untuk uji?
3. VAPID keypair → di-generate sekali, disimpan di .env VPS (bukan di repo).
4. Mau badge counter in-app /t juga, atau push saja dulu?
5. Apakah kirim juga untuk event selain penugasan (jadwal berubah, pekerjaan
   dibatalkan)? — lingkup awal saya sarankan: **penugasan saja** (fokus masalah).

---

## §9. PROGRESS EKSEKUSI (diperbarui terus — sumber kebenaran antar-sesi)

> Aturan pemilik: SEMUA temuan/progress dicatat di sini SEBELUM sesi berakhir.
> Status per gerbang: SELESAI (tervalidasi) / BERJALAN / BELUM.

### G-A1 — Skema PushSubscription + deps + VAPID + migration ← **SELESAI & TERVERIFIKASI**

```
commit 8480c05 (push OK)
deps   : web-push@3.6.7 + @types/web-push@3.6.4 (pnpm — jalur mapan)
skema  : model PushSubscription (pola TenantNotification) — id, tenantId, userId,
         deviceId, endpoint, p256dh, auth, userAgent, lastSentAt, revokedAt,
         createdAt, updatedAt; unique (tenantId,userId,deviceId) + unique(endpoint);
         FK cascade Tenant & User; back-relation Tenant+User ditambahkan
migrat.: prisma/migrations/20261014020000_push_subscription/migration.sql
         — SQL diverifikasi IDENTIK dgn `prisma migrate diff --from-empty`
         (kolom 12, 3 index, 2 FK persis)
purge  : pushSubscription.deleteMany ikut purgeTenantData (ditemukan test
         anti-fosil purge-completeness — jalur purge yang sudah ada)
```

**Temuan migration (FOSIL — sudah ditangani):** 2 migration pending sejak
09 Sep (`20260909060000_tenant_wa_verified_phone`, `20260909070000_page_visit`)
— kolom sudah ada di DB tapi baris tak pernah ditandai applied; file ada di
repo lokal (yang hilang hanya dari artefak VPS). **Ditangani via jalur resmi
Prisma:** `prisma migrate resolve --applied` (idempoten; gagal ulang = P3008
"already applied" = keadaan diinginkan). Status akhir: **0 pending**.

**Migration PushSubscription applied ke DB live** (`prisma migrate deploy`,
jalur terpisah dari deploy-vps.sh sesuai skill aircon-live-deploy):
```
Applying migration 20261014020000_push_subscription — SUCCESS
Database schema up to date; kolom 12 + 4 index terverifikasi di DB live
```

### G-A2 — push-notification-service (upsert/revoke/send/notify) ← **SELESAI & TERVERIFIKASI**

```
commit ea6d7af
file   : src/lib/services/push-notification-service.ts
fungsi : upsertPushSubscription (idempotent per-device, subscribe ulang = revokeAt null)
         revokePushSubscription (tandai revokedAt — JEJAK AUDIT, bukan delete)
         sendPushToUser (aman-gagal per device; TTL 24j urgency high;
                         404/410 → revoke endpoint basi; 5xx → failed, sub aktif)
         notifyAssignees (G-A5 — dipanggil dari 2 titik assignment)
auth   : tryGetServerContext() = SATU-SATUNYA sumber tenantId/userId
VAPID  : kosong → skipped=1 jujur, tanpa crash (rollout additive pola planConfig)
test   : tests/push-notification-service.test.ts 9/9; RED→GREEN tervalidasi ketat
         (balik perilaku 404/410 sementara → 1 gagal; kembali → 9 lulus)
```

### G-A3 — Server action push di /t ← **SELESAI & TERVERIFIKASI**

```
commit 889a1ee
file   : src/app/t/actions.ts (+3 action: techPushVapidKey / techEnablePush /
         techDisablePush) — jalur action /t yang sudah ada
kontrak: getServerContext() MELEMPAR (bukan null) — dead-code null-check
         dihapus sesuai kontrak asli; test diuji via mockRejectedValue
regresi: tests/tech-upload-photo.test.ts (lama) ikut gagal impor server-only —
         diperbaiki dgn 2 baris vi.mock (pola repo)
test   : tests/tech-push-actions.test.ts 6/6
```

### G-A4 — Service worker + tombol izin di /t ← **SELESAI & TERVERIFIKASI**

```
commit 23e9a27
file   : public/sw.js (handler push + notificationclick; nol dependensi; scope /)
         src/lib/push-client.ts (helper MURNI — urlBase64ToUint8Array, deviceId,
         subscriptionToInput, pushStatusLabel) — dipisah dr React utk bisa diuji
         src/app/t/push-permission.tsx (tombol izin JUJUR — pengguna tekan sekali,
         bukan popup otomatis; status: aktif/izin-diblokir/tidak-dukin/disiapkan)
         src/app/t/page.tsx (+ <PushPermission /> di header)
perilaku: effect mengikuti pola TenantNotificationBell (void load() lokal) —
          lolos react-hooks/set-state-in-effect
test   : tests/push-client.test.ts 12/12
suite  : 79 files / 721 tests · tsc=0 · eslint=0 · build=0
```

### G-A5 — Notifikasi dari 2 titik assignment ← **SELESAI & TERVERIFIKASI (commit adce53b)**

```
file   : push-notification-service.ts → fungsi notifyAssignees (TERPUSAT, 1 jalur)
         assignment-service.ts:158 → 1 baris void notifyAssignees(...) setelah trx
         job-management-service.ts → createJob diubah dari
           `return prisma.$transaction(...)` menjadi
           `const job = await prisma.$transaction(...)` + push SETELAH commit
           (side-effect eksternal TIDAK boleh di dalam transaksi DB).
           Pola DIDUKUNG: actionCreateJob sudah melakukan write terpisah
           (konversi pengingat + revalidatePath) setelah createJob kembali.
payload: judul "Tugas baru" + nama pelanggan + deep-link /t/pekerjaan/:id
kontrak: aman-gagal TOTAL — push tak pernah membatalkan penugasan (try/catch
         di notifyAssignees + void fire-and-forget di kedua pemanggil)
test   : tests/assignment-push-notify.test.ts 6/6; RED→GREEN tervalidasi ketat
         (hapus wiring sementara via trap EXIT → 2 gagal utk titik1+titik2;
          file dipulihkan → 6 lulus) — membuktikan test benar-benar menguji wiring
         (bukan tests-after yang lemah)
regresi: 6 suite transitif (assignment.test, assignment-action,
         job-management-create, job-notes-update, job-work-auth,
         reminder-convert) di-mock push service (pola tech-upload-photo)
suite  : 80 files / 727 tests · tsc=0 · eslint=0
jalur  : TIDAK membuat jalur assignment baru — hanya menambah pemanggilan pada
         assignJob & createJob yang sudah ada
```

### G-A6 — VAPID di VPS + retry inline ← **SELESAI (keputusan desain: TANPA jalur cron)**

```
VAPID : generate di VPS via crypto Node murni (RFC 8291: pub=87char priv=43char,
        verifikasi key-pair cocok) → ditulis langsung ke /opt/aircon-app/.env
        (nilai TIDAK pernah tercetak ke stdout/log/repo); backup .env sebelum
        tulis; idempoten (tidak di-regenerate bila sudah ada)
env   : EnvironmentFile=/opt/aircon-app/.env terverifikasi (systemctl cat) →
        var masuk ke proses saat deploy berikutnya (restart baca .env)
```

**KOREKSI RENCANA (jalur baru TIDAK diperlukan — sesuai aturan pemilik):**
Rencana awal G-A6 = cron route `/api/cron/push-retry` + systemd timer + kolom
`lastFailedAt` + migration kedua. Setelah dievaluasi, kasus yang ditutupnya
hanya **5xx FCM sesaat** (jarang; 404/410 = endpoint basi, retry pasti gagal).
Sebagai gantinya: **retry inline 1×** (delay 1 dtk) di `sendPushToUser` —
jalur YANG SUDAH ADA, nol route/timer/kolom/migration baru.

```
test   : tests/push-notification-service.test.ts 11/11 (+2 utk retry);
         RED→GREEN tervalidasi ketat (matikan retry sementara → 2 gagal;
         pulihkan → 11 lulus)
```

### Hasil E2E Android (uji nyata pemilik, HP Android, teknisi Ryan/Jaya Mandiri) + FIX

**Bukti LULUS (dari pemilik + query server):**
```
izin browser     : diizinkan teknisi Ryan (13:54 WIB)
subscription     : 1 baris live — tenant Jaya Mandiri, user Ryan Andrian,
                   revoked=null, lastSentAt tercatat (push terkirim nyata)
push masuk layar : YA (laporan pemilik)
klik → app       : YA (dibawa ke aplikasi teknisi)
```

**3 TEMUAN E2E (semua diperbaiki, deploy live `bf3b626`):**
```
1. TANPA SUARA — showNotification tanpa renotify: notifikasi ber-tag sama
   hanya menimpa, tak berbunyi.
   FIX (sw.js, handler yang sama): renotify: true + requireInteraction: true
   (tampil menonjol sampai disentuh).
2. KLIK → state basi (perlu refresh manual): notificationclick hanya focus.
   FIX: focus + postMessage {aircon:open-url} ke tab aktif; listener message
   DI PushPermission (komponen yang sudah ada) → router.push(url) +
   router.refresh(). NOL file/jalur baru; teknisi tak perlu refresh manual.
   (Belum diverifikasi ulang pasca-deploy — tunggu uji ulang pemilik.)
3. HEADER PENUH SESAK (screenshot pemilik): teks "Notifikasi tugas aktif"
   tetap tampil walau tak ada tindakan. FIX progressive disclosure: status
   aktif → cukup icon bell hijau (aria-label+title lengkap); teks panjang
   hanya saat BUTUH TINDAKAN (belum aktif).

VERIFIKASI LIVE pasca-fix: current `bf3b626`; sw.js publik berisi
renotify×2 + requireInteraction + postMessage (browser tarik versi baru);
suite 80/729 · tsc=0 · eslint=0 · build=0; deploy-vps.sh PASS.
```

**UJI ULANG YG MENUNGGU PEMILIK:** kirim penugasan lagi dari Jaya Mandiri →
cek (a) suara berbunyi, (b) sentuh notifikasi → tugas LANGSUNG tampil tanpa
refresh, (c) header ringkas (hanya icon bell hijau). Setelah 3 kriteria ini
lulus → G-A8 (dokumen arsitektur) dikerjakan berdasarkan bukti final.

### Hasil Deploy G-A7 — LIVE `38772ce` (2026-10-14 13:37 WIB)

```
deploy : scripts/deploy-vps.sh PASS (jalur tunggal AGENTS.md; DEPLOY_EXIT=0)
         build PASS · boot-test lokal PASS · upload + checksum PASS ·
         boot-test VPS PASS · switch atomic · verify live HTTPS PASS
current: /opt/aircon-app/releases/38772cea…/app · aircon-app active
VAPID  : 3 var PUSH_VAPID_ TERBACA DI PROSES RUNTIME (bukan hanya .env file)
sw.js  : https://app.airconet.id/sw.js → HTTP 200, content-type
         application/javascript (siap dipakai service worker browser)
bundle : notifyAssignees + sendNotification ada di server chunks
         ([root-of-the-server]__0erxppz._.js) — jalur server terpakai
tabel  : PushSubscription 12 kolom live, 0 baris (belum ada subscribe)
test   : 80 files / 729 tests · tsc=0 · eslint=0 · build=0
```

### G-A9 — Respons E2E pemilik (2026-10-14, keputusan pemilik)

**Temuan pemilik + status penyelesaian:**

```
1. "Tidak ada fasilitas edit teknisi di daftar pekerjaan"
   → BUKAN BUG utk ASSIGNED: halaman daftar (AgendaBoard) memang tanpa tombol
     edit (desain: klik card → halaman DETAIL → "Tugaskan Tim"). Terbukti dari
     kode (agenda-board.tsx:418 Link ke /app/pekerjaan/[id]) + screenshot
     pemilik (detail Cafe Kopi Kita = ASSIGNED → tombol Tugaskan Tim ADA).
   → BUG NYATA utk ACCEPTED: job Effi (Ryan sudah tekan "Terima") status
     ACCEPTED → panel edit disembunyikan, admin tak bisa koreksi sebelum
     teknisi berangkat. PERLUASAN: ASSIGNABLE_STATUSES + ASSIGNABLE kini
     {DRAFT, ASSIGNED, ACCEPTED}; EN_ROUTE+ tetap TERKUNCI (teknisi sudah
     jalan — batas yang dipertahankan). Test: tests/assignable-accepted.test.ts
     (5) — ACCEPTED lolos; EN_ROUTE/IN_PROGRESS/COMPLETED/CANCELLED tetap tolak.

2. "Push harus ada status & tombol kirim ulang (tanpa refresh)"
   → notifyAssignees kini MENGEMBALIKAN PushDeliveryReport (perPerson + nama,
     totalSent/totalFailed) — sebelumnya void senyap. Aman-gagal TETAP: error
     internal → report kosong, tak pernah melempar.
   → assignJob meneruskan report; actionAssignTeam menampilkannya di UI.
   → owner-actions.tsx (jalur msg yang sudah ada):
       • toast sukses auto-dismiss 5 dtk (tanpa refresh — permintaan pemilik)
       • push gagal → panel amber "Notifikasi ke X gagal" + tombol KIRIM ULANG
         (actionResendAssignPush — jalur service notifyAssignees yang sama,
         nol modul baru) → hasil resend diperiksa lagi; masih gagal → tombol
         tetap tersedia.
   Test: tests/notify-assignees-report.test.ts (6/6 RED→GREEN).

3. Suara + klik → segarkan state: SUDAH diperbaiki & LIVE (bf3b626,
   renotify + postMessage router.refresh) — menunggu uji ulang pemilik.
```

### Hasil Deploy G-A9 — LIVE `3192a1a` (2026-10-14 16:36 WIB)

```
deploy : scripts/deploy-vps.sh PASS (DEPLOY_EXIT=0; jalur tunggal AGENTS.md)
current: /opt/aircon-app/releases/3192a1a5…/app · aircon-app active
HTTPS  : / → 200 · /login → 200
penanda: actionResendAssignPush ADA · "Kirim Ulang" ADA di bundle owner-actions
         · ACCEPTED ada di server bundle · sw.js renotify 2 · VAPID 3 var aktif
log    : 16:36:53 "Failed with result exit-code" = proses lama saat restart
         (momen switch — verifier PASS + 2 endpoint 200 menandakan boot sehat);
         16:37:10 "Server Reference ID…" = tab browser PEMILIK yang masih
         memegang build lama saat deploy (pola Next.js; bukan crash produksi)
```

**Catatan pola yang terulang (pemilik perlu tahu):** setiap deploy mengubah ID
server action → tab lama yang belum di-refresh akan menolak aksi (tombol
senyap). Mitigasi sementara: refresh sekali setelah deploy. (Deteksi tab basi
+ pesan jujur ke pengguna = kandidat perbaikan lanjutan, butuh arahan.)

### Hasil E2E FINAL (konfirmasi pemilik, 2026-10-14 pasca-deploy 3192a1a) ← **PRODUCTION ACCEPTED**

```
Pemilik (HP Android) mengonfirmasi SEMUA kriteria lulus:
  [x] edit tim utk job ACCEPTED bisa (guard ACCEPTED bekerja)
  [x] penugasan ke Ibu Hesti → notifikasi DITERIMA
  [x] ADA BUNYI (renotify bekerja — temuan E2E #1 tertutup)
  [x] sentuh notifikasi → aplikasi teknisi terbuka LANGSUNG di tugas tsb,
      tanpa refresh (postMessage + router.refresh bekerja — temuan #2 tertutup)
  [x] teknisi mengubah status → "sudah sampai di tempat" (alur lanjut utuh)
```

### G-A8 — Dokumen arsitektur ← **SELESAI** (`docs/Web_Push_Arsitektur.md`)

```
Isi: ruang lingkup FASE 1 (+ eksplisit keluar lingkup), alur end-to-end
     (admin → service → FCM → sw → notificationclick → router), 10 keputusan
     arsitektur + alasannya, skema DB, kontrak payload, perilaku UI admin
     (toast/Kirim Ulang), operasional (perintah cek runtime), pola tab-basi
     pasca-deploy, tabel 6 test suite, E2E manual wajib utk perubahan push,
     daftar pengembangan lanjutan (butuh arahan).
Ditulis dari BUKTI E2E final (bukan dari desain) — sesuai permintaan pemilik.
```

### G-A9c — Label tombol "Atur Jadwal & Tim" ← **SELESAI** (keputusan pemilik)

```
Perubahan: tombol "Tugaskan Tim" → "Atur Jadwal & Tim" (owner-actions.tsx)
           — lebih informatif karena panel berisi tambah/ubah tim DAN jadwal.
           Konsisten dgn anchor link page.tsx:184 ("Atur jadwal & tim →")
           dan judul kartu "Jadwal & Tim".
Tidak disentuh: label "Simpan Penugasan" (tombol simpan, memang sudah jelas).
Komentar terkait di page.tsx/cancel-job.tsx + judul test disesuaikan agar
tidak menyesatkan deep-dive berikutnya.
Test: 82 files / 740 tests · tsc=0 · eslint=0 · build=0.
```

### TINDAK LANJUT SESI BERIKUTNYA (urutan, jangan diubah)

```
1. G-A7  Deploy exact-SHA (bash scripts/deploy-vps.sh) → **SELESAI** (live 38772ce;
         detail bukti di Hasil Deploy G-A7 di bawah).
       E2E MANUAL di HP Android pemilik (tenant Jaya Mandiri, nomor
         081284848901) → **MENUNGGU PEMILIK**: perlu login /t lalu tekan
         "Aktifkan notifikasi" di HP (izin browser + subscribe). Setelah itu
         admin harus membuat assignment baru utk membuktikan push MUNCUL +
         bunyi + klik buka tugas. Saat ini `PushSubscription` DB = 0 (belum ada
         perangkat yang subscribe); layanan kode/live belum bisa diuji E2E.
       **DEFINISI:** kode sudah production live (deploy PASS); feature end-to-end
       = BELUM production-accepted sampai bukti push nyata di HP (G-A7 E2E).
2. G-A8  Dokumen arsitektur web-push di docs/ (permintaan pemilik:
         "setelah selesai dan valid 100% harus ada dokumen arsitektur di repo")
         + update ledger + rencana ini.
```

### Catatan sesi (jangan dihapus — konteks tahan-kompaksi)

```
HEAD aircon (ter-push)      : 38772ce (G-A6 + G-A7 deploy live 13:37 WIB) ·
                              tree bersih sebelum dokumen ini
DB live                     : PushSubscription applied; 0 migration pending;
                              2 fosil lama sudah resolve --applied;
                              PushSubscription 12 kolom, 0 baris (belum subscribe)
VAPID                       : SUDAH ada & TERBACA di proses runtime aircon-app
                              (3 var PUSH_VAPID_; nilai tak pernah tercetak)
Live                        : aircon-app active, current 38772ce, sw.js HTTP 200
Gateway live (referensi)    : b4268c4 — G7 inbound listener DIBUANG; status WA
                              utuh; TIDAK disentuh utk fitur push ini
Pola mock server-only       : 6 suite transitif sudah dimock; suite baru yg impor
                              job-management/assignment-service HARUS ikut mock
                              push-notification-service (baris vi.mock identik)
Jalur migrasi               : deploy-vps.sh TIDAK menjalankan migrate deploy;
                              migration DB = pekerjaan terpisah (skill aircon-live-deploy)
```

## §8. Yang TIDAK akan saya lakukan tanpa arahan

- Menambah deps / migration / file apa pun sebelum arah eksekusi eksplisit.
- Menyentuh gateway / kontrak callback / plan gate.
- Mengklaim "selesai" tanpa bukti G-A7 (push nyata di HP).
