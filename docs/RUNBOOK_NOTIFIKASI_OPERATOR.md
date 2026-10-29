# Runbook Operasional — Sistem Notifikasi Aircon

> Dokumen kerja operator (platform admin). Berisi prosedur yang sudah **dibuktikan
> jalan di produksi**, dengan cara verifikasi tiap langkah. Ikuti urutan；Jika ragu,
> lebih baik menahan pengiriman daripada mengirim pesan salah.

**Dasar sistem (arsitektur ringkas)**

| Jalur | Pengirim → Penerima | Antrean | Sakelar |
|---|---|---|---|
| Platform → Owner | Aircon → owner tenant (tagihan, WA, email) | `PlatformNotification` | `InfraConfig.notifySendEnabled` |
| Tenant → Pelanggan | sesi WA tenant → pelanggan (pengingat, tagihan, undangan) | `MessageLog` (channel WA, OUTBOUND) | `InfraConfig.waSendEnabled` |
| Tenant internal | Aircon → in-app tenant (booking baru) | `TenantNotification` | — |
| Mitra | Aircon → agent/reseller | `PlatformNotification` + `PartnerNotification` | Email queue + in-app; WA ditahan sampai consent (F4 LIVE; E2E bisnis penuh masih pending) |

**Prinsip yang tak boleh dilanggar**

1. Sakelar kill switch **menahan**, bukan menghapus. Antrean tetap `QUEUED`; pesan
   dikirim otomatis setelah sakelar dinyalakan. Jangan pernah mengedit status
   antrean secara manual sebagai "perbaikan".
2. `UNKNOWN` = hasil kirim **tidak pasti** (proses mati saat memanggil provider).
   Jangan dikirim ulang otomatis — duplikat ke pelanggan lebih buruk daripada
   satu pesan yang ditinjau operator. Tinjau manual, lalu pakai tombol **Kirim
   Ulang** di Admin → Notifikasi.
3. `dedupeKey` adalah identitas **event**, bukan teks. Jangan diubah manual:
   mengubahnya membuka peluang pesan ganda ke penerima.
4. Kopikan pesan hanya lewat **Admin → Notifikasi → Template** (tersimpan ke
   `PlatformTemplate` + riwayat versi). Jangan mengubah copy di kode produksi
   tanpa migrasi.
5. Sebelum dan sesudah tindakan, catat **baseline antrean** (perintah di bawah).
   Selalu bandingkan — "tak ada perubahan" adalah hasil yang valid dan justru
   penting.

---

## 0. Baseline & verifikasi (READ-ONLY, aman)

```bash
# Di VPS
PID=$(systemctl show aircon-app -p MainPID --value)
export DATABASE_URL=$(tr '\0' '\n' < /proc/$PID/environ | grep '^DATABASE_URL=' | cut -d= -f2-)
export NODE_PATH=/opt/aircon-app/node_modules/.pnpm/pg@8.23.0/node_modules

node -e "
const {Client}=require('pg');
(async()=>{const c=new Client({connectionString:process.env.DATABASE_URL});await c.connect();
for (const [label,q] of [
 ['PlatformNotification','select status,count(*)::int n from \"PlatformNotification\" group by 1 order by 1'],
 ['MessageLog','select status,count(*)::int n from \"MessageLog\" group by 1 order by 1'],
 ['Lead','select count(*)::int n from \"Lead\"'],
 ['Template','select count(*)::int n from \"PlatformTemplate\"'],
]) { const r=await c.query(q); console.log(label, JSON.stringify(r.rows)); }
await c.end()})()"
```

Status yang healthy:

- `PlatformNotification`: `SENT` / `FAILED` (tak ada `QUEUED` menua, tak ada
  `SENDING` menggantung).
- `MessageLog`: `SENT` / `DELIVERED` / `READ_CONFIRMED` / `FAILED`.
- `QUEUED` di `MessageLog` = antrean normal (menunggu giliran flusher).

---

## 1. Insiden: pengiriman terlalu banyak / tidak sesuai

**Tindakan: matikan sakelar yang relevan.** Ini satu-satunya cara yang aman —
menghapus baris antrean menghilangkan bukti dan bisa mengirim pesan separuh jadi.

### 1a. Platform → Owner terlalu banyak (terlalu banyak pesan ke owner)

1. Admin → Notifikasi → kartu **Platform ke Owner** → **Tahan Pengiriman**.
2. Verifikasi: log server memuat `[platform-dispatch] KILL SWITCH aktif: pengiriman
   platform ditahan (antrean tetap QUEUED)`.
3. Verifikasi antrean: panggil `POST /api/cron/dunning` (butuh `CRON_SECRET` dari
   `/opt/aircon-app/.env`) — hasil `platformDispatch` harus memuat `"held":true`.

