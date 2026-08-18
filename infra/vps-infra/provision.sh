#!/usr/bin/env bash
# ============================================================================
# VPS-INFRA provisioning — BiznetGio Ubuntu 22.04 (shared WA gateway + MQTT + iot-bridge)
# Dirancang untuk EFISIENSI: jalan mulus di VPS 4GB (uji/pilot), naik ke 8GB tanpa migrasi.
# Idempoten (aman diulang). Jalankan sebagai root/sudo di VPS bersih.
#   PROFILE=4gb (default) | 8gb   → memilih limit resource Docker.
# ============================================================================
set -euo pipefail
PROFILE="${PROFILE:-4gb}"
REPO_DIR="${REPO_DIR:-/opt/aircon}"

echo "==> [1/6] Paket dasar + Docker"
apt-get update -y
apt-get install -y ca-certificates curl git ufw docker.io docker-compose-plugin
systemctl enable --now docker

echo "==> [2/6] SWAP 2GB (margin aman untuk lonjakan Chromium di VPS kecil)"
# Krusial untuk 4GB: cegah OOM-kill saat Chromium spike sesaat.
if ! swapon --show | grep -q '/swapfile'; then
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  # swappiness rendah: pakai swap hanya saat benar-benar perlu (jaga performa).
  sysctl -w vm.swappiness=10; grep -q swappiness /etc/sysctl.conf || echo 'vm.swappiness=10' >> /etc/sysctl.conf
fi
free -h

echo "==> [3/6] Firewall (buka hanya yang perlu)"
ufw allow 22/tcp        # SSH
ufw allow 8080/tcp      # API gateway (idealnya batasi ke IP app/nginx)
ufw allow 8883/tcp      # MQTT TLS (device dari internet)
ufw --force enable

echo "==> [4/6] Batasi log Docker (cegah disk penuh di VPS kecil)"
cat >/etc/docker/daemon.json <<'JSON'
{ "log-driver": "json-file", "log-opts": { "max-size": "10m", "max-file": "3" } }
JSON
systemctl restart docker

echo "==> [5/6] Ambil repo & siapkan .env (bila belum)"
[ -d "$REPO_DIR" ] || git clone "${REPO_URL:?set REPO_URL}" "$REPO_DIR"
cd "$REPO_DIR/infra/vps-infra"
[ -f ../../apps/messaging-gateway/.env ] || cp ../../apps/messaging-gateway/.env.example ../../apps/messaging-gateway/.env
[ -f ../../apps/iot-bridge/.env ] || cp ../../apps/iot-bridge/.env.example ../../apps/iot-bridge/.env
echo "    -> EDIT dua .env di atas (GATEWAY_APPS key, IOT_BRIDGE_TOKEN) sebelum lanjut."
# Mosquitto password (bila belum ada)
if [ ! -f mosquitto/config/passwd ]; then
  echo "    -> Buat user MQTT: docker run --rm -v \$PWD/mosquitto/config:/c eclipse-mosquitto:2 mosquitto_passwd -b -c /c/passwd aircon_devices '<pass>'"
fi

echo "==> [6/6] Jalankan stack (profil: $PROFILE)"
docker compose --env-file "infra.env.$PROFILE" up -d --build
sleep 5
curl -fsS http://localhost:8080/health && echo "  <- gateway sehat" || echo "  !! gateway belum sehat, cek: docker compose logs -f messaging-gateway"
echo "==> SELESAI. Pantau RAM: docker stats --no-stream"
echo "    Naik ke 8GB nanti: resize VPS di panel BiznetGio, lalu: docker compose --env-file infra.env.8gb up -d"
