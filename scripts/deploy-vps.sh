#!/usr/bin/env bash
# Deploy app aircon ke VPS airconet.id (build lokal → kirim standalone).
# Pakai: bash scripts/deploy-vps.sh  (jalankan dari root repo, setelah pnpm build)
set -euo pipefail
cd "$(dirname "$0")/.."

KEY="$HOME/.ssh/airconet-app.pem"
H="truerad@103.127.135.132"
APPDIR="/opt/aircon-app"

echo "== 1. build standalone =="
pnpm build >/dev/null 2>&1 || { echo "BUILD GAGAL"; exit 1; }

echo "== 2. siapkan bundle (static+public+fix @swc/helpers esm) =="
rm -rf .next/standalone/.next/static .next/standalone/public
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public 2>/dev/null || true
# FIX pnpm tracing: @swc/helpers/esm sering hilang → MODULE_NOT_FOUND saat boot
SRC=$(find node_modules/.pnpm -type d -path "*@swc+helpers*/node_modules/@swc/helpers" 2>/dev/null | head -1)
DST=$(find .next/standalone/node_modules/.pnpm -type d -path "*@swc+helpers*/node_modules/@swc/helpers" 2>/dev/null | head -1)
if [ -n "$SRC" ] && [ -n "$DST" ] && [ ! -d "$DST/esm" ]; then cp -r "$SRC/esm" "$DST/esm"; echo "   @swc/helpers/esm disalin"; fi

echo "== 3. tar + kirim (EXCLUDE .env — jangan timpa .env produksi VPS!) =="
tar czf /tmp/aircon-app.tar.gz --exclude='./.env' --exclude='./.env.*' -C .next/standalone .
scp -i "$KEY" -o StrictHostKeyChecking=accept-new /tmp/aircon-app.tar.gz "$H:/tmp/" >/dev/null

echo "== 4. ekstrak (pertahankan .env) + restart =="
ssh -i "$KEY" "$H" "set -e
  cd $APPDIR
  # simpan .env, bersihkan kode lama (kecuali .env & skrip), ekstrak baru
  find . -maxdepth 1 -mindepth 1 ! -name '.env' ! -name 'check-env.sh' ! -name 'run-cron.sh' -exec rm -rf {} +
  tar xzf /tmp/aircon-app.tar.gz && rm /tmp/aircon-app.tar.gz
  bash check-env.sh
  sudo systemctl restart aircon-app
  sleep 5
  echo status: \$(systemctl is-active aircon-app)"
rm -f /tmp/aircon-app.tar.gz

echo "== 5. verifikasi HTTPS =="
for p in / /login; do
  echo "  https://app.airconet.id$p → $(curl -s -o /dev/null -w '%{http_code}' --max-time 15 https://app.airconet.id$p)"
done
echo "DEPLOY SELESAI"
