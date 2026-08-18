# iot-bridge — jembatan MQTT Mosquitto → aircon

Berjalan di VPS (BiznetGio) berdampingan dengan Mosquitto & wa-worker.
Alur: Device → MQTT (Mosquitto lokal) → iot-bridge → POST /api/iot/ingest.

## Setup di VPS
```bash
cd apps/iot-bridge
npm install
cp .env.example .env   # isi nilainya
node --experimental-strip-types index.ts   # atau pakai systemd/pm2
```

## ENV
- `MQTT_URL` — mis. `mqtt://127.0.0.1:1883`
- `MQTT_USERNAME` / `MQTT_PASSWORD` — kredensial Mosquitto
- `AIRCON_INGEST_URL` — `https://aircon-peach.vercel.app/api/iot/ingest`
- `IOT_BRIDGE_TOKEN` — samakan dengan env `IOT_BRIDGE_TOKEN` di aircon (Vercel)
- `BATCH_MS` — interval kirim batch (default 2000)

## Format telemetry (device publish)
Topik: `aircon/{deviceId}/telemetry`
Payload JSON:
```json
{ "tempC": 24.5, "humidity": 60, "currentA": 4.2, "powerW": 900, "online": true }
```

Device diprovision lewat aircon (Device.id = deviceId). Bridge tak menyimpan state;
semua deteksi alert & simpan telemetry dilakukan aircon (idempoten, tenant dari Device).
