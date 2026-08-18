# Panduan Integrasi MQTT / IoT (untuk developer aplikasi)

> Audience: developer app yang butuh telemetry device IoT (sensor, alat) via MQTT.
> Broker MQTT bersama (Mosquitto) berjalan di VPS-INFRA.

## 1. Konsep
- **Broker** = Mosquitto di VPS-INFRA (port 1883 lokal / 8883 TLS dari internet).
- **Device** publish telemetry ke topik; **bridge/app** subscribe & proses.
- **Namespace topik per app** mencegah tabrakan & kebocoran antar-app:
  ```
  {appId}/{deviceId}/telemetry      ← device publish data
  {appId}/{deviceId}/command        ← app publish perintah ke device
  {appId}/{deviceId}/status         ← device publish online/offline (LWT)
  ```
  Contoh aircon: `aircon/DEV123/telemetry`.

## 2. Kredensial & keamanan
- Auth WAJIB (anonymous OFF). Tiap app/devicefleet dapat user+password MQTT sendiri.
  Tambah user: `mosquitto_passwd -b /mosquitto/config/passwd <user> <pass>` (via container).
- **ACL per-app** (opsional tapi disarankan): batasi tiap user hanya ke prefix topik `{appId}/#`.
  Aktifkan `acl_file` di `mosquitto.conf` lalu daftar aturan:
  ```
  user aircon_devices
  topic readwrite aircon/#
  ```
- Dari internet: WAJIB TLS (8883) + firewall. Jangan buka 1883 ke publik.

## 3. Pola integrasi yang disarankan: bridge → HTTP ingest
Untuk keandalan & agar app tetap stateless, JANGAN app subscribe MQTT langsung dari
serverless. Pola yang dipakai aircon:
```
Device --MQTT--> Mosquitto --(iot-bridge, subscribe)--> HTTP POST /api/iot/ingest (app)
```
- `iot-bridge` (Node kecil di VPS-INFRA) subscribe `{appId}/+/telemetry`, lalu POST batch
  ke endpoint ingest app (ber-token). App menyimpan telemetry + deteksi alert.
- Keuntungan: app tak perlu koneksi MQTT persisten; retry & batch di bridge.
- Lihat implementasi referensi aircon: `apps/iot-bridge/` + `src/app/api/iot/ingest/route.ts`.

## 4. Format payload telemetry (konvensi portofolio)
JSON, contoh:
```json
{ "deviceId":"DEV123", "ts":1699999999, "metrics": { "tempC":26.5, "current":3.2, "power":710 } }
```
App memetakan `metrics` ke domainnya (aircon: overcurrent/no-cooling detection).

## 5. Menghubungkan device (contoh mosquitto_pub)
```bash
mosquitto_pub -h gateway.domain -p 8883 --cafile ca.crt \
  -u aircon_devices -P '<pass>' \
  -t 'aircon/DEV123/telemetry' \
  -m '{"deviceId":"DEV123","ts":1699999999,"metrics":{"tempC":26.5}}'
```

## 6. Last Will (offline detection)
Device set LWT ke `{appId}/{deviceId}/status` payload `offline` (retained). Saat device
putus, broker publish otomatis → app tahu device offline (aircon: alert OFFLINE).

## 7. Kapasitas
MQTT sangat ringan (ribuan koneksi di RAM kecil). Bukan pendorong biaya — beban VPS-INFRA
didominasi WhatsApp. Lihat 30_Capacity_and_Specs.md.
