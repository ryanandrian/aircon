#!/usr/bin/env bash
# Deploy an immutable standalone artifact to the existing Aircon VPS layout.
# Usage: bash scripts/deploy-vps.sh <exact-tag> <verified-artifact.tar.gz>
set -euo pipefail
cd "$(dirname "$0")/.."

ref="${1:?exact Git tag required}"
artifact="${2:?verified artifact required}"
[[ -f "$artifact" ]] || { echo "FAIL: artifact not found" >&2; exit 1; }
[[ -z "$(git status --porcelain)" ]] || { echo "FAIL: working tree dirty" >&2; exit 1; }

commit=$(git rev-parse "$ref^{commit}")
bash scripts/verify-release-scope.sh "$ref"
bash scripts/verify-artifact.sh "$artifact"

KEY="${AIRCON_SSH_KEY:-$HOME/.ssh/airconet-app.pem}"
H="${AIRCON_SSH_HOST:-truerad@103.127.135.132}"
APP="/opt/aircon-app"
ROOT="$APP/releases/$commit"
checksum="${artifact}.sha256"
remote_artifact="/tmp/aircon-release-$commit.tar.gz"
remote_checksum="/tmp/aircon-release-$commit.tar.gz.sha256"
artifact_hash=$(sha256sum "$artifact" | awk '{print $1}')
printf '%s  %s\n' "$artifact_hash" "$(basename "$remote_artifact")" > "$checksum"
scp -i "$KEY" "$artifact" "$H:$remote_artifact"
scp -i "$KEY" "$checksum" "$H:$remote_checksum"
ssh -i "$KEY" "$H" "set -euo pipefail
  test -d '$APP/releases'
  test -f '$APP/.env'
  old=\$(readlink -f '$APP/current')
  test -n \"\$old\" -a -d \"\$old\"
  test \"\$(sudo -n systemctl is-active aircon-app)\" = active
  mkdir -p '$ROOT/app/.next/standalone'
  cd /tmp
  sha256sum -c 'aircon-release-$commit.tar.gz.sha256'
  cd - >/dev/null
  tar xzf /tmp/aircon-release-$commit.tar.gz -C '$ROOT/app/.next/standalone'
  test -f '$ROOT/app/.next/standalone/server.js'
  test -d '$ROOT/app/.next/standalone/.next/static'
  test -d '$ROOT/app/.next/standalone/public'
  printf '%s\\n' '$commit' > '$ROOT/source-sha'

  rollback() {
    rc=\$?
    if [ \$rc -ne 0 ] && [ -n \"\${old:-}\" ] && [ -d \"\$old\" ]; then
      ln -sfn \"\$old\" '$APP/current.rollback'
      mv -Tf '$APP/current.rollback' '$APP/current'
      sudo -n systemctl restart aircon-app || true
      echo \"FAIL: deployment rolled back to \$old\" >&2
    fi
    exit \$rc
  }
  trap rollback EXIT

  ln -sfn '$ROOT/app/.next/standalone' '$APP/current.new'
  mv -Tf '$APP/current.new' '$APP/current'
  sudo -n systemctl restart aircon-app
  sleep 5
  test \"\$(sudo -n systemctl is-active aircon-app)\" = active
  curl -fsS http://127.0.0.1:3000/ >/dev/null
  curl -fsS http://127.0.0.1:3000/login >/dev/null
  trap - EXIT
  rm -f /tmp/aircon-release-$commit.tar.gz /tmp/aircon-release-$commit.tar.gz.sha256
  echo RELEASE=$commit
"
echo "PASS: deployed $commit"