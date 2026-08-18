# Arsitektur Portofolio — Shared Messaging/IoT Gateway (2 VPS)

> Pemicu (owner): "Kalau waweb.js bisa dipakai banyak aplikasi (bukan cuma aircon),
> sewa 1 VPS khusus MQTT+waweb.js (bersama untuk semua app) + 1 VPS khusus aplikasi.
> Gimana?"

## 0. Vonis singkat
**Ini arah arsitektur yang BENAR untuk model "12 SaaS".** Menjadikan WA+MQTT sebagai
**layanan bersama (shared gateway)** yang melayani banyak app = pola platform yang
dipakai perusahaan dewasa. Owner menemukan pola yang tepat. **TAPI** ada satu
kesalahpahaman yang harus diluruskan (lihat §2) supaya keputusan ini tidak keliru arah.

## 1. Bentuk arsitektur yang diusulkan
```
                 ┌─────────────────────────┐
   aircon app ──▶│  VPS-APP (aplikasi)      │
   app #2    ──▶ │  Next.js x N (Docker)    │
   app #3    ──▶ │  ringan, stateless       │
                 └───────────┬─────────────┘
                             │ HTTP/API internal (ter-otentikasi)
                             ▼
                 ┌─────────────────────────┐
                 │  VPS-INFRA (bersama)     │
                 │  - WA Gateway (waweb.js) │◀── melayani SEMUA app
                 │  - Mosquitto MQTT        │
                 │  - iot-bridge            │
                 └─────────────────────────┘
```
- **VPS-INFRA** = "produk internal": satu WA Gateway + satu broker MQTT untuk seluruh
  portofolio. App memanggilnya lewat API internal (kirim pesan, status sesi).
- **VPS-APP** = kumpulan aplikasi Next.js (ringan, stateless — data di Supabase/S3).

## 2. LURUSKAN dulu: memisah VPS TIDAK mengurangi total RAM waweb.js
Kesalahpahaman berbahaya bila tidak disadari: **RAM waweb.js ditentukan JUMLAH TOTAL
nomor WA (Chromium) lintas semua app, bukan oleh di-VPS-mana ia ditaruh.**
- aircon 15 tenant + app#2 10 tenant + app#3 20 tenant = 45 Chromium = **~18 GB**,
  entah di 1 VPS atau 2 VPS.
- Jadi VPS-INFRA tetap harus cukup besar untuk menampung SUM(semua sesi WA portofolio).
- **Memisah VPS memberi ISOLASI & KONTROL, bukan penghematan RAM.**

→ Konsekuensi: kalau tetap pakai waweb.js, VPS-INFRA justru yang paling cepat "berat"
karena menanggung Chromium SEMUA app. Ini menguatkan (lagi) bahwa **gerbang skala
sesungguhnya = pindah WA ke Cloud API**, dan shared-gateway membuat migrasi itu
dilakukan SEKALI untuk semua app (keuntungan besar — lihat §4).

## 3. Kelebihan & kekurangan (jujur, dua arah)
### Kelebihan (kuat)
1. **Amortisasi biaya lintas app.** Satu broker + satu gateway dibagi 12 app —
   tiap app tak bayar infra WA/MQTT sendiri. Ekonomis di level portofolio.
2. **Satu tempat operasional untuk hal tersulit.** waweb.js (bagian paling rewel:
   QR, sesi, crash, ban) dikelola di SATU kodebase/box, bukan diduplikasi 12×.
3. **App tetap ringan & seragam.** VPS-APP cuma Next.js stateless → mudah, bisa
   auto-restart, bahkan sebagian tetap di Vercel bila mau.
4. **Isolasi failure domain benar.** Chromium fleet crash → app pelanggan TAK ikut
   tumbang (beda VPS). Ini persis pemisahan yang §Hosting tekankan, tapi di level portofolio.
5. **Gerbang migrasi Cloud API terpusat.** Ganti mesin WA cukup di 1 gateway → seluruh
   12 app langsung dapat manfaat. Tanpa shared gateway, harus migrasi 12×.