### 1b. Tenant → Pelanggan terlalu banyak (WA ke pelanggan)

1. Admin → Notifikasi → kartu **Tenant ke Pelanggan (WA)** → **Tahan Pengiriman**.
2. Verifikasi: log server memuat `[gateway-relay] KILL SWITCH WA tenant aktif: ...
   ditahan`.
3. Antrean `MessageLog` berstatus `QUEUED` **tidak berubah** — itu benar (pesan
   ditahan, bukan hilang).

### 1c. Setelah penanganan

Nyalakan kembali sakelar, lalu panggil cron `dunning` satu kali untuk memastikan
antrean mengalir normal. Bandingkan dengan baseline.

> Sakelar WA tenant **tidak** memengaruhi platform ke owner, dan sebaliknya.
> Ini disengaja: dua jalur, dua risiko berbeda, dua sakelar terpisah.

---

## 2. Insiden: satu pesan tidak sampai

### 2a. Status `FAILED`

1. Admin → Notifikasi → cari baris `FAILED` → baca kolom error.
2. Perbaiki penyebab (mis. kredensial gateway, format nomor, template rusak).
3. Klik **Kirim Ulang**. Yang terjadi: baris kembali `QUEUED`, `attempts` direset,
   `dedupeKey` **dipertahankan** (jadi gateway menolak sebagai duplikat bila
   pesan sebenarnya sudah terkirim — ini pelindung, bukan kegagalan), dan
   kejadian dicatat di `PlatformAuditLog` (aksi `PLATFORM_NOTIFICATION_REPLAY`).

### 2b. Status `UNKNOWN` (hasil tak pasti)

`UNKNOWN` = proses mati saat memanggil provider. Pesan **mungkin** sudah sampai
penerima. Karena itu pengiriman ulang **tidak** dilakukan otomatis.

1. Tentukan apakah pesan benar-benar belum sampai (cek riwayat di sisi penerima
   bila memungkinkan).
2. Jangan menganggap `dedupeKey` platform selalu menjadi idempotency key provider. Verifikasi gateway/provider outcome dan ikuti prosedur operator admin yang berlaku; bila belum yakin, jangan replay.
3. Bila masih ambiguous → biarkan `UNKNOWN`, catat keputusan/aktor/bukti, eskalasi sesuai incident process. Replay hanya dengan permission, scoped satu baris, audit log, dan approval operator yang berwenang.

### 2c. Status `QUEUED` terlalu lama (> 1 jam)

Tanda di Admin → Notifikasi: banner **Perlu tindakan operator**. Penyebab
umumnya: flusher cron tidak jalan atau sesi WA penuh.

```bash
systemctl list-timers --all --no-pager | grep aircon   # 3 timer harus aktif
journalctl -u aircon-app --since "2 hours ago" --no-pager | grep -iE 'dispatch|KILL SWITCH' | tail -50
```

---

## 3. Mengubah copy pesan

Semua copy pesan **platform** dikelola di Admin → Notifikasi → Template.

- **Simpan** → versi naik, isi lama tersimpan di riwayat versi
  (`PlatformTemplateRevision`).
- **Kembalikan ke default** → memakai default dari kode.
- **Riwayat versi → Kembalikan** → menyalin isi versi lama kembali; versi aktif
  naik lagi (nomor versi tak pernah dipakai ulang) dan copy hasil rollback
  tetap divalidasi (placeholder tak dikenal ditolak).
- Placeholder yang dikenal: `tenant`, `paket`, `nominal`, `tanggal`, `link`,
  `cta`, `app`, `nama`, `layanan`. Placeholder lain **ditolak** saat simpan.
- **Template pengingat ke pelanggan** (dunning reminder/warning + pengingat
  akun tidak aktif) juga di katalog ini — key `tenant_dunning_reminder`,
  `tenant_dunning_warning`, `tenant_inactivity_reminder1`,
  `tenant_inactivity_reminder2`. Placeholder yang boleh dipakai HANYA:
  `{{nama}}`, `{{telat}}`, `{{hari}}`, `{{sisa}}` (format dua kurung). Placeholder
  lain ditolak saat simpan; template peringatan wajib memuat `{{sisa}}`.
- Kolom copy di `BillingPolicy` **sudah dihapus** (G23) — tak ada lagi dua
  sumber kebenaran. Kalau tak ditemukan copy yangdiedit di Admin → Kebijakan,
  itu memang sudah tidak ada di sana.
- Template `subscription_activated`, `payment_failed`, `payment_expired`, dan
  `booking_inapp` **tidak bisa dikirim manual** — isinya mengikat event
  tertentu.

