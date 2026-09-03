# 🏛️ SSOT — Shared Messaging & IoT Gateway (WhatsApp + MQTT) untuk Portofolio Multi-App

> **STATUS: SUMBER KEBENARAN TUNGGAL (Single Source of Truth).**
> Dokumen ini MENGIKAT semua aplikasi (aircon dan app portofolio lain) yang memakai gateway
> WhatsApp/MQTT bersama. Bila dokumen lain bertentangan dengan file ini, **file ini yang benar.**
> Setiap perubahan arsitektur/kontrak gateway WAJIB memperbarui dokumen ini di PR yang sama.
>
> Panduan integrasi rinci per-kanal ada di dokumen turunan (jangan diduplikasi di sini):
> - WA: [`10_WhatsApp_Gateway_Integration_Guide.md`](10_WhatsApp_Gateway_Integration_Guide.md)
> - MQTT: [`20_MQTT_Integration_Guide.md`](20_MQTT_Integration_Guide.md)
> - Deploy native (kanonik): [`../../infra/vps-infra/native/README.md`](../../infra/vps-infra/native/README.md)

Terakhir diverifikasi terhadap server nyata: **2026-08-29** (uji kirim WA nyata sukses + audit kode).

---

## 0. TL;DR (baca ini dulu)
- **Satu VPS-INFRA** menjalankan gateway bersama. Dipakai BANYAK app via REST API + API key per-app.
- **Kanal WhatsApp**: `messaging-gateway` (Node systemd, port 8080). App kirim via `POST /v1/wa/send`.
- **Kanal MQTT/IoT**: Mosquitto broker + `iot-bridge` (subscribe → HTTP ingest ke app).
- **Deploy NYATA = systemd native** (BUKAN Docker). Docker Compose hanya alternatif yang tidak dipakai.
- **Config policy anti-ban = InfraConfig DB app (di-pull), MENIMPA `.env` server.** (Lihat §4 — footgun.)
- **App TIDAK PERNAH memuat whatsapp-web.js sendiri.** Selalu lewat gateway (agar bisa tukar ke Cloud API).

---

## 1. Topologi & lokasi kebenaran (ground truth)

```
  App (aircon, app#2, …)  ──HTTPS X-Api-Key──▶  VPS-INFRA (host "aircon", user rad4ssh)
   di Vercel / VPS-APP     ◀──── webhook ──────   ├─ systemd: aircon-gateway  (WA, :8080)
                                                   ├─ systemd: aircon-bridge   (MQTT→ingest)
   Device IoT  ──MQTT/TLS 8883──────────────────▶ └─ systemd: mosquitto       (:1883 lokal)
```

| Komponen | Lokasi server | Unit systemd | Sumber kode (repo) |
|---|---|---|---|
| WA Gateway | `/home/rad4ssh/infra/messaging-gateway` | `aircon-gateway.service` | `apps/messaging-gateway/` |
| IoT Bridge | `/home/rad4ssh/infra/iot-bridge` | `aircon-bridge.service` | `apps/iot-bridge/` |
| MQTT Broker | Mosquitto sistem | `mosquitto.service` | `infra/vps-infra/mosquitto/config/` |
| Unit systemd | `/etc/systemd/system/` | — | `infra/vps-infra/native/*.service` |
| Reverse proxy | nginx → :8080 (TLS) | `nginx` | `infra/vps-infra/native/gw.conf` |

- **Akses**: SSH user `rad4ssh`, key `~/.ssh/aircon-ssh.pem`. Domain publik: `gw.<domain>` (nginx+TLS) → :8080.
- **Server BUKAN git repo.** Update kode via `infra/vps-infra/native/redeploy.sh` (scp dari repo + restart). Lihat §6.

---

## 2. Model multi-app (bagaimana app lain ikut)

- **`app`** = aplikasi klien. Terdaftar di `GATEWAY_APPS` (JSON di `.env` gateway):
  ```json
  [{"id":"aircon","key":"<API_KEY_ACAK>","webhook":"https://<app>/api/wa/callback","policyUrl":"https://<app>/api/wa/policy"}]
  ```
  - `id` unik · `key` rahasia (header `X-Api-Key`, dibanding timing-safe) · `webhook` terima callback · `policyUrl` (opsional) sumber policy anti-ban app itu.
- **`session`** = 1 nomor WhatsApp. `externalId` = ID milik app (aircon: `tenantId`).
- **Isolasi antar-app** dijamin namespace:
  - WA session id = `{appId}:{externalId}` → app lain tak bisa menyentuh sesi Anda.
  - Topik MQTT = `{appId}/{deviceId}/...` → device app lain tak tabrakan.
- **Menambah app baru**: (1) tambah entri `GATEWAY_APPS`, (2) `sudo systemctl restart aircon-gateway`, (3) beri key ke dev app, (4) dev ikuti guide §10/§20. Tak perlu ubah kode gateway.

