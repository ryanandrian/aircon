# Web Push Notification — Arsitektur & Runbook

**Status: LIVE & production-accepted** · Repo: aircon · Terakhir diverifikasi: 2026-10-14
Release live: `3192a1a` (+ perbaikan label `Atur Jadwal & Tim`) · VPS 103.127.135.132

**Bukti E2E final (pemilik, HP Android, tenant Jaya Mandiri, teknisi Ryan):**
izin diberikan → notifikasi penugasan masuk layar → **berbunyi** → disentuh →
aplikasi teknisi terbuka **langsung di tugas yang tepat tanpa refresh** →
teknisi mengubah status sampai di tempat. Uji terakhir: penugasan ke Ibu Hesti.

---

## 1. Ruang lingkup (FASE 1 — keputusan pemilik 2026-10-14)

| Masalah | Solusi |
|---|---|
| Teknisi/kernet tidak tahu ada tugas baru (hanya bisa tahu dengan membuka aplikasi) | Push notification ke HP saat admin menugaskan |
| Status & pengulangan pengiriman tidak terlihat admin | Laporan hasil kirim per personel + tombol **Kirim Ulang** |

**Keluar ruang lingkup FASE 1** (sengaja, keputusan pemilik):
- Push utk jadwal berubah / pekerjaan dibatalkan → rencana pengembangan terpisah.
- Inbound (balasan tulisan pelanggan) → **dihapus** dari gateway (G7 2026-10-14);
  status WA (DELIVERED/READ) tetap diteruskan dan dicatat.

## 2. Alur end-to-end

```
ADMIN (App)                     SERVER (Aircon)                    TEKNISI (HP Android)
─────────────                   ───────────────                    ────────────────────
Atur Jadwal & Tim
  → actionAssignTeam
                                assignJob()
                                  ├─ transaction DB (roster+jadwal)
                                  │    jobOrder.status → ASSIGNED
                                  └─ notifyAssignees() SETELAH commit
                                       └─ sendPushToUser() per personel
                                            └─ webpush.sendNotification(FCM)
toast sukses 5 dtk /            PushSubscription per device
tombol "Kirim Ulang" (gagal)          │
                                      ▼
                                                              service worker /sw.js
                                                                → showNotification
                                                                   (renotify: bunyi)
                                                              sentuh notifikasi
                                                                → notificationclick
                                                                   focus + postMessage
                                                              PushPermission (client)
                                                                → router.push(url)
                                                                → router.refresh()
```

**Titik pemanggil (jalur yang sudah ada, tidak ada jalur baru):**
`assignment-service.assignJob` (reassign tim) dan
`job-management-service.createJob` (teknisi dari form) — masing-masing 1 baris
panggil `notifyAssignees` **setelah commit** (side-effect eksternal tidak boleh
di dalam transaksi DB).

## 3. Keputusan arsitektur & alasannya

