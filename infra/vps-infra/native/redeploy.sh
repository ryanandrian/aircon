#!/usr/bin/env bash
# Kirim update kode gateway/bridge dari repo lokal -> VPS-INFRA + restart service.
# Pakai: bash redeploy.sh   (jalankan dari mesin dev; butuh akses SSH ke VPS)
set -euo pipefail
KEY="${VPS_KEY:-$HOME/.ssh/aircon-ssh.pem}"
HOST="${VPS_HOST:-rad4ssh@103.127.138.16}"
REPO="$(cd "$(dirname "$0")/../../.." && pwd)"   # root repo aircon

echo "==> Kirim gateway src + iot-bridge"
scp -i "$KEY" -q "$REPO/apps/messaging-gateway/package.json" "$HOST:~/infra/messaging-gateway/"
scp -i "$KEY" -q -r "$REPO/apps/messaging-gateway/src" "$HOST:~/infra/messaging-gateway/"
scp -i "$KEY" -q "$REPO/apps/iot-bridge/package.json" "$REPO/apps/iot-bridge/index.mjs" "$HOST:~/infra/iot-bridge/"

echo "==> Restart service + health"
ssh -i "$KEY" "$HOST" '
  sudo systemctl restart aircon-gateway aircon-bridge
  sleep 5
  for s in aircon-gateway aircon-bridge; do printf "  %-16s %s\n" "$s" "$(systemctl is-active $s)"; done
  curl -fsS http://localhost:8080/health && echo ""
'
echo "==> SELESAI"
