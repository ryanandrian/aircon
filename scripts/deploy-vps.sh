#!/usr/bin/env bash
# Deploy app aircon ke VPS airconet.id (build lokal → kirim standalone).
# Pakai: bash scripts/deploy-vps.sh  (jalankan dari root repo, setelah pnpm build)
set -euo pipefail
cd "$(dirname "$0")/.."

KEY="$HOME/.ssh/airconet-app.pem"
H="truerad@103.127.135.132"
APPDIR="/opt/aircon-app"

echo "== 1. build standalone DENGAN ENV PRODUKSI (bukan .env lokal!) =="
# KRITIS: NEXT_PUBLIC_* di-'bakar' saat BUILD. Build laptop pakai .env lokal (sandbox/localhost)
# → bundle browser salah walau .env VPS benar. Solusi: build pakai .env PRODUKSI dari VPS.
echo "   menarik .env produksi dari VPS…"
scp -i "$KEY" -o StrictHostKeyChecking=accept-new "$H:$APPDIR/.env" /tmp/aircon-prod-build.env >/dev/null
# Sanity: pastikan env produksi (production, bukan sandbox)
if ! grep -q "^NEXT_PUBLIC_MIDTRANS_ENV=production" /tmp/aircon-prod-build.env; then
  echo "PERINGATAN: NEXT_PUBLIC_MIDTRANS_ENV bukan production di .env VPS — cek dulu."; fi
# Build dengan env produksi di-load (Next membaca process.env saat build)
set -a; . /tmp/aircon-prod-build.env; set +a
pnpm build >/dev/null 2>&1 || { echo "BUILD GAGAL"; shred -u /tmp/aircon-prod-build.env 2>/dev/null || rm -f /tmp/aircon-prod-build.env; exit 1; }
shred -u /tmp/aircon-prod-build.env 2>/dev/null || rm -f /tmp/aircon-prod-build.env

echo "== 1b. GUARD: bundle browser TIDAK boleh mengandung 'sandbox' (Midtrans production) =="
SBX=$(grep -roE "app.sandbox.midtrans.com" .next/static 2>/dev/null | wc -l || true)
if [ "$SBX" -gt 0 ]; then echo "GAGAL: bundle masih ber-sandbox ($SBX). Build env salah — batalkan."; exit 1; fi
echo "   OK: bundle production (0 sandbox)"

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