6. **Reusable = niat awal owner** ("waweb.js untuk banyak aplikasi") terwujud rapi.

### Kekurangan (harus dimitigasi)
1. **Titik pusat risiko.** VPS-INFRA tumbang → SEMUA app kehilangan WA+IoT sekaligus.
   Mitigasi: monitoring, auto-restart, snapshot, dan (nanti) redundansi.
2. **RAM VPS-INFRA = SUM semua app** (lihat §2) → tetap dinding skala selama waweb.js.
3. **Perlu API gateway sungguhan** (otentikasi antar-app, kuota, rate-limit, audit)
   → sedikit kompleksitas awal (tapi sekali bangun, dipakai selamanya).
4. **Keamanan lintas-app** (aircon tak boleh baca sesi app lain) → wajib per-app token/namespace.
5. **2 VPS = 2 yang di-manage** (walau tetap < 12 infra terpisah).

## 4. Kenapa ini justru mempercepat keputusan Cloud API
Bila WA Gateway dibangun sebagai **layer abstraksi** (app memanggil "kirim pesan ke
nomor X" via API, tak peduli mesinnya), maka:
- **Fase 1:** gateway pakai waweb.js di baliknya (gratis, cepat, untuk pilot).
- **Fase 2:** ganti isi gateway ke **WhatsApp Cloud API** — **app tak berubah sama sekali**,
  dan **12 app langsung naik kelas** dari satu perubahan. RAM per nomor → ~0.
Ini keuntungan arsitektur terbesar dari usul owner: **shared gateway = satu titik
untuk menukar mesin WA bagi seluruh portofolio.**

## 5. REKOMENDASI
**Setuju dengan arah owner, dengan penyesuaian sizing & disiplin bertahap:**

**Sekarang (pilot aircon, 1 app):** JANGAN dua VPS dulu — **1 VPS 8GB (MM 8.4,
Rp269rb) berisi semua** (app + gateway + MQTT) via Docker Compose. Untuk 1 app pilot,
dua VPS = kompleksitas & biaya prematur. **Bangun WA sebagai service terpisah di dalam
compose (bukan library nempel di app)** — supaya nanti tinggal diangkat ke VPS-INFRA
tanpa tulis ulang. Inilah investasi arsitektur yang benar sekarang: **pisahkan secara
LOGIS dulu (service), pisahkan FISIK (VPS) nanti saat app ke-2 lahir.**

**Saat app ke-2/ke-3 lahir (portofolio mulai jalan):** BARU pisah jadi 2 VPS persis
usul owner — VPS-INFRA (WA Gateway + MQTT, dibagi semua app) + VPS-APP (kumpulan app).
Saat itu amortisasi biaya & operasional benar-benar terasa.

**Saat total sesi WA lintas app > ~30–40:** migrasi isi gateway ke Cloud API (sekali,
untuk semua app). Setelah itu VPS-INFRA bisa kecil lagi.

## 6. Sizing 2-VPS (bila sudah beberapa app, MASIH waweb.js)
| VPS | Isi | Ukuran awal | Naik saat |
|---|---|---|---|
| VPS-APP | Next.js × N (stateless) | 8GB cukup utk banyak app | trafik/app sangat banyak |
| VPS-INFRA | WA Gateway + Mosquitto + bridge | 8GB (~15 sesi) → 16/32GB | SUM sesi WA naik |

Dengan Cloud API: VPS-INFRA balik ke 8GB untuk ratusan nomor (Chromium hilang).

## 7. Aturan pengunci
1. **WA = SERVICE di balik API sejak awal** (abstraksi), bukan library nempel app →
   memungkinkan pindah VPS & ganti Cloud API tanpa sentuh app.
2. Otentikasi per-app + namespace sesi (isolasi antar-produk).
3. Docker Compose, tiap service ber-limit RAM + auto-restart + rotasi log.
4. Monitoring VPS-INFRA (ia titik pusat) + snapshot berkala.