Copy pesan **tenant ke pelanggan** (pengingat servis, tagihan) dikelola tenant
sendiri di halaman **Pengingat**; template per-tenant, bukan global.

> Catatan (G23): pesan pengingat tunggakan/pengingat akun tidak aktif milik
> **platform** (diteruskan ke pelanggan atas nama tenant) — makanya ikut katalog
> platform, bukan template tenant.

---

## 3b. Alert bila cron dunning terlewat (F3 — berlaku setelah deploy)

Pemantau "cron tak jalan" memakai jalur yang sudah ada: timer `aircon-dunning.timer`
(01:00 WIB) memanggil `/api/cron/dunning`, dan route itu mencatat heartbeat di
`PlatformAuditLog` (`CRON_DUNNING_HEARTBEAT`, tanggal WIB). Timer reconcile yang
sudah ada pukul 03:00 WIB memeriksa heartbeat hari yang sama.

Aturan penting:
- Heartbeat berarti **cron jalan**, bukan "semua tahap sukses". Kalau satu tahap
  gagal, kegagalan itu sudah alerting sendiri per tahap; heartbeat tetap ditulis
  supaya tak muncul email kedua yang salah menyebut "cron tak jalan".
- Pemantau belum "armed" sampai pernah melihat satu heartbeat. Tanpa ini, hari
  pertama rilis (run 01:00 terjadi sebelum monitor live) muncul alert palsu.
- Dedupe harian memakai tanggal WIB, bukan UTC — WIB 03:00 = UTC 20:00 hari
  sebelumnya, jadi key UTC membuat alert hari ini menelan alert asli besok.
- Pemeriksaan sebelum 03:00 WIB tidak menandai cron hilang. Tidak ada timer/route
  baru dan tidak ada replay pesan.

Rilis pertama (`19dae418`) sempat memicu alert palsu pada 29 Okt 2026; lihat
SSOT untuk detail dan perbaikannya. Setelah perbaikan, verifikasi lewat unit
test dan pemeriksaan read-only — jangan pernah sengaja memicu alert/email
"cron tak jalan" di produksi sekadar untuk mengetes.

## 4. Jadwal & zona waktu

- Tiga timer aktif (dunning 01:00, reminder 02:00, reconcile 03:00 WIB).
- Perhitungan "hari telat" memakai **hari kalender zona tenant** (`Tenant.timezone`),
  bukan durasi 24 jam. Tenant non-UTC tidak lagi bergeser satu hari.
- Pengingat owner yang telat dikirim **per milestone** sesuai
  `BillingPolicy.dunningReminderDays` (live: `0,3,7,14,30`), **bukan** setiap
  hari.

---

## 5. Rollback rilis

Deploy memakai symlink atomic (`/opt/aircon-app/current` → `releases/<sha>`).
Rollback:

```bash
ls -1t /opt/aircon-app/releases | head -5     # pilih SHA sebelumnya
sudo ln -sfn /opt/aircon-app/releases/<SHA-SEBELUMNYA> /opt/aircon-app/current
sudo systemctl restart aircon-app
```

Migrasi DB bersifat additive (tabel baru / kolom baru dengan default). Kolom
yang dihapus: `BillingPolicy.trialDays` (fosil, nol consumer) dan 4 kolom copy
pesan `BillingPolicy` (G23 — digantikan katalog `PlatformTemplate`) — nilainya
tersimpan di backup logis.

Backup logis ada di `/opt/aircon-app/backups/pre-*/` (JSON per tabel +
manifest + checksum).

---

## 6. Checksum dan data bulanan

Setiap migration wajib preceded backup logis + verifikasi pasca:

```bash
# setelah migrasi
node -e "…"   # bandingkan jumlah baris per tabel vs manifest backup
```

Kriteria lulus: **semua tabel lama baris-identik**; hanya `_prisma_migrations`
bertambah 1 dan tabel/kolom baru kosong (atau berisi nilai default yang
dinyatakan).

---

## 7. Aturan wajib: bersihkan setiap data testing

Setiap uji di produksi (runtime test, replay, kill-switch drill, uji lifecycle
mitra) **WAJIB** meninggalkan nol jejak di DB:

1. Tulis baris uji hanya ke domain `@uji.local` atau nomor `62899000xxx`
   (bukan kontak asli). Beri prefix `uji-` di `dedupeKey`/body agar bisa
   ditemukan.
2. Setelah bukti terekam, hapus baris uji **dengan snapshot** dulu
   (`SELECT *` disimpan ke `/opt/aircon-app/backups/`) sebelum `DELETE`.
