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
remote_commit=$(git ls-remote origin "refs/tags/$ref" "refs/tags/$ref^{}" | awk -v tag="refs/tags/$ref" '$2 == tag || $2 == tag "^{}" { print $1 }' | tail -1)
if [[ "$remote_commit" != "$commit" ]]; then
  echo "FAIL: exact tag is not pushed to origin" >&2
  exit 1
fi

if git diff-tree --no-commit-id --name-only -r "$commit" | grep -E '(^|/)(\.env|.*\.pem$|.*credentials.*|.*secret.*)' >/dev/null; then
  echo "FAIL: release commit contains secret-like file" >&2
  exit 1
fi

echo "PASS: release $commit is clean, tagged, pushed, and secret-free"
