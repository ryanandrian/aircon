# AC SERVICE GROWTH OS — RECONSIDERED TECH STACK (Efisien & Efektif)

## Keputusan arsitektur v2.1 — menggantikan PRD v1.0 §8 dan merevisi v2

**Perubahan v2 → v2.1:** IoT kembali memakai **MQTT** (bukan HTTPS-polling), via broker pihak ketiga **EMQX Serverless (free tier)**, dengan **jembatan MQTT → Supabase**. Alasan: MQTT free tier tersedia & layak produksi, memberi remote control instan + firmware "benar sejak awal" tanpa biaya dan tanpa beban RAM lokal.

**Konteks nyata:** WSL2 Ubuntu, Node 26 + pnpm siap, RAM total 6.6 GB (bottleneck utama), tanpa Docker, 1 developer + Agentic AI (claude CLI terpasang), 25 hari, modal kecil, mobile-first, WhatsApp-first, IoT 25 device pilot.

**Prinsip keputusan:** komponen yang bisa dipindah ke layanan terkelola = lebih sedikit dibangun/dijalankan/di-debug = lebih banyak waktu untuk *money loop* + hemat RAM & modal. Pengecualian dibuat bila layanan terkelola gratis itu justru memberi arsitektur yang lebih benar (kasus MQTT).

---

## 1. RINGKASAN STACK (final)

| Kebutuhan | Pilihan lama (v1) | **Pilihan final (v2.1)** | Dampak |
|---|---|---|---|
| Database | Postgres self-host | **Supabase Postgres (cloud)** | 0 RAM lokal, managed backup |
| Auth (OTP/phone) | JWT+OTP buatan sendiri | **Supabase Auth** | hemat berhari-hari kerja |
| Multi-tenant isolation | RLS manual | **Supabase RLS (native)** | isolasi benar, sedikit kode |
| Realtime progress | socket.io server | **Supabase Realtime** | hapus 1 server (hemat RAM) |
| Foto job | S3/MinIO | **Supabase Storage** | hapus 1 service |
| Queue/reminder | Redis + BullMQ | **Supabase pg_cron + tabel** | **Redis dihapus** |
| Frontend + API | Next.js self-host | **Next.js PWA di Vercel** | 0 RAM lokal utk prod |
| Logic berat/terjadwal | worker Node | **Supabase Edge Functions (Deno/TS)** | serverless, no infra |
| **IoT transport** | MQTT broker self-host | **MQTT via EMQX Serverless (free)** + jembatan ke Supabase | broker managed, 0 RAM lokal, remote instan |
| Peta/travel | OSRM self-host | **OSRM hosted / Haversine fallback** | no infra |

**Hasil:** yang berjalan di laptop Anda saat ngoding cuma **Next.js dev server + claude CLI + browser**. Semua data/infra/broker di cloud. Masalah RAM praktis hilang.

---

## 2. KENAPA EFISIEN & EFEKTIF (alasan, bukan selera)

1. **RAM 6.6 GB tidak lagi kendala.** Lokal hanya devserver; Postgres/Realtime/Storage/queue/broker semua di cloud.
2. **Tanpa Docker — sesuai permintaan.** Migrasi via `npx supabase db push` (tanpa `supabase start` yang butuh Docker).
3. **Satu bahasa, satu codebase.** Next.js fullstack + Edge Functions (TS/Deno) → Agentic AI paling produktif, tipe dibagi FE↔BE.
4. **Menghapus komponen = menghapus risiko & waktu.** Redis, S3, socket server, auth buatan sendiri → managed. MQTT broker → managed gratis (tidak dihapus, tapi tidak self-host).
5. **Modal kecil.** Supabase Free→Pro (~$25/bln), Vercel Free, EMQX Serverless Free, HiveMQ Free tersedia sbg cadangan. Biaya infra pilot mendekati nol.
6. **RLS = multi-tenant benar sejak awal.** Isolasi ditegakkan database.

---

## 3. KEPUTUSAN IoT — MQTT via EMQX Serverless (free) + jembatan ke Supabase

**Pilihan: MQTT, broker pihak ketiga gratis. Tidak self-host, tidak dibuang.**

### 3.1 Kenapa MQTT (bukan HTTPS-polling seperti draf v2)
- Free tier layak produksi tersedia → tidak ada alasan biaya untuk menghindari MQTT.
- **Remote control instan** (push cloud→device), bukan lag 10–15 dtk polling → Command→Verify terasa premium (nilai jual sewa device).
- **Firmware "benar" sejak awal** (standar industri IoT) → tidak perlu migrasi menyakitkan pasca-pilot.
- Hemat daya/kuota device (tak polling terus-menerus).
- Broker di cloud → **0 beban RAM lokal** (bottleneck Anda tetap aman).

### 3.2 Broker: EMQX Serverless (free forever)
Data terverifikasi (diambil langsung dari emqx.com):
- **1 juta session-minutes/bulan gratis**, 1 GB/bulan, 1 juta rule actions/bulan, tanpa kartu kredit, deploy ~5 detik, pay-as-you-go bila lewat kuota.
- Cadangan: **HiveMQ Cloud Free** (tier serverless gratis) bila EMQX tak cocok.

**Perhitungan kuota untuk 25 device:**
- Koneksi persisten 24/7 = 25 × 60 × 24 × 30 = 1.080.000 menit → sedikit di atas 1 juta.
- **Solusi:** device tidak perlu koneksi persisten. Connect saat kirim telemetry/terima command lalu boleh idle/disconnect terjadwal → total session-minutes jauh di bawah kuota. (Alternatif: HiveMQ free berbasis jumlah koneksi, 25 device lega.)
- Kesimpulan: **25 device pilot muat di free tier.**

