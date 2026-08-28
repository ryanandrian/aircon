# Infrastruktur Portofolio (VPS-INFRA) — Indeks Dokumen

> 🏛️ **MULAI DARI SSOT:** [`00_SSOT_Gateway_Architecture.md`](00_SSOT_Gateway_Architecture.md) —
> sumber kebenaran tunggal arsitektur + kontrak + precedence config + failure modes. Bila dokumen
> lain bertentangan dengan SSOT, SSOT yang benar.

Dokumentasi shared infrastructure untuk portofolio "12 SaaS": WhatsApp Gateway + MQTT/IoT
bersama, dipakai banyak aplikasi. **Developer app lain: mulai dari SSOT lalu guide kanal yang dibutuhkan.**

## Baca sesuai kebutuhan
| # | Dokumen | Untuk siapa |
|---|---|---|
| **00-SSOT** | [Arsitektur SSOT Gateway](00_SSOT_Gateway_Architecture.md) | **SEMUA — baca dulu** |
| 00 | [Keputusan & Spek Infra](00_Infra_Decision_and_Specs.md) | Owner/arsitek — kenapa 2 VPS, spek, biaya |
| 10 | [Integrasi WhatsApp Gateway](10_WhatsApp_Gateway_Integration_Guide.md) | **Developer app yang butuh kirim/terima WA** |
| 20 | [Integrasi MQTT / IoT](20_MQTT_Integration_Guide.md) | **Developer app yang butuh device IoT** |
| 30 | [Kapasitas & Spek](30_Capacity_and_Specs.md) | Sizing RAM/storage, kapan upgrade |
| 40 | [Deploy & Rollout](40_Deploy_and_Rollout.md) | Admin infra (⚠️ deploy NYATA = native/systemd, lihat SSOT §6) |

## Arsitektur singkat
```
  Aplikasi (aircon, app#2, ...)                VPS-INFRA (shared)
  ├─ di Vercel / VPS-APP        ── REST API ──▶ messaging-gateway (WhatsApp)
  └─ panggil gateway via HTTPS  ◀─ webhook ───  Mosquitto (MQTT) + iot-bridge
       (X-Api-Key per app)                      tiap service ber-limit RAM, Docker
```

## Prinsip yang mengikat semua app
1. **App TIDAK memuat whatsapp-web.js.** Selalu lewat gateway API (`POST /v1/wa/send`).
   → memungkinkan tukar mesin ke **WhatsApp Cloud API** tanpa app berubah.
2. **Namespace per app** (WA session `{appId}:{externalId}`, topik MQTT `{appId}/...`) →
   isolasi antar-produk.
3. **Data besar bukan di VPS** — DB di Supabase, foto di S3. VPS stateless & ringan.
4. **Docker Compose + limit RAM + auto-restart.** Chromium (WA) ter-isolasi dari layanan lain.

## Kode terkait di repo
- `apps/messaging-gateway/` — WA Gateway (service REST multi-app).
- `infra/vps-infra/docker-compose.yml` — gateway + Mosquitto (VPS-INFRA).
- `apps/iot-bridge/` — bridge MQTT → HTTP ingest (referensi aircon).
- `apps/wa-worker/` — worker WA lama aircon (poll DB); digantikan pola gateway untuk portofolio.
