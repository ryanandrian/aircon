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
G-A6  cron retry + systemd timer                     (ikuti pola reminders)
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

## §8. Yang TIDAK akan saya lakukan tanpa arahan

- Menambah deps / migration / file apa pun sebelum arah eksekusi eksplisit.
- Menyentuh gateway / kontrak callback / plan gate.
- Mengklaim "selesai" tanpa bukti G-A7 (push nyata di HP).
