# Infrastruktur Portofolio (VPS-INFRA) — Indeks Dokumen

> Dokumentasi integrasi gateway bersama Lumite.

Dokumentasi shared infrastructure untuk portofolio "12 SaaS": WhatsApp Gateway + MQTT/IoT
bersama, dipakai banyak aplikasi. **Developer app lain: mulai dari SSOT lalu guide kanal yang dibutuhkan.**

## Baca sesuai kebutuhan
| # | Dokumen | Untuk siapa |
|---|---|---|
|| 00 | Arsitektur gateway bersama | Referensi integrasi |
| 10 | [Integrasi WhatsApp Gateway](10_WhatsApp_Gateway_Integration_Guide.md) | **Developer app yang butuh kirim/terima WA** |
| 20 | [Integrasi MQTT / IoT](20_MQTT_Integration_Guide.md) | **Developer app yang butuh device IoT** |
| 30 | [Kapasitas & Spek](30_Capacity_and_Specs.md) | Sizing RAM/storage, kapan upgrade |


## Arsitektur singkat
```
  Aplikasi (aircon, app#2, ...)                VPS-INFRA (shared)
  └─ panggil gateway via HTTPS  ◀─ webhook ───  Mosquitto (MQTT) + iot-bridge
       (X-Api-Key per app)                      tiap service ber-limit RAM, Docker
```

## Prinsip yang mengikat semua app
1. **App TIDAK memuat whatsapp-web.js.** Selalu lewat gateway API (`POST /v1/wa/send`).
   → memungkinkan tukar mesin ke **WhatsApp Cloud API** tanpa app berubah.
2. **Namespace per app** (WA session `{appId}:{externalId}`, topik MQTT `{appId}/...`) →
   isolasi antar-produk.
3. **Data besar bukan di VPS** — DB di Supabase, foto di S3. VPS stateless & ringan.
4. Gateway dan broker berjalan sebagai service terpisah dengan batas resource.

## Kode terkait di repo
- Shared WA Gateway source is owned by `/home/rad/lumite-gateway/gateway-engine/`; this Aircon repository contains only the integration client. Legacy `apps/messaging-gateway/` is not a production deployment source.
- `infra/vps-infra/docker-compose.yml` — gateway + Mosquitto (VPS-INFRA).
- `apps/iot-bridge/` — bridge MQTT → HTTP ingest (referensi aircon).
- `apps/wa-worker/` — worker WA lama aircon (poll DB); digantikan pola gateway untuk portofolio.
