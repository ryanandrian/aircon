#!/usr/bin/env bash
set -euo pipefail
artifact="${1:?usage: verify-artifact.sh ARTIFACT.tar.gz}"
[[ -f "$artifact" ]] || { echo "FAIL: artifact not found" >&2; exit 1; }
listing=$(tar tzf "$artifact")
if grep -Eq '(^|/)(\.env|\.env\.|.*credentials.*|.*secret.*)' <<<"$listing"; then
  echo "FAIL: secret/env file in artifact" >&2; exit 1
fi
grep -Eq '^\./server\.js$|^server\.js$' <<<"$listing" || { echo "FAIL: missing server.js" >&2; exit 1; }
grep -Eq '^\./\.next/static/|^\.next/static/' <<<"$listing" || { echo "FAIL: missing .next/static" >&2; exit 1; }
grep -Eq '^\./public/|^public/' <<<"$listing" || { echo "FAIL: missing public" >&2; exit 1; }
sha256sum "$artifact"
echo "PASS: artifact structure and secret exclusion"
