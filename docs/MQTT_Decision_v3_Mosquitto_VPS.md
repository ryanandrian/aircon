# MQTT DECISION (v3) — Self-host Mosquitto di VPS (revisi dari EMQX Cloud)

**Keputusan:** MQTT broker = **Mosquitto self-host** di VPS BiznetGio yang sama dengan wa-worker (whatsapp-web.js). Membatalkan rencana EMQX Serverless Cloud.

## Alasan ekonomi (kenapa berubah)
1. **IoT jual-putus** — device dibayar sekali (bukan sewa). Tidak ada pendapatan berulang untuk menutup biaya broker berlangganan. EMQX Cloud bulanan = margin bocor pada produk yang sudah lunas.
2. **EMQX Cloud mahal** saat naik dari free tier.
3. **VPS sudah diadakan** untuk wa-worker (proses 24/7). Broker menumpang di sini = biaya marginal ~nol.

## Kenapa Mosquitto (bukan EMQX self-host)
- VPS juga menjalankan **whatsapp-web.js** (Chromium ~300-500MB/sesi, rakus RAM). Mosquitto **sangat ringan** (~beberapa MB) → tak berebut RAM dengan Chromium.
- EMQX self-host jauh lebih berat (Erlang VM) — tidak cocok untuk VPS padat.
- Fitur Mosquitto (MQTT 3.1.1/5, TLS, auth username/password, ACL per-topic) **cukup penuh** untuk telemetry + command + Command→Verify skala pilot.

## Arsitektur
```
Device ESP32 ──MQTT/TLS──► Mosquitto (VPS)
                              │ (subscribe d/+/telemetry, d/+/ack)
                     iot-bridge (Node, di VPS yang sama)
                              ├─ telemetry/ack ──HTTPS──► Supabase (Edge/route) → Postgres
                              └─ deteksi anomali → Alert → (opsi) buat Job
App/Owner ──► tulis command (Postgres) ──► iot-bridge publish d/<id>/cmd ──► Device
Device ack + evidence ──► Command→Verify (COMMAND_SENT→ACKNOWLEDGED→STATE_CONFIRMED)
```
- Komponen di VPS: **wa-worker** + **Mosquitto** + **iot-bridge** (satu Node service kecil, bisa digabung repo `apps/iot-bridge`).
- App utama tetap serverless (Vercel + Supabase). Hanya VPS yang punya proses persisten.

## Keamanan
- Mosquitto: TLS wajib, auth per-device (username=deviceId, password/token), ACL agar device hanya boleh topik `d/<deviceId>/#`.
- iot-bridge pakai service-role Supabase (server-only).

## Biaya
- Broker: Rp0 tambahan (menumpang VPS wa-worker).
- Konsisten dengan IoT jual-putus & disiplin modal.

## Provisioning (saat VPS diadakan)
Satu skrip setup VPS Ubuntu: install Node + Chromium deps (wa-worker) + mosquitto + mosquitto-clients + konfig TLS/auth + systemd untuk wa-worker & iot-bridge. Disiapkan sebagai file, dijalankan saat VPS siap.

## Status
- Kode broker-agnostik: topik & payload IoT (BuildSpecPack Part1 §4) tetap sama; hanya endpoint broker yang berubah (env `MQTT_URL`).
- EMQX env di .env.example ditandai opsional/legacy; diganti `MQTT_URL`, `MQTT_USERNAME`, `MQTT_PASSWORD`.