3. Catat penghapusan di `PlatformAuditLog` (apa yang dihapus, mengapa, berapa
   banyak, path snapshot).
4. Verifikasi pasca: query baseline (§0) harus persis sama seperti sebelum uji.
5. JANGAN menghapus baris yang bukan milik uji sendiri — cek dulu pemiliknya
   (tenant/agen nyata). Data bisnis tidak boleh terkena dampak pembersihan.

Contoh penerapan: drill kill-switch + uji notifikasi mitra 2026-10-28 —
2 baris uji notif + fosil uji pra-eksisten "PT Clawback" dihapus, agen bisnis
"Wisnu Candra" + ledger komisi tetap utuh; jejak: `PlatformAuditLog`
`CLEANUP_TEST_DATA_F4` + `backups/cleanup-test-f4-snapshot-20261028.json`.

---

## 7b. Alert otomatis saat job gagal (F3/G21/G30)

Kegagalan cron TIDAK lagi hanya terlihat di journal. Saat ada kegagalan:

- **Jejak pasti** ditulis ke `PlatformAuditLog` (aksi `JOB_FAILURE_ALERT`,
  target `job-failure:<job>:<tahap>:<YYYY-MM-DD>`). Jejak ini SEKARANG TAMPIL
  di Admin → Notifikasi → panel **"Jejak Alert Cron"** (baca-saja).
- **Email** dikirim ke seluruh admin platform aktif (SMTP yang sudah dipakai
  notifikasi platform). Pada audit 29 Okt SMTP env terkonfigurasi dan 2 admin aktif; pengiriman email alert nyata belum diuji. Bila konfigurasi tidak tersedia, hanya jejak audit yang dipastikan.
- **Anti-spam**: satu email per (job, tahap, hari) — cron harian yang gagal
  berkali-kali tak mengirim email tiap jam. Penanda "email sudah terkirim"
  (`JOB_FAILURE_ALERT_EMAIL_DELIVERED`, target
  `job-failure-email-delivered:<job>:<tahap>:<YYYY-MM-DD>`) **terpisah** dari
  baris jejak kegagalan: bila SMTP gagal sesaat di percobaan pertama, email
  dicoba lagi pada percobaan berikutnya di hari yang sama (sebelum perbaikan ini
  email alert bisa hilang sampai ganti hari).
- Panel "Jejak Alert Cron" membedakan dua keadaan: "Email terkirim" vs
  "Jejak tersimpan — email belum terkonfirmasi". Yang kedua artinya operator
  wajib menunggu/memicu ulang; jangan dianggap sudah diberi tahu.
- Alert TIDAK mengubah status/respon job (cron tetap balas 500 agar journal
  menandai exit non-zero), dan kegagalannya sendiri tak menjatuhkan job.

Job yang diawasi: `dunning` (per tahap: dunning/purge/inactivity/dispatch/
platformNotify/platformDispatch), `reminders`, `reconcile`, dan `ipaymu-webhook`
(callback pembayaran — uang masuk tapi langganan tak diproses).

Cara cepat melihat jejak alert (SQL — untuk investigasi mendalam):

```sql
select "target", metadata->>'error' as error, "createdAt"
from "PlatformAuditLog"
where action = 'JOB_FAILURE_ALERT'
order by "createdAt" desc limit 20;
```

Cara cepat melihat jejak alert (UI): **Admin → Notifikasi → "Jejak Alert
Cron"**. Panel ini menampilkan 20 alert terakhir (kegagalan job + antrean
stale) beserta status email-nya, tanpa perlu akses database.

## 8. Yang BELUM ada (jangan diasumsikan ada)

- Partner outbound email/in-app ada dan live (F4); jangan menganggap WA mitra aktif—tetap ditahan sampai consent dan nomor terverifikasi. Lifecycle E2E masih perlu bukti mitra eligible.
- Push notification untuk assignment tersedia; fallback dan evidence status harus mengikuti implementasi `PushSubscription`. G14 fallback saat pengiriman utama gagal permanen sudah diterapkan; jangan menyamakan push yang dicoba dengan diterima/dibaca.
- Alert otomatis saat cron/job gagal **SUDAH ada** (email ke admin platform
  + jejak `PlatformAuditLog`) — lihat §7b. Jejak alert kini tampil di
  Admin → Notifikasi (panel "Jejak Alert Cron"). Yang belum ada: alert ke
  Telegram (tanpa persetujuan/credential) dan notifikasi dalam aplikasi khusus
  operator di luar panel Admin.
- Copy landing telah dikoreksi live 2026-10-28 (lihat tracker F1/G15). Jangan kembalikan klaim lama “semua otomatis”; Basic = manual, paket berbayar otomatis hanya setelah WA tersambung.