---

## 3. Kontrak API (stabil — tak berubah walau mesin WA ditukar ke Cloud API)

Semua `/v1/*` butuh header `X-Api-Key`. `GET /health` tanpa auth.

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/health` | `{ok, service, sessions, uptime}` |
| POST | `/v1/wa/sessions/:externalId/init` | mulai/bangunkan sesi → `{ready, qr}` |
| GET | `/v1/wa/sessions/:externalId` | `{exists, ready, qr}` |
| POST | `/v1/wa/send` | body `{externalId, toPhone, message}` → antre kirim. `409` = dedup. |
| DELETE | `/v1/wa/sessions/:externalId` | logout & hapus sesi |

Webhook app menerima (POST JSON, dibedakan `type`): `qr`, `ready`, `disconnected`, `inbound`, `sent`, `failed`.
Detail payload: dok §10. **Wajib idempoten** (pakai `messageId`).

---

## 4. ⚠️ SSOT CONFIG PRECEDENCE (footgun paling berbahaya — WAJIB paham)

Policy anti-ban (quiet-hour, throttle, warm-up, dll) punya DUA sumber, dan **DB MENANG**:

```
  Prioritas (yang menang di-pull tiap WA_POLICY_SYNC_MS ~60 dtk):
  1. InfraConfig DB app  ──(GET {policyUrl} = /api/wa/policy)──▶  applyPolicyOverride()  ◀── MENANG
  2. .env server gateway (WA_QUIET_START, dll)                                          ◀── hanya nilai AWAL / fallback
