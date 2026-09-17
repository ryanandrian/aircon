#!/usr/bin/env bash
set -euo pipefail
src="${1:?usage: backup-release.sh RELEASE_DIR [DEST] }"
dest="${2:-${HOME}/aircon-backups}"
[[ -d "$src" ]] || { echo "FAIL: release directory missing" >&2; exit 1; }
mkdir -p "$dest"
name="aircon-release-$(date -u +%Y%m%dT%H%M%SZ).tar.gz"
out="$dest/$name"
tar czf "$out" --exclude='.env' -C "$src" .
sha256sum "$out" > "$out.sha256"
printf 'release=%s\n' "$out"
cat "$out.sha256"
