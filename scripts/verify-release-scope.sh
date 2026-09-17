#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

ref="${1:-HEAD}"
if [[ -n "$(git status --porcelain)" ]]; then
  echo "FAIL: working tree dirty" >&2
  exit 1
fi
if ! git rev-parse --verify "$ref^{commit}" >/dev/null 2>&1; then
  echo "FAIL: invalid commit/tag: $ref" >&2
  exit 1
fi
commit=$(git rev-parse "$ref^{commit}")
if [[ "$ref" != refs/tags/* ]] && ! git describe --exact-match --tags "$commit" >/dev/null 2>&1; then
  echo "FAIL: release ref must be an exact tag" >&2
  exit 1
fi
allowed='^(src/(app/(admin/keagenan|agen|reseller)|lib/(partner|services/subscription-service\.ts))|prisma/(schema\.prisma|migrations/)|tests/commission\.test\.ts|scripts/|docs/|\.github/)'
for path in $(git diff-tree --no-commit-id --name-only -r "$commit"); do
  if [[ ! "$path" =~ $allowed ]]; then
    echo "FAIL: path outside commission/release allowlist: $path" >&2
    exit 1
  fi
done
echo "PASS: scope $commit"
