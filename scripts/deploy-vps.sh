#!/usr/bin/env bash
# Deploy only an immutable, pre-built release artifact. Production .env stays on VPS.
# Usage: bash scripts/deploy-vps.sh <exact-tag> <verified-artifact.tar.gz>
set -euo pipefail
cd "$(dirname "$0")/.."

ref="${1:?exact Git tag required}"
artifact="${2:?verified artifact required}"
[[ -z "$(git status --porcelain)" ]] || { echo "FAIL: working tree dirty" >&2; exit 1; }
commit=$(git rev-parse "$ref^{commit}")
git describe --exact-match --tags "$commit" >/dev/null || { echo "FAIL: ref is not an exact tag" >&2; exit 1; }
while read -r path; do
  [[ "$path" =~ ^(src/(app/(admin/keagenan|agen|reseller)|lib/(partner|services/subscription-service\.ts))|prisma/(schema\.prisma|migrations/)|tests/commission\.test\.ts|scripts/|docs/|\.github/) ]] || { echo "FAIL: scope $path" >&2; exit 1; }
done < <(git diff-tree --no-commit-id --name-only -r "$commit")
bash scripts/verify-artifact.sh "$artifact"

KEY="$HOME/.ssh/airconet-app.pem"
H="truerad@103.127.135.132"
ROOT="/opt/aircon-releases/$commit"
APP="/opt/aircon-app"
checksum="${artifact}.sha256"
sha256sum "$artifact" > "$checksum"
scp -i "$KEY" "$artifact" "$checksum" "$H:/tmp/aircon-release-$commit.tar.gz" "$H:/tmp/aircon-release-$commit.tar.gz.sha256"
ssh -i "$KEY" "$H" "set -euo pipefail
  mkdir -p '$ROOT'
  sha256sum -c /tmp/aircon-release-$commit.tar.gz.sha256
  tar xzf /tmp/aircon-release-$commit.tar.gz -C '$ROOT'
  test -f '$ROOT/server.js'
  test -d '$ROOT/.next/static'
  test -d '$ROOT/public'
  ln -sfn '$ROOT' '$APP/current.new'
  mv -Tf '$APP/current.new' '$APP/current'
  systemctl restart aircon-app
  sleep 5
  test \"\$(systemctl is-active aircon-app)\" = active
  curl -fsS http://127.0.0.1:3000/ >/dev/null
  echo RELEASE=$commit"
echo "PASS: deployed $commit"
