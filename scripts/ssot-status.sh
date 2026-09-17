#!/usr/bin/env bash
# ssot-status.sh — Cek KENYATAAN produksi Aircon (READ-ONLY). Tidak mengubah apa pun.
# Tujuan: status = fakta terverifikasi, bukan tulisan tangan yang cepat usang.
# Pakai: bash scripts/ssot-status.sh
# Butuh: SSH key app VPS (~/.ssh/airconet-app.pem) untuk cek env; sisanya via HTTPS publik.
set -uo pipefail

APP_URL="https://app.airconet.id"
GW_URL="https://gw.lumite.biz.id"
APP_VPS="truerad@103.127.135.132"
APP_KEY="$HOME/.ssh/airconet-app.pem"
ENV_FILE="/opt/aircon-app/.env"

line(){ printf '%s\n' "----------------------------------------"; }
code(){ curl -s -o /dev/null -w "%{http_code}" --max-time 15 "$1" 2>/dev/null; }

echo "AIRCON — STATUS KENYATAAN (read-only)  $(date '+%Y-%m-%d %H:%M %Z')"
line
echo "[HOSTING / APP]"
echo "  app.airconet.id (root)      : HTTP $(code "$APP_URL/")"
echo "  /login                      : HTTP $(code "$APP_URL/login")"
echo "  /manifest.json (PWA)        : HTTP $(code "$APP_URL/manifest.json")"

line
echo "[PEMBAYARAN / IPAYMU]  (flag saja, bukan secret)"
if [ -f "$APP_KEY" ]; then
  ssh -i "$APP_KEY" -o ConnectTimeout=12 -o StrictHostKeyChecking=accept-new "$APP_VPS" \
    "sudo grep -E '^(PAYMENT_GATEWAY|IPAYMU_ENV)=' $ENV_FILE 2>/dev/null; \
     sudo grep -E '^IPAYMU_(SANDBOX|PRODUCTION)_(VA|API_KEY)=' $ENV_FILE 2>/dev/null | sed -E 's/=.+/= [TERISI]/; t; s/=.*/= [KOSONG]/'; \
     echo \"  service aircon-app          : \$(systemctl is-active aircon-app 2>/dev/null)\"" \
    2>/dev/null | sed 's/^/  /' || echo "  (tak bisa SSH ke VPS app — cek key/jaringan)"
else
  echo "  (lewati: $APP_KEY tak ada — jalankan dari mesin yang punya key)"
fi
echo "  webhook GET (harus 405)     : HTTP $(code "$APP_URL/api/billing/ipaymu-webhook")"

line
echo "[GATEWAY WA + MQTT]"
echo "  gw /health                  : HTTP $(code "$GW_URL/health")"
echo "  gw /integration-guide.md    : HTTP $(code "$GW_URL/integration-guide.md")"
echo "  gw /mqtt-reference.md        : HTTP $(code "$GW_URL/mqtt-reference.md")"
SESS=$(curl -s --max-time 15 "$GW_URL/health" 2>/dev/null | grep -oE '"sessions":[0-9]+' || echo "?")
echo "  sesi WA aktif               : ${SESS}"

line
echo "[CRON TERLINDUNGI]  (harus 401 tanpa secret)"
echo "  /api/cron/reminders         : HTTP $(code "$APP_URL/api/cron/reminders")"
echo "  /api/cron/dunning           : HTTP $(code "$APP_URL/api/cron/dunning")"
line
echo "Catatan: skrip ini READ-ONLY. Bandingkan output dgn docs/PROJECT_STATUS.md."
echo "Bila beda -> PERBAIKI dokumen (kenyataan yang menang), jangan sebaliknya."