### 3.3 Arsitektur jembatan MQTT → Supabase
```text
Device ──MQTT/TLS──► EMQX Serverless (broker)
                         │
                         ├─ EMQX Rule/Data Integration (webhook)  ──HTTPS──► Supabase Edge Function ──► Postgres (Telemetry/CommandLog/Alert)
                         │     (telemetry & ack diteruskan ke DB)
                         ▼
        App ──► Supabase (baca telemetry, buat command) ──► publish MQTT cmd ──► Device
                         │
                    (command dipublish via EMQX HTTP API / Edge Function → topic d/<id>/cmd)
```
- **Ingest:** device publish ke `d/<id>/telemetry` & `d/<id>/ack` → EMQX Data Integration (webhook/rule) POST ke Edge Function → tulis ke Postgres. Anomali dievaluasi di Edge Function → buat `Alert`.
- **Command:** app tulis `CommandLog(COMMAND_SENT)` → Edge Function publish ke `d/<id>/cmd` via EMQX HTTP API → device eksekusi → publish ack+evidence → jembatan update state (ACKNOWLEDGED → STATE_CONFIRMED). **Command→Verify utuh & real-time.**
- **Auth device:** per-device MQTT username/token; TLS wajib.

### 3.4 Topik & payload (selaras Build Spec Pack Part 1 §4)
```
device→broker  d/<deviceId>/telemetry  {ts,tempC,humidity,currentA,powerW,online,fw}
device→broker  d/<deviceId>/ack        {cmdId,ackAt,evidence?}
broker→device  d/<deviceId>/cmd        {cmdId,type,params}
```
(HTTPS fallback POST /iot/telemetry & /iot/ack tetap disediakan untuk device tanpa MQTT / kondisi darurat.)

---

## 4. QUEUE & SCHEDULING TANPA REDIS

- **Reminder harian (money loop):** `pg_cron` Supabase tiap hari 06:00 → fungsi membuat `RepeatReminder` untuk asset due. Tanpa Redis/worker.
- **Re-plan recompute:** dipicu transisi progress → dijalankan di API route (skala pilot ringan) atau Edge Function async. Tanpa queue eksternal.
- **Cache travel matrix:** tabel Postgres biasa. Cukup untuk pilot.

Redis dihapus dari v1.0. Tambah nanti hanya berbasis bukti throughput, bukan antisipasi.

---

## 5. PERUBAHAN TERHADAP BUILD SPEC PACK

Skema data (Part 1) **tetap berlaku** — Supabase = Postgres; Prisma untuk migrasi & tipe (atau Supabase migrations). Yang berubah:
- **Auth:** OTP/JWT buatan sendiri → **Supabase Auth**. SMS OTP = satu-satunya dependensi berbayar (kecil di skala pilot); alternatif hemat: email+password owner, PIN teknisi.
- **Realtime:** progress via **Supabase Realtime** (subscribe `JobProgressEvent`).
- **Storage:** foto via **Supabase Storage** bucket `tenant/<id>/...`.
- **IoT:** **tetap MQTT** (Part 1 §4 valid), broker = **EMQX Serverless**, ditambah **jembatan MQTT→Supabase** (§3.3). Ini menyelaraskan kembali dengan Part 1 versi asli.
- **Queue:** BullMQ/Redis → **pg_cron** (§4).

Screen spec (Part 2) & Business rules (Part 3) **tidak berubah** — agnostik infra. Threshold anomali & timeout Command→Verify (Part 3 §5) tetap; kini dieksekusi di Edge Function pada jalur ingest MQTT.

---

## 6. YANG PERLU DISIAPKAN

Lokal (saya bisa lakukan sekarang, tanpa Docker):
- [ ] `git init` repo di /home/rad/aircon
- [ ] scaffold Next.js + TypeScript + Tailwind + PWA
- [ ] `npx supabase` CLI + struktur migrasi
- [ ] pnpm workspace, env template, lint/format
- [ ] pasang `gh` + `jq` (butuh sudo) — untuk CI/skrip

Akun/layanan (keputusan/aksi Anda):
- [ ] **Supabase** + 1 project dev (gratis) — perlu login Anda → beri URL + anon/service key
- [ ] **EMQX Serverless** + 1 deployment gratis — perlu login Anda → beri broker URL + credential (atau HiveMQ Free)
- [ ] **SMS provider** OTP (murah/lokal) — atau putuskan email+password dulu
- [ ] **Vercel** (deploy, bisa menyusul) & repo GitHub (opsional CI, `gh auth login`)

---

## 7. RINGKAS: SUDAH EFISIEN & EFEKTIF?

Ya.
- **Efektif:** semua kapabilitas spec terpenuhi penuh — termasuk **IoT remote control instan** dan Command→Verify real-time via MQTT.
- **Efisien:** menghapus/mengelola-kan hampir semua infra, memecahkan kendala RAM, biaya pilot ~nol, waktu 1 dev+AI terfokus ke produk penghasil uang.

**Biaya rutin pilot:** Supabase Free (Pro ~$25/bln opsional saat berbayar) + EMQX Serverless Free + Vercel Free + SMS OTP (kecil). Konsisten dengan disiplin modal business plan.

**Satu-satunya kerja tambahan dari keputusan MQTT:** menulis jembatan MQTT→Supabase (§3.3) — kecil, sekali jadi, dan membuat arsitektur IoT benar sejak awal (tanpa migrasi pasca-pilot).
