#!/usr/bin/env bash
# Rakit .env PRODUKSI VPS dari sumber terverifikasi. Tidak menebak: nilai diambil apa adanya.
# Sumber: .env (lokal) + .secrets/vps-infra-credentials.txt + nilai domain/SMTP tetap.
set -euo pipefail
cd /home/rad/aircon
ENVF=".env"
SEC=".secrets/vps-infra-credentials.txt"
OUT="/tmp/aircon-prod.env"

val() { grep -E "^$1=" "$2" 2>/dev/null | head -1 | cut -d= -f2-; }
# Ambil dari .env dulu, fallback .secrets
pick() { local v; v=$(val "$1" "$ENVF"); [ -z "$v" ] && v=$(val "$1" "$SEC"); printf '%s' "$v"; }

{
echo "# AIRCON APP — ENV PRODUKSI VPS (dirakit otomatis dari sumber terverifikasi)"
echo "NODE_ENV=production"
echo "NEXT_PUBLIC_APP_URL=https://app.airconet.id"
echo "UNIT_CODE_BASE_URL=https://app.airconet.id"
echo ""
echo "# Supabase (auth anon + DB via Prisma)"
echo "NEXT_PUBLIC_SUPABASE_URL=$(pick NEXT_PUBLIC_SUPABASE_URL)"
echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=$(pick NEXT_PUBLIC_SUPABASE_ANON_KEY)"
echo "DATABASE_URL=$(pick DATABASE_URL)"
echo "DIRECT_URL=$(pick DIRECT_URL)"
echo ""
echo "# Midtrans (dua kunci permanen; saklar MIDTRANS_ENV memilih — sesuai kode midtrans-client.ts)"
echo "MIDTRANS_ENV=production"
echo "NEXT_PUBLIC_MIDTRANS_ENV=production"
echo "MIDTRANS_SANDBOX_SERVER_KEY=$(pick MIDTRANS_SANDBOX_SERVER_KEY)"
echo "MIDTRANS_PRODUCTION_SERVER_KEY=$(pick MIDTRANS_PRODUCTION_SERVER_KEY)"
echo "NEXT_PUBLIC_MIDTRANS_PRODUCTION_CLIENT_KEY=$(pick NEXT_PUBLIC_MIDTRANS_PRODUCTION_CLIENT_KEY)"
echo "NEXT_PUBLIC_MIDTRANS_SANDBOX_CLIENT_KEY=$(pick NEXT_PUBLIC_MIDTRANS_SANDBOX_CLIENT_KEY)"
echo "MIDTRANS_MERCHANT_ID=$(pick MIDTRANS_MERCHANT_ID)"
echo ""
echo "# S3 BiznetGio"
echo "S3_ENDPOINT=$(pick S3_ENDPOINT)"
echo "S3_REGION=$(pick S3_REGION)"
echo "S3_BUCKET=$(pick S3_BUCKET)"
echo "S3_ACCESS_KEY_ID=$(pick S3_ACCESS_KEY_ID)"
echo "S3_SECRET_ACCESS_KEY=$(pick S3_SECRET_ACCESS_KEY)"
echo "S3_PUBLIC_BASE_URL=$(pick S3_PUBLIC_BASE_URL)"
echo "S3_FORCE_PATH_STYLE=$(pick S3_FORCE_PATH_STYLE)"
echo ""
echo "# WA Gateway"
echo "WA_GATEWAY_URL=$(pick WA_GATEWAY_URL)"
echo "WA_GATEWAY_KEY=$(pick WA_GATEWAY_KEY)"
echo "WA_GATEWAY_CALLBACK_SECRET=$(pick WA_GATEWAY_CALLBACK_SECRET)"
echo "WA_SAFE_MODE=0"
echo "WA_SEND_ALLOWLIST="
echo ""
echo "# Email SMTP (Lumite)"
echo "SMTP_HOST=mail.lumite.biz.id"
echo "SMTP_PORT=465"
echo "SMTP_USER=admin@lumite.biz.id"
echo "SMTP_PASS=$(pick SMTP_PASS)"
echo 'SMTP_FROM="Lumite <admin@lumite.biz.id>"'
echo ""
echo "# IoT + Secrets"
echo "IOT_BRIDGE_TOKEN=$(pick IOT_BRIDGE_TOKEN)"
echo "PARTNER_ENC_KEY=$(pick PARTNER_ENC_KEY)"
echo "SESSION_SECRET=$(pick SESSION_SECRET)"
echo "CRON_SECRET=$(pick CRON_SECRET)"
} > "$OUT"
chmod 600 "$OUT"

# Laporan kelengkapan (nilai TIDAK ditampilkan)
echo "=== Kelengkapan .env produksi (nilai disembunyikan) ==="
while IFS='=' read -r k v; do
  case "$k" in ""|\#*) continue;; esac
  if [ -n "$v" ]; then echo "  $k = OK"; else echo "  $k = KOSONG"; fi
done < "$OUT"
echo ""
echo "File: $OUT ($(wc -l < "$OUT") baris)"
