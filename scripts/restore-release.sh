#!/usr/bin/env bash
set -euo pipefail
archive="${1:?usage: restore-release.sh ARCHIVE.tar.gz TARGET_DIR}"
target="${2:?usage: restore-release.sh ARCHIVE.tar.gz TARGET_DIR}"
[[ -f "$archive" ]] || { echo "FAIL: archive missing" >&2; exit 1; }
[[ ! -e "$target" ]] || { echo "FAIL: target must be isolated and absent: $target" >&2; exit 1; }
mkdir -p "$target"
tar xzf "$archive" -C "$target"
[[ -f "$target/server.js" ]] || { echo "FAIL: restored server.js missing" >&2; exit 1; }
[[ -d "$target/.next/static" && -d "$target/public" ]] || { echo "FAIL: restored assets missing" >&2; exit 1; }
echo "PASS: restored isolated release at $target"