```

**Konsekuensi (pelajaran nyata 2026-08-29):** mengubah `WA_QUIET_START/END` di `.env` server **PERCUMA** —
karena tiap 60 dtk gateway mem-pull policy dari InfraConfig DB dan menimpanya kembali.
**ATURAN:** untuk mengubah quiet-hour/throttle/warm-up gateway, ubah di **InfraConfig DB** (admin panel app / kolom `InfraConfig`),
BUKAN di `.env` server. `.env` hanya berlaku bila app tak punya `policyUrl` atau pull gagal.

Gateway kini **mencetak POLICY EFEKTIF** tiap kali berubah (lihat log `[gateway] POLICY EFEKTIF ...`) supaya
override DB tak pernah "senyap" lagi.

Field policy di `InfraConfig`: `waQuietStartHour, waQuietEndHour, waTzOffset, waMinGapMs, waMaxGapMs,
waMaxPerMin, waMaxPerDay, waWarmupEnabled, waWarmupDays, waWarmupDay1Cap, waMaxLiveSessions, waIdleEvictMs`.

---

## 5. Perilaku pengiriman & proteksi anti-ban (server NOTIFIKASI, bukan blasting)

- **Antrean → drain loop** tiap `WA_TICK_MS` (3 dtk). Tiap pesan: cek quiet-hour → cek plafon harian/warm-up →
  cek batas per-menit → `getNumberId` (validasi nomor terdaftar WA) → `sendMessage` → callback `sent`/`failed`.
- **Jam tenang** (default 21:00–07:00 WIB): drain menahan SEMUA kirim (pesan tetap antre, tak hilang). `start===end` = jam tenang NONAKTIF.
- **Jeda acak 6–15 dtk** antar pesan + **batas 8/menit** + **plafon 200/hari** + **warm-up nomor baru 7 hari** (ramp ±20/hari → 200).
- **Dedup**: pesan identik ke nomor sama dalam 60 dtk → `409` (jangan retry buta).
- **Antrean PERSIST ke disk** (`{WA_SESSION_DIR}/queue.json`, atomic tmp+rename) → **tahan restart** (tak hilang).
- **Timeout kirim** (`WA_SEND_TIMEOUT_MS`, default 30 dtk): `getNumberId`/`sendMessage` yang menggantung → `failed`, loop tetap hidup.
- **Sesi WA persist** di `{WA_SESSION_DIR}/session-{appId}_{externalId}` → reconnect tanpa scan QR ulang. `init` membangunkan sesi dari auth tersimpan.

---

## 6. Deploy & operasi (KANONIK = native/systemd)

**Update kode gateway/bridge dari repo → server** (jalankan dari mesin dev):
```bash
bash infra/vps-infra/native/redeploy.sh   # scp src + package.json + restart + health check
# Bila package.json berubah (mis. versi whatsapp-web.js): SSH ke server → cd ~/infra/messaging-gateway && npm install
```
**Operasi harian** (di server):
```bash
sudo systemctl status aircon-gateway
sudo journalctl -u aircon-gateway -f          # log realtime (SENT/FAILED/POLICY EFEKTIF terlihat)
sudo systemctl restart aircon-gateway         # aman: antrean & sesi persist
curl -s http://localhost:8080/health
```
> ⚠️ **JANGAN restart beruntun dalam hitungan detik.** Antrean kini persist (aman), tapi client whatsapp-web
> butuh waktu sinkron setelah start. Restart → tunggu `READY` → baru kirim. (Pelajaran 2026-08-29.)

Provision VPS baru dari nol: `infra/vps-infra/native/provision-native.sh` (lihat README native).
Deploy Docker Compose (`docker-compose.yml`) = **alternatif tidak dipakai**; jangan campur dengan native.

---

## 7. Failure modes & runbook (diagnosis cepat)

| Gejala | Penyebab paling mungkin | Aksi |
|---|---|---|
| `POST /v1/wa/send` → `queued:true` tapi tak sampai | (a) jam tenang aktif; (b) sesi belum READY; (c) nomor non-WA | cek `journalctl` untuk `SENT`/`FAILED`; cek `GET /sessions/:id` `ready`; cek quiet via log `POLICY EFEKTIF` |
| Ubah `.env` quiet tak berpengaruh | **Override InfraConfig DB** (§4) | ubah di DB, bukan `.env` |
| "could not link device" saat scan | QR sudah basi (refresh ~60 dtk) | ambil QR segar via `init`, scan segera |
| Sesi `exists:false` setelah restart | lazy-load; sesi belum dibangunkan | panggil `POST /sessions/:id/init` (reconnect dari auth, tanpa scan) |
| Tak ada `SENT` maupun `FAILED` di log | (dulu) hang tanpa timeout — **sudah difix**; atau queue kosong/quiet | pastikan versi gateway terbaru (withTimeout); cek quiet |
| Pesan hilang saat restart | (dulu) queue in-memory — **sudah difix** (persist) | pastikan `queue.json` ada di `WA_SESSION_DIR` |
| Sesi tak pernah READY pasca **reboot mendadak** | lock Chromium basi (`SingletonLock/Socket/Cookie`) → "profile appears to be in use" | **sudah difix**: `_cleanStaleLocks()` hapus lock sebelum start tiap sesi |
| Gateway tak "langsung ready" setelah restart | dulu sesi lazy — baru hidup saat pemicu manual | **sudah difix**: `wa.rehydrate()` saat boot auto-bangunkan semua sesi tersimpan (reconnect tanpa QR bila auth valid) |
| Sesi tetap minta QR walau auth tersimpan | WhatsApp invalidasi sesi karena fingerprint mesin berubah (re-provision VPS) | scan ulang sekali via halaman app **Pengaturan → Hubungkan WhatsApp** (bukan terminal) |
| Bukti "terkirim" | **JANGAN percaya `queued`**; cek log `SENT` + callback `sent` di DB app + konfirmasi HP | verifikasi bukti nyata, bukan log antrean |

---

## 8. Kanal MQTT/IoT — status & arah multi-app

- **Sekarang**: Mosquitto (auth wajib, anonymous off, 127.0.0.1:1883 lokal / 8883 TLS publik) + `iot-bridge` subscribe → POST ingest app.
- **⚠️ Gap multi-app (FUTURE WORK — ditunda, tak ada konsumen)**: `iot-bridge` yang berjalan MASIH aircon-only
  (hardcode topik `aircon/+/telemetry` + ingest ke aircon). **Sengaja DITUNDA** (prinsip YAGNI) sampai ada app IoT
  kedua yang benar-benar butuh MQTT. Saat itu tiba: jalankan **instance bridge terpisah** (env sendiri: `MQTT_*`,
  `INGEST_URL`, `TOKEN`, prefix topik app-nya) ATAU generalisasi bridge agar baca daftar `{appId, topicPrefix, ingestUrl, token}`.
  Konvensi topik `{appId}/{deviceId}/...` sudah SSOT (dok §20); bridge tinggal mengikutinya.
- Pola wajib: app **tidak** subscribe MQTT langsung dari serverless — selalu via bridge → HTTP ingest (app tetap stateless).

---

## 9. Invariants yang TIDAK BOLEH dilanggar (agar tak ada isu baru)

1. App tak pernah memuat whatsapp-web.js — hanya via gateway API (biar bisa tukar ke Cloud API tanpa app berubah).
2. Namespace `{appId}:...` (WA) & `{appId}/...` (MQTT) — jangan pernah kirim/subscribe lintas prefix app lain.
3. Kredensial (API keys, MQTT pass) HANYA di `.env` server + `.secrets/` (gitignored) / ENV Vercel. TIDAK di repo, TIDAK di dokumen.
4. Perubahan kontrak API (§3) atau precedence config (§4) WAJIB update dokumen ini di PR yang sama.
5. Repo = sumber kode. Bila hotfix langsung di server, WAJIB backport ke repo + `redeploy.sh` agar server == repo (hindari drift).
6. Bukti efek eksternal (WA terkirim) = log `SENT` + callback DB + konfirmasi penerima — BUKAN `queued`.
