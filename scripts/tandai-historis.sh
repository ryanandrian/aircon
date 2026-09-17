#!/usr/bin/env bash
# tandai-historis.sh — Prepend banner "HISTORIS" ke dokumen arsip (ADITIF, in-place, IDEMPOTEN).
# Tidak memindah/rename/hapus. Tidak menyentuh dokumen HIDUP. Konten asli dipertahankan 100%.
set -euo pipefail
cd "$(dirname "$0")/../docs"

MARKER="HISTORIS — bukan status terkini"
read -r -d '' BANNER <<'EOF' || true
> ⚠️ **HISTORIS — bukan status terkini.** Dokumen ini artefak titik-waktu / keputusan lama.
> Beberapa fakta di dalamnya (hosting, provider pembayaran, URL, progres) MUNGKIN sudah berubah.
> **Kebenaran terkini:** `docs/PROJECT_STATUS.md` + jalankan `bash scripts/ssot-status.sh` (read-only).
> Jangan mengambil keputusan dari file ini tanpa memverifikasi ke sumber di atas.

EOF

HIST=(
  AC_Service_Growth_OS_Master_Business_Plan_Evaluated_v1.0.md
  AC_Service_Growth_OS_PRD_and_Technical_Specification_v1.0.md
  AC_Service_Growth_OS_PRD_and_Technical_Specification_v1.1_money-first.md
  BuildSpecPack_Part2_ScreenSpec.md
  Differentiation_and_Domain_Strategy.md
  MQTT_Decision_v3_Mosquitto_VPS.md
  Hosting_Architecture_Decision.md
  TechStack_v2_Supabase_Reconsidered.md
  Portfolio_Shared_Gateway_Architecture.md
  Capacity_Planning.md
  GoToMarket_Strategy_ROI.md
  Auth_Decision_Phone_PIN.md
  Auth_Migration_Plan_Google_SelfHost.md
  Panduan_OAuth_Branding_Google.md
  PLAN_UNIT_IDENTITY_QR.md
  RENCANA_INVOICING_AR.md
  BATON_INVOICING_AR.md
  Dokumen_Keuangan_Faktur_Kwitansi.md
  LAPORAN_BUG_TESTING_FINAL.md
  CHECKLIST_TES_DEVICE.md
)

for f in "${HIST[@]}"; do
  if [ ! -f "$f" ]; then echo "SKIP (tak ada): $f"; continue; fi
  if head -6 "$f" | grep -qF "$MARKER"; then echo "SUDAH ditandai: $f"; continue; fi
  before=$(wc -l < "$f")
  tmp="$(mktemp)"
  { printf '%s\n' "$BANNER"; cat "$f"; } > "$tmp"
  mv "$tmp" "$f"
  after=$(wc -l < "$f")
  echo "OK: $f  ($before -> $after baris, +$((after-before)))"
done
echo "Selesai. (Additive: hanya menambah baris banner; konten asli utuh.)"
