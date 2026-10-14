#!/usr/bin/env bash
# ssot-status.sh — laporan status nyata Aircon (READ-ONLY).
# Dipakai sebagai "jalur verifikasi" oleh header dokumen aktif:
#   PROJECT_STATUS.md, SSOT_Checklist_Servis.md, RENCANA_INVOICING_AR.md, dll.
# TIDAK MENULIS apa pun; hanya membaca git + filesystem lokal.
# Kebenaran runtime TETAP dibaca dari VPS; script ini = snapshot lokal utk orientasi cepat.
set -uo pipefail
cd "$(dirname "$0")/.."

echo "=== AIRCON SSOT STATUS (lokal, read-only) ==="
echo "waktu           : $(date -Is)"
echo "HEAD            : $(git rev-parse --short HEAD)  $(git log -1 --format=%s | cut -c1-60)"
echo "origin/main     : $(git rev-parse --short origin/main)"
if [ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ]; then
  echo "sync            : HEAD == origin/main"
else
  echo "sync            : TERSELISIH — $(git rev-parse --short HEAD..origin/main 2>/dev/null | wc -l) commit di origin belum ditarik"
fi
echo "tree            : $(git status --porcelain | wc -l) perubahan belum di-commit"

echo
echo "=== DOKUMEN SSOT AKTIF (judul + penanda status) ==="
for f in docs/PROJECT_STATUS.md docs/SSOT_Checklist_Servis.md docs/SSOT_Alar_Invoicing.md docs/Payment_Dunning_SSOT.md docs/WA_Gateway_Integration_Pointer.md docs/BuildSpecPack_Part1_DataSchema_and_API.md docs/BuildSpecPack_Part2_ScreenSpec.md docs/BuildSpecPack_Part3_BusinessRules_and_Defaults.md; do
  [ -f "$f" ] || { echo "  $f  — TIDAK ADA"; continue; }
  title=$(grep -m1 '^#' "$f" | sed 's/^# *//' | cut -c1-62)
  if head -5 "$f" | grep -qi 'HISTORIS'; then penanda="HISTORIS"; else penanda="aktif"; fi
  printf "  %-58s %s | %s\n" "$f" "$penanda" "$title"
done

echo
echo "=== DOKUMEN BILLING: mana yang LIVE, mana arsip (jangan tertukar) ==="
echo "  tenant -> PELANGGAN (operasional) : docs/SSOT_Alar_Invoicing.md (AKTIF, dibuat 2026-10-14)"
echo "  tenant -> LUMITE  (langganan)     : docs/Payment_Dunning_SSOT.md (AKTIF, iPaymu-only)"
echo "  keputusan bisnis lama (arsip)      : docs/RENCANA_INVOICING_AR.md (HISTORIS; keputusan owner E3 tetap acuan)"

echo
echo "=== SKEMA & KODE (sumber kebenaran sesungguhnya) ==="
echo "  schema otoritatif : prisma/schema.prisma ($(grep -c '^model ' prisma/schema.prisma) model)"
echo "  migrasi           : $(ls prisma/migrations 2>/dev/null | grep -c '_') direktori"

echo
echo "=== CATATAN ==="
echo "  Runtime sebenarnya = VPS produksi (lihat PROJECT_STATUS bagian infra)."
echo "  Untuk deploy: bash scripts/deploy-vps.sh (jalur TUNGGAL — lihat AGENTS.md)."
