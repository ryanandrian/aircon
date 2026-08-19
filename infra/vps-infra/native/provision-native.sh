#!/usr/bin/env bash
# ============================================================================
# VPS-INFRA provisioning — NATIVE systemd (TANPA Docker). BiznetGio Ubuntu 22.04, 4GB.
# Menyiapkan: swap, Node 20, Mosquitto (native), dependensi Chromium, firewall,
#             service systemd untuk messaging-gateway + iot-bridge (ber-MemoryMax).
# Idempoten (aman diulang). Jalankan sebagai user sudo di VPS.
#
# PRASYARAT: kode sudah ada di ~/infra/messaging-gateway & ~/infra/iot-bridge
#            (kirim via: scp -r apps/messaging-gateway apps/iot-bridge VPS:~/infra/),
#            dan kedua .env sudah diisi (lihat .env.example masing-masing).
# Pilih profil RAM: PROFILE=4gb (default) | 8gb
# ============================================================================
set -euo pipefail
PROFILE="${PROFILE:-4gb}"
USER_NAME="$(whoami)"
INFRA="$HOME/infra"

if [ "$PROFILE" = "8gb" ]; then GW_MAX=6G; GW_HIGH=5500M; SESSIONS=15; else GW_MAX=2500M; GW_HIGH=2200M; SESSIONS=6; fi

echo "==> [1/7] SWAP 2GB (anti-OOM di VPS kecil)"
if ! sudo swapon --show | grep -q swapfile; then
  sudo fallocate -l 2G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
  sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
  echo 'vm.swappiness=10' | sudo tee /etc/sysctl.d/99-swap.conf >/dev/null && sudo sysctl -w vm.swappiness=10 >/dev/null
fi
free -h | grep -E "Mem|Swap"

echo "==> [2/7] Paket dasar + Node 20 + Mosquitto (native, tanpa Docker)"
sudo apt-get update -y -q
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -q curl ca-certificates gnupg git ufw nginx mosquitto mosquitto-clients >/dev/null
if ! command -v node >/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - >/dev/null 2>&1
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -q nodejs >/dev/null
fi
node -v

echo "==> [3/7] Dependensi Chromium (whatsapp-web.js/puppeteer)"
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -q \
  libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 \
  libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 \
  libcairo2 libasound2 libatspi2.0-0 fonts-liberation >/dev/null

echo "==> [4/7] Firewall"
for p in 22 80 443 8080 8883; do sudo ufw allow ${p}/tcp >/dev/null; done
echo "y" | sudo ufw enable >/dev/null 2>&1 || true

echo "==> [5/7] npm install (gateway + bridge)"
( cd "$INFRA/messaging-gateway" && npm install --omit=dev >/dev/null 2>&1 )
( cd "$INFRA/iot-bridge" && npm install --omit=dev >/dev/null 2>&1 )
# iot-bridge TS -> mjs bila belum ada (Node 20 tak dukung strip-types)
if [ ! -f "$INFRA/iot-bridge/index.mjs" ] && [ -f "$INFRA/iot-bridge/index.ts" ]; then
  npx --yes esbuild "$INFRA/iot-bridge/index.ts" --format=esm --platform=node --target=node20 --outfile="$INFRA/iot-bridge/index.mjs"
fi

echo "==> [6/7] Mosquitto config (auth wajib, anonymous off) — set password bila belum ada"
if [ ! -f /etc/mosquitto/passwd ]; then
  echo "    !! Buat user MQTT: sudo mosquitto_passwd -b -c /etc/mosquitto/passwd aircon_devices '<PASSWORD>'"
fi
sudo tee /etc/mosquitto/conf.d/aircon.conf >/dev/null <<'CONF'
listener 1883 127.0.0.1
allow_anonymous false
password_file /etc/mosquitto/passwd
CONF
sudo systemctl enable mosquitto >/dev/null 2>&1; sudo systemctl restart mosquitto || true

echo "==> [7/7] Service systemd (profil $PROFILE: gateway MemoryMax=$GW_MAX, sesi=$SESSIONS)"
# Pastikan WA_MAX_LIVE_SESSIONS selaras profil
sed -i "s/^WA_MAX_LIVE_SESSIONS=.*/WA_MAX_LIVE_SESSIONS=$SESSIONS/" "$INFRA/messaging-gateway/.env" 2>/dev/null || true
sudo cp "$INFRA/native/aircon-gateway.service" /etc/systemd/system/ 2>/dev/null || true
sudo cp "$INFRA/native/aircon-bridge.service"  /etc/systemd/system/ 2>/dev/null || true
# Sesuaikan MemoryMax gateway sesuai profil
sudo sed -i "s/^MemoryMax=.*/MemoryMax=$GW_MAX/; s/^MemoryHigh=.*/MemoryHigh=$GW_HIGH/" /etc/systemd/system/aircon-gateway.service
sudo systemctl daemon-reload
sudo systemctl enable aircon-gateway aircon-bridge >/dev/null 2>&1
sudo systemctl restart aircon-gateway aircon-bridge
sleep 6
echo "== status =="; for s in mosquitto aircon-gateway aircon-bridge; do printf "  %-16s %s\n" "$s" "$(systemctl is-active $s)"; done
echo "== health =="; curl -fsS http://localhost:8080/health && echo "" || echo "  gateway belum sehat — cek: sudo journalctl -u aircon-gateway -n 30"
echo "==> SELESAI. Pantau RAM: free -h ; systemctl status aircon-gateway"
