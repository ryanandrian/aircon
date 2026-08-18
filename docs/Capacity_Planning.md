# Perencanaan Kapasitas — RAM & Storage per Jumlah Tenant

> Pemicu: "Berapa RAM & storage untuk 100 tenant pertama? Kalau kendalanya RAM,
> kenapa tidak sekalian sewa VPS mumpuni — satu tempat, kontrol mudah, lebih murah
> (BiznetGio MM 8.4: 4C/8GB/60GB Rp269rb/bln)?"

## 0. Temuan utama (baca ini dulu — mengubah strategi)
Pendorong RAM **99% adalah whatsapp-web.js**, BUKAN app Next.js. whatsapp-web.js =
Chromium headless, **SATU sesi persisten per tenant** (tiap tenant pakai nomor WA
sendiri). Ini mahal RAM dan **tidak menskala** ke ratusan tenant di satu box murah.

**Konsekuensi jujur:** VPS 8GB (MM 8.4) **cukup untuk ~12–15 tenant**, BUKAN 100.
Untuk 100 tenant dengan whatsapp-web.js butuh **~40–50 GB RAM** — itu box ~Rp1,5–2,5jt/bln.
Jadi kendalanya bukan "Vercel vs VPS", tapi "**whatsapp-web.js adalah jalan buntu skala**".

## 1. Rincian kebutuhan (asumsi eksplisit)
### Yang TIDAK membebani VPS (penting):
- **Database Postgres** → di Supabase Tokyo (bukan VPS). RAM DB = 0 di VPS kita.
- **Foto bukti kerja** → di S3 BiznetGio (bukan VPS). Storage foto = 0 di VPS.
  → VPS kita **stateless** untuk data besar; ini menyederhanakan sizing.

### Biaya tetap (selalu nyala), perkiraan:
| Komponen | RAM |
|---|---|
| OS + overhead | 0,5–1 GB |
| App Next.js (bila di VPS) | 0,5–1 GB |
| Mosquitto MQTT | ~50–100 MB |
| iot-bridge (Node) | ~100–150 MB |
| Orkestrator WA worker | ~150 MB |
| **Subtotal tetap** | **~1,5–2,5 GB** |

### Per tenant (pendorong sebenarnya):
| Komponen | RAM/tenant |
|---|---|
| Sesi WhatsApp (Chromium) | **250–500 MB** (rencanakan ~400 MB) |
| Koneksi MQTT device IoT | dapat diabaikan (KB) |
| Telemetry IoT | dapat diabaikan |

### Rumus: **RAM ≈ 2 GB + (N tenant × 0,4 GB)**

| Tenant | RAM dibutuhkan | Storage* | Tier BiznetGio kira-kira |
|---|---|---|---|
| 10 | ~6 GB | ~15 GB | 8 GB (MM 8.4) — pas |
| 15 | ~8 GB | ~18 GB | 8 GB — **batas aman** |
| 25 | ~12 GB | ~25 GB | 16 GB |
| 50 | ~22 GB | ~35 GB | 32 GB |
| **100** | **~42 GB** | **~45–55 GB** | **48–64 GB (~Rp1,5–2,5jt/bln)** |

\*Storage = app+OS (~8GB) + data sesi WA per tenant (~50–150MB, bisa membengkak dari
cache Chromium) + log (rotasi). Postgres & foto TIDAK di sini.

## 2. Kenapa 8GB tak cukup untuk 100 (dan itu bukan soal hosting)
100 × 400MB = 40GB HANYA untuk armada Chromium. Tidak ada trik menaruh 40GB di 8GB.
Menaikkan VPS ke 48–64GB bisa — tapi:
- **Mahal** (~Rp1,5–2,5jt/bln) — melcompat jauh dari disiplin modal.
- **Rapuh:** 100 Chromium = 100 titik crash/OOM/QR-rescan/risiko-ban WA. Operasional berat.
- **Boros:** membayar RAM idle untuk sesi yang jarang kirim pesan.

## 3. Fork strategis SEBENARNYA: whatsapp-web.js vs WhatsApp Cloud API
| Aspek | whatsapp-web.js (sekarang) | WhatsApp Cloud API (resmi Meta) |
|---|---|---|
| RAM/tenant | 250–500 MB (Chromium) | **~0 (HTTP call, tanpa browser)** |
| Skala 100 tenant | ~42 GB, rapuh | **ringan, ratusan-ribuan tenant di box kecil** |
| Biaya | "gratis" tapi bayar RAM besar | gratis tier + bayar per-percakapan (murah) |
| Risiko ban | ada (unofficial) | **resmi, tak ada ban** |
| Onboarding tenant | scan QR (mudah) | tenant daftar nomor ke Meta (lebih ribet) |
| Cocok untuk | pilot / puluhan tenant | **skala 100+ tenant** |

**Intinya:** untuk 100+ tenant, jawaban yang benar hampir pasti **pindah ke Cloud API**,
BUKAN membeli RAM 64GB untuk menumpuk Chromium. Cloud API menghapus pendorong RAM
sepenuhnya → 100 tenant muat nyaman di VPS 8GB, dan pilihan "semua di VPS" jadi ideal.

## 4. REKOMENDASI (menjawab langsung usul owner)
Usul owner (satu VPS mumpuni, satu tempat, kontrol mudah, hemat akun) **secara prinsip benar** —
tapi disesuaikan dengan realita skala WA:

**SEKARANG (pilot ≤ ~15 tenant, 25 device):**
→ **Sewa 1 VPS BiznetGio 8GB (MM 8.4, Rp269rb/bln) — dan taruh SEMUA di situ**
(app + Mosquitto + WA worker + iot-bridge, via Docker Compose, tiap layanan ber-limit RAM).
Ini persis konsolidasi yang owner mau, **cukup untuk pilot, kontrol satu tempat, murah.**
App tetap bisa paralel di Vercel Hobby gratis sebagai cadangan/uji — tapi untuk kesederhanaan
kontrol, satu VPS 8GB sudah sah untuk fase ini.

**SAAT TUMBUH ke ~20+ tenant → titik keputusan WA (bukan hosting):**
→ **Migrasi WA worker ke WhatsApp Cloud API.** Setelah itu RAM per tenant ≈ 0, dan
**VPS 8GB yang sama bisa menampung 100+ tenant** tanpa upgrade besar. Baru upgrade RAM
sedikit kalau perlu. Ini jauh lebih murah & stabil daripada VPS 64GB penuh Chromium.

**Kesimpulan angka untuk 100 tenant:**
- Dengan whatsapp-web.js: **~42GB RAM / ~50GB storage** (mahal, rapuh) — TIDAK disarankan.
- Dengan Cloud API: **~4–8GB RAM / ~20GB storage** (VPS 8GB cukup, ~Rp269rb/bln) — DISARANKAN.

## 5. Aturan pengunci (apa pun keputusannya)
- Docker Compose, tiap layanan ber-limit memori + auto-restart.
- WA worker ter-isolasi (jangan biarkan Chromium mencekik app).
- Rotasi log + pembersihan cache Chromium (cegah storage membengkak).
- Backup config VPS (app stateless, jadi backup ringan).
