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
| Mitra | agent/reseller | — | — (belum ada outbound notifikasi) |

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
2. Bila yakin belum sampai → **Kirim Ulang** (dedupeKey tetap menjaga tak ada
   duplikat).
3. Bila tidak yakin → biarkan; biarkan tercatat sebagai `UNKNOWN` untuk
   keperluan audit.

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
- Template `subscription_activated`, `payment_failed`, `payment_expired`, dan
  `booking_inapp` **tidak bisa dikirim manual** — isinya mengikat event
  tertentu.

Copy pesan **tenant ke pelanggan** (pengingat servis, tagihan) dikelola tenant
sendiri di halaman **Pengingat**; template per-tenant, bukan global.

---

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
yang dihapus hanya `BillingPolicy.trialDays` (fosil, nol consumer) — nilainya
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

## 8. Yang BELUM ada (jangan diasumsikan ada)

- **Belum ada outbound notifikasi ke agent/reseller.** Jangan menulis ke tabel
  notifikasi mitra dengan asumsi.
- **Belum ada push notification** sebagai fallback; kanal aktif: WA, email,
  in-app.
- **Belum ada alert otomatis** (email/Telegram) saat cron gagal — pemantauannya
  manual lewat `journalctl` dan Admin → Notifikasi.
- **Copy landing yang live** masih berisi kalimat lama ("semua otomatis").
  Perbarui lewat Admin → Landing, bukan lewat kode.
