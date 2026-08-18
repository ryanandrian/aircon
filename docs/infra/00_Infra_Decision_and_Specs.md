# Keputusan Infrastruktur Portofolio — VPS-INFRA + VPS-APP (FINAL)

> Konteks penentu: ada TIM developer + target 12 aplikasi/tahun. VPS-INFRA (WA+MQTT)
> harus dipakai bersama banyak app. Dokumen ini = keputusan tegas + spek + alasan.

## 1. KEPUTUSAN (tegas, bukan "tergantung")

### 1a. VPS-INFRA (WA Gateway + MQTT bersama) → **BANGUN & SEWA SEKARANG.**
Alasan: developer lain sedang membangun app yang butuh WA/MQTT/IoT. Mereka butuh
endpoint gateway untuk berintegrasi HARI INI. Menundanya memblokir tim. Ini investasi
bersama 12 app (ROI tertinggi dari semua pengeluaran infra). **Sewa sekarang.**

### 1b. aircon-app: Vercel dulu → migrasi ke VPS-APP saat LAUNCH KOMERSIAL. (BUKAN sekarang)
Ini keputusan yang Anda minta saya timbang matang. **Rekomendasi tegas: JANGAN pindahkan
aircon-app sekarang. Selesaikan & validasi di Vercel dulu, migrasi saat go-komersial.**

Alasan (mengapa memindah aplikasi sekarang = keliru, padahal gateway sekarang = benar):
1. **Dua keputusan TERPISAH.** VPS-INFRA melayani semua app lewat API. Di mana aircon-app
   berjalan (Vercel atau VPS) TAK memengaruhi gateway. aircon-app cukup MEMANGGIL gateway
   via HTTPS — sama saja dari Vercel maupun VPS. Jadi gateway sekarang ✅, app pindah nanti ✅.
2. **Migrasi app itu MEKANIS & MURAH nanti.** aircon-app stateless (data di Supabase+S3).
   Pindah Vercel→VPS = tambah Dockerfile + nginx, TANPA ubah kode. Menunda = nyaris gratis.
3. **Velocity fase akhir.** App belum 100% (portal keagenan baru jadi, IoT baru, dll).
   Vercel = deploy instan tiap push saat iterasi cepat. Pindah ke VPS sekarang = beban
   devops (TLS, pm2, pipeline) di tengah pengembangan aktif = memperlambat penyelesaian.
4. **Vercel Hobby sah untuk fase validasi** (belum komersial-skala). Saat menagih tenant
   massal → itu penanda pindah ke VPS-APP (sekaligus keluar dari batas Hobby).

**Ringkas keputusan:** Gateway (VPS-INFRA) = uang keluar SEKARANG (mendesak, bersama).
aircon-app = tetap Vercel sampai fitur beku + tervalidasi, lalu pindah ke VPS-APP
(mekanis, murah, terjadwal di go-komersial). Ini memisahkan yang mendesak dari yang bisa ditunda.

## 2. SPEK VPS (BiznetGio, konkret & bisa langsung dibeli)

### 2a. VPS-INFRA (WA Gateway + Mosquitto + iot-bridge) — SEWA SEKARANG
Pendorong RAM = TOTAL sesi WhatsApp (Chromium) lintas SEMUA app (~400MB/sesi).

| Fase | Total sesi WA (semua app) | Spek | Kira-kira |
|---|---|---|---|
| **Pilot (sekarang)** | ≤ ~15 | **4C / 8GB / 60GB** (MM 8.4) | **Rp269rb/bln** ← BELI INI |
| Tumbuh | ~30 | 8C / 16GB / 80GB | ~Rp500–600rb/bln |
| 100 tenant aircon (+app lain) via **waweb.js** | ~100+ | 16C / 48–64GB | ~Rp1,5–2,5jt/bln (mahal, rapuh) |
| **100 tenant via WhatsApp Cloud API** | (Chromium hilang) | **kembali 8GB cukup** | **Rp269rb/bln** |

**Rekomendasi:** beli **MM 8.4 (8GB) sekarang** untuk pilot semua app. Sebelum total sesi
WA tembus ~25–30, **migrasi WA Gateway ke Cloud API** (sekali, untuk semua app) → 8GB itu
menampung 100+ tenant. **Jangan beli 64GB untuk menumpuk Chromium** — itu menyelesaikan
gejala, bukan penyakit.

### 2b. VPS-APP (aircon + app lain, saat migrasi dari Vercel) — SEWA NANTI (go-komersial)
Next.js stateless & ringan (data di Supabase/S3). Bahkan melayani 100 tenant, RAM app kecil.

| Isi | Spek | Kira-kira |
|---|---|---|
| aircon-app saja | 2C / 4GB / 40GB | ~Rp150–200rb/bln |
| **aircon + beberapa app** | **4C / 8GB / 60GB** (MM 8.4) | **Rp269rb/bln** ← saat multi-app |

**Catatan:** VPS-APP dan VPS-INFRA sengaja dipisah supaya armada Chromium (yang bisa
crash/OOM) TIDAK sekamar dengan app pelanggan. Isolasi failure domain = wajib.

### 2c. Total biaya bulanan (perkiraan)
- **Sekarang (pilot):** VPS-INFRA 8GB = **Rp269rb/bln**. aircon-app = Vercel (gratis). S3 sesuai pakai.
- **Go-komersial (100 tenant, Cloud API):** VPS-INFRA 8GB + VPS-APP 8GB = **~Rp538rb/bln** total,
  melayani SELURUH portofolio. Jauh lebih murah daripada 12 infra terpisah atau 1 box 64GB.

## 3. Kenapa 2 VPS (bukan 1 besar): jawaban final
- **Isolasi:** Chromium fleet (rewel) terpisah dari app pelanggan (harus selalu hidup).
- **Skala independen:** naikkan RAM INFRA saat sesi WA naik; app tetap kecil.
- **Berbagi lintas 12 app:** INFRA = 1 investasi untuk semua; APP menampung banyak app ringan.
- **Kontrol tetap sederhana:** hanya 2 box, keduanya Docker Compose — bukan 12 infra.

## 4. Yang dibangun SEKARANG (agar tim bisa integrasi)
1. `apps/messaging-gateway/` — WA Gateway sebagai **service ber-REST-API** (multi-app,
   API key, webhook callback) — menggantikan pola "worker poll DB aircon" agar bisa dipakai
   app mana pun. (Abstraksi: app cukup `POST /v1/wa/send`; mesin WA bisa waweb.js→Cloud API
   tanpa app berubah.)
2. `infra/vps-infra/docker-compose.yml` — gateway + Mosquitto, ber-limit RAM + auto-restart.
3. Dokumentasi lengkap (untuk developer lain): arsitektur, panduan integrasi WA & MQTT,
   spek & sizing, keamanan. Lihat `docs/infra/`.