| Keputusan | Alasan |
|---|---|
| `PushSubscription` per (tenant, user, device) | 1 orang boleh punya >1 perangkat; endpoint basi di-revoke tanpa memutus perangkat lain |
| `revokeAt` (tandai) bukan delete | jejak audit "kenapa tidak dikirim lagi" |
| tenantId/userId dari `tryGetServerContext()` | otorisasi tunggal; tidak pernah dipercaya dari klien |
| `renotify: true` | Android hanya berbunyi utk notifikasi **baru**; tag sama = ditimpa diam-diam (bug E2E #1) |
| `requireInteraction: true` | tugas lapangan tidak boleh terlewat |
| `notificationclick` → `postMessage {aircon:open-url}` → `router.push` + `router.refresh` | tab yang sudah terbuka punya **state basi**; tanpa refresh teknisi melihat daftar lama (bug E2E #2) |
| `notifyAssignees` **mengembalikan** laporan (bukan void senyap) | admin perlu tahu terkirim/gagal → toast + Kirim Ulang (permintaan pemilik) |
| retry inline 1× (delay 1 dtk) utk 5xx | menutup kasus FCM berdenyut sesaat **tanpa** cron route/timer/kolom migration baru |
| 404/410 → revoke, **tanpa** retry | endpoint mati; percobaan ulang pasti gagal |
| Aman-gagal TOTAL | push tak pernah boleh menggagalkan/menunda penugasan |
| Guard `ASSIGNABLE = {DRAFT, ASSIGNED, ACCEPTED}` | admin boleh koreksi sampai teknisi **berangkat** (`EN_ROUTE`+ terkunci); selaras dgn `CANCELLABLE` |

## 4. Skema DB

```prisma
model PushSubscription {
  id, tenantId (FK cascade Tenant), userId (FK cascade User), deviceId,
  endpoint (unique), p256dh, auth, userAgent,
  lastSentAt?, revokedAt?, createdAt, updatedAt
  @@unique([tenantId, userId, deviceId])
}
```
Migration: `prisma/migrations/20261014020000_push_subscription/migration.sql`
(additive; SQL terverifikasi identik dgn `prisma migrate diff --from-empty`).
Baris ikut `purgeTenantData` (penghapusan tenant tidak meninggalkan orphan).

**CATATAN jalur migrasi:** `scripts/deploy-vps.sh` **TIDAK** menjalankan
`migrate deploy` — migration = pekerjaan terpisah, jalankan & verifikasi sendiri.

## 5. Kontrak payload push

```jsonc
{ "title": "Tugas baru",
  "body": "Anda ditugaskan ke <nama pelanggan>.",
  "url": "/t/pekerjaan/<jobId>",     // deep-link
  "tag": "assignment:<jobId>" }      // penugasan ulang = timpa, bukan tumpuk
```
VAPID: `PUSH_VAPID_{PUBLIC,PRIVATE}_KEY` + `PUSH_VAPID_SUBJECT` di
`/opt/aircon-app/.env` (EnvironmentFile; terbaca saat restart).
**Generate SEKALI** — regenerate memutus seluruh subscription yang ada.

## 6. Perilaku UI admin (jalur `OwnerActions` yang sudah ada)

```
Simpan Penugasan
 ├─ push terkirim semua  → toast hijau "Tim ditugaskan · notifikasi terkirim ke N personel"
 │                          hilang otomatis 5 dtk (tanpa refresh)
 └─ ada yang gagal      → panel kuning "Notifikasi ke <nama> GAGAL terkirim"
                           + tombol KIRIM ULANG (actionResendAssignPush)
                           hasil dicek ulang; masih gagal → tombol tetap tersedia
```
Panel + tombol "Atur Jadwal & Tim" tampil **hanya** utk `{DRAFT, ASSIGNED,
ACCEPTED}`; `EN_ROUTE`+ disembunyikan di tampilan **dan** ditolak server
(guard di `assignment-service.ts`, bukan hanya tombol FE).

## 7. Operasional

```bash
# VPS Aircon (truerad@103.127.135.132, key ~/.ssh/airconet-app.pem)
# 1. variabel runtime terbaca?
tr "\0" "\n" < /proc/$(systemctl show aircon-app -p MainPID --value)/environ | grep -c '^PUSH_VAPID_'
# 2. jumlah subscription aktif?
SELECT count(*) FROM "PushSubscription" WHERE "revokedAt" IS NULL;
# 3. service worker terservis?
curl -sI https://app.airconet.id/sw.js   # harus HTTP 200, application/javascript
```

**Pola yang harus diketahui setiap deploy (bukan bug):** setiap deploy mengubah
ID server action; tab lama yang belum di-refresh akan menolak aksi (log:
`The Server Reference ID did not match…`). Mitigasi: refresh sekali setelah
deploy. (Deteksi tab basi + pesan jujur = kandidat perbaikan lanjutan.)

## 8. Pengujian

| Test | Menguji |
|---|---|
| `tests/push-notification-service.test.ts` (11) | upsert/revoke; 404/410 revoke; 5xx tahan-lama failed; **retry inline**; payload |
| `tests/notify-assignees-report.test.ts` (6) | laporan per personel; orang tanpa subscription = skipped (bukan gagal); aman-gagal |
| `tests/assignment-push-notify.test.ts` (6) | kedua titik assignment memanggil notify dgn argumen benar |
| `tests/assignable-accepted.test.ts` (5) | ACCEPTED boleh; EN_ROUTE/IN_PROGRESS/terminal ditolak |
| `tests/tech-push-actions.test.ts` (6) | server action /t; auth throw |
| `tests/push-client.test.ts` (12) | helper klien (base64url → Uint8Array, deviceId) |

E2E manual di HP Android **wajib** utk tiap perubahan jalur push (tombol, payload,
service worker) — unit test tidak membuktikan notifikasi sampai ke layar.

## 9. Pengembangan berikutnya (belum dikerjakan — butuh arahan)

- Push utk jadwal berubah / pembatalan pekerjaan (payload & tag terpisah).
- Deteksi tab basi pasca-deploy + pesan jujur ke pengguna.
- Ulasan iOS (butuh "Add to Home Screen"; iOS 16.4+) bila ada teknisi iPhone.
