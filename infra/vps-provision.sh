#!/usr/bin/env bash
# ============================================================================
# Aircon VPS provisioning — BiznetGio Ubuntu 22.04
# Menyiapkan SATU VPS untuk: wa-worker (whatsapp-web.js) + Mosquitto (MQTT) + iot-bridge
# Jalankan sebagai root/sudo di VPS bersih. Idempoten (aman diulang).
# Referensi: docs/MQTT_Decision_v3_Mosquitto_VPS.md, apps/wa-worker/README.md
# ============================================================================
set -euo pipefail

echo "==> [1/6] Update sistem & tool dasar"
apt-get update -y
apt-get install -y curl ca-certificates gnupg ufw git

echo "==> [2/6] Node.js 20 LTS"
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
node --version

echo "==> [3/6] Dependensi Chromium untuk whatsapp-web.js (Puppeteer)"
apt-get install -y \
  libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 \
  libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 \
  libcairo2 libasound2 libatspi2.0-0 fonts-liberation

echo "==> [4/6] Mosquitto MQTT broker (ringan, hemat RAM — dampingi Chromium)"
apt-get install -y mosquitto mosquitto-clients
systemctl enable mosquitto

# Konfig auth + listener. Password & TLS diisi manual/terpisah (jangan taruh rahasia di skrip).
cat >/etc/mosquitto/conf.d/aircon.conf <<'CONF'
# Aircon MQTT — auth wajib, anonymous OFF.
listener 1883 localhost          # plain hanya lokal (iot-bridge di VPS sama)
listener 8883                    # TLS untuk device dari internet
allow_anonymous false
password_file /etc/mosquitto/passwd
# TLS (isi setelah punya sertifikat, mis. Let's Encrypt / self-signed):
# cafile /etc/mosquitto/certs/ca.crt
# certfile /etc/mosquitto/certs/server.crt
# keyfile /etc/mosquitto/certs/server.key
# ACL agar tiap device hanya boleh topik miliknya:
# acl_file /etc/mosquitto/aclfile
CONF

# Buat file passwd kosong bila belum ada (device ditambah: mosquitto_passwd -b /etc/mosquitto/passwd <deviceId> <pass>)
touch /etc/mosquitto/passwd
chown mosquitto: /etc/mosquitto/passwd || true
systemctl restart mosquitto

echo "==> [5/6] Firewall (UFW)"
ufw allow 22/tcp     || true   # SSH
ufw allow 8883/tcp   || true   # MQTT TLS (device)
# 1883 TIDAK dibuka ke publik (hanya localhost untuk iot-bridge)
ufw --force enable    || true
ufw status

echo "==> [6/6] Systemd service (wa-worker & iot-bridge)"
# Catatan: deploy kode via `git clone` repo ke /opt/aircon lalu `pnpm install` di masing-masing app.
# Contoh unit (aktifkan setelah kode ada & .env terisi):
cat >/etc/systemd/system/aircon-wa-worker.service <<'UNIT'
[Unit]
Description=Aircon WhatsApp Worker (whatsapp-web.js)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=/opt/aircon/apps/wa-worker
EnvironmentFile=/opt/aircon/apps/wa-worker/.env
ExecStart=/usr/bin/node src/worker.js
Restart=always
RestartSec=5
User=aircon

[Install]
WantedBy=multi-user.target
UNIT

cat >/etc/systemd/system/aircon-iot-bridge.service <<'UNIT'
[Unit]
Description=Aircon IoT Bridge (MQTT <-> Supabase)
After=network-online.target mosquitto.service
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=/opt/aircon/apps/iot-bridge
EnvironmentFile=/opt/aircon/apps/iot-bridge/.env
ExecStart=/usr/bin/node src/bridge.js
Restart=always
RestartSec=5
User=aircon

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
echo ""
echo "SELESAI. Langkah berikutnya (manual):"
echo "  1. useradd -m -s /bin/bash aircon   (user non-root)"
echo "  2. git clone repo ke /opt/aircon; pnpm install di apps/wa-worker & apps/iot-bridge"
echo "  3. Isi .env masing-masing app (MQTT_URL, SUPABASE_*, dst)"
echo "  4. Tambah device MQTT: mosquitto_passwd -b /etc/mosquitto/passwd <deviceId> <password>"
echo "  5. (Produksi) pasang TLS cert di /etc/mosquitto/certs + aktifkan baris tls/acl di aircon.conf"
echo "  6. systemctl enable --now aircon-wa-worker aircon-iot-bridge"
