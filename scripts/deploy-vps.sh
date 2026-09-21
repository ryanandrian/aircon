#!/usr/bin/env bash
# Build, test, and deploy one exact Aircon release to the existing VPS layout.
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REF="${1:-HEAD}"
APP="${AIRCON_SSH_APP_PATH:-/opt/aircon-app}"
HOST="${AIRCON_SSH_HOST:-truerad@103.127.135.132}"
KEY="${AIRCON_SSH_KEY:-$HOME/.ssh/airconet-app.pem}"
WORK="$(mktemp -d /tmp/aircon-release.XXXXXX)"
PORT="${AIRCON_BOOT_PORT:-43127}"
trap 'rm -rf "$WORK"' EXIT

cd "$ROOT_DIR"
[[ -z "$(git status --porcelain --untracked-files=all)" ]] || { echo "FAIL: working tree is not clean" >&2; exit 1; }
COMMIT="$(git rev-parse "$REF^{commit}")"
[[ "$(git rev-parse HEAD)" == "$COMMIT" ]] || { echo "FAIL: REF must equal local HEAD" >&2; exit 1; }
[[ -f "$KEY" ]] || { echo "FAIL: SSH key not found: $KEY" >&2; exit 1; }

BUILD="$WORK/build"
EXTRACT="$WORK/extract"
mkdir -p "$BUILD/.next" "$EXTRACT"

echo "==> Build $COMMIT"
pnpm install --frozen-lockfile --ignore-scripts
pnpm prisma generate
pnpm exec next build

# Materialize the standalone tree: no pnpm symlinks are allowed in the artifact.
cp -aL .next/standalone/. "$BUILD/"
rm -rf "$BUILD/.next/static" "$BUILD/public"
cp -aL .next/static "$BUILD/.next/static"
cp -aL public "$BUILD/public"
# Next.js tracing can copy the local env file into standalone; remove it explicitly.
rm -f "$BUILD/.env" "$BUILD"/.env.*
find "$BUILD" \( -name '.env' -o -name '.env.*' -o -iname '*credential*' -o -iname '*secret*' \) -exec rm -rf {} +
if find "$BUILD" \( -name '.env' -o -name '.env.*' -o -iname '*credential*' -o -iname '*secret*' \) -print -quit | grep -q .; then
  echo "FAIL: secret-like file remains in artifact staging" >&2
  exit 1
fi
HELPER="$(find node_modules/.pnpm -type d -path '*@swc+helpers*/node_modules/@swc/helpers' | head -1)"
if [[ -n "$HELPER" ]]; then
  while IFS= read -r traced; do
    rm -rf "$traced"
    mkdir -p "$(dirname "$traced")"
    cp -aL "$HELPER" "$traced"
  done < <(find "$BUILD/node_modules/.pnpm" -type d -path '*@swc+helpers*/node_modules/@swc/helpers')
fi
[[ -f "$BUILD/server.js" && -d "$BUILD/.next/static" && -d "$BUILD/public" ]] || { echo "FAIL: incomplete standalone output" >&2; exit 1; }
[[ -z "$(find "$BUILD" -type l -print -quit)" ]] || { echo "FAIL: symlink remains in artifact" >&2; exit 1; }

# Package, extract the exact tar, and boot-test the extracted bytes.
tar -czf "$WORK/release.tar.gz" -C "$BUILD" .
tar xzf "$WORK/release.tar.gz" -C "$EXTRACT"
LISTING="$(tar tzf "$WORK/release.tar.gz")"
if grep -Eiq '(^|/)(\.env|\.env\.|.*credential.*|.*secret.*)' <<<"$LISTING"; then
  echo "FAIL: secret-like file in artifact" >&2; exit 1
fi
(
  cd "$EXTRACT"
  PORT="$PORT" HOSTNAME=127.0.0.1 NODE_ENV=production node server.js >"$WORK/server.log" 2>&1 &
  PID=$!
  trap 'kill "$PID" 2>/dev/null || true' EXIT
  for _ in $(seq 1 30); do
    if curl -fsS "http://127.0.0.1:$PORT/" >/dev/null 2>&1; then
      curl -fsS "http://127.0.0.1:$PORT/login" >/dev/null
      exit 0
    fi
    kill -0 "$PID" 2>/dev/null || { cat "$WORK/server.log" >&2; exit 1; }
    sleep 1
  done
  cat "$WORK/server.log" >&2
  exit 1
)
HASH="$(sha256sum "$WORK/release.tar.gz" | awk '{print $1}')"
echo "ARTIFACT_SHA256=$HASH"

# Stage, verify, boot-test, then switch atomically on the VPS.
REMOTE="/tmp/aircon-release-$COMMIT.tar.gz"
scp -i "$KEY" "$WORK/release.tar.gz" "$HOST:$REMOTE"
ssh -i "$KEY" "$HOST" bash -s -- "$APP" "$COMMIT" "$REMOTE" "$HASH" <<'REMOTE_SCRIPT'
set -Eeuo pipefail
APP="$1"
COMMIT="$2"
REMOTE="$3"
HASH="$4"
test -f "$APP/.env"
OLD="$(readlink -f "$APP/current")"
test -n "$OLD" -a -d "$OLD"
test ! -e "$APP/releases/$COMMIT"
printf '%s  %s\n' "$HASH" "$(basename "$REMOTE")" | sha256sum -c -
STAGE="$(mktemp -d "$APP/.stage-$COMMIT.XXXXXX")"
BOOT_LOG="/tmp/aircon-boot-$COMMIT.log"
cleanup() { rm -rf "$STAGE" "$REMOTE" "$BOOT_LOG"; }
trap cleanup EXIT
tar xzf "$REMOTE" -C "$STAGE"
test -f "$STAGE/server.js" -a -d "$STAGE/.next/static" -a -d "$STAGE/public"
(
  cd "$STAGE"
  PORT=43128 HOSTNAME=127.0.0.1 NODE_ENV=production node server.js >"$BOOT_LOG" 2>&1 &
  PID=$!
  trap 'kill "$PID" 2>/dev/null || true' EXIT
  ready=0
  for _ in $(seq 1 30); do
    if curl -fsS http://127.0.0.1:43128/ >/dev/null 2>&1; then
      curl -fsS http://127.0.0.1:43128/login >/dev/null
      ready=1
      break
    fi
    kill -0 "$PID" 2>/dev/null || { cat "$BOOT_LOG" >&2; exit 1; }
    sleep 1
  done
  test "$ready" = 1
)
mkdir -p "$APP/releases/$COMMIT/app/.next/standalone"
cp -a "$STAGE/." "$APP/releases/$COMMIT/app/.next/standalone/"
printf '%s\n' "$COMMIT" > "$APP/releases/$COMMIT/source-sha"
rollback() {
  rc=$?
  if [ "$rc" -ne 0 ]; then
    ln -sfn "$OLD" "$APP/current.rollback"
    mv -Tf "$APP/current.rollback" "$APP/current"
    sudo -n systemctl restart aircon-app || true
  fi
  exit "$rc"
}
trap rollback EXIT
ln -sfn "$APP/releases/$COMMIT/app/.next/standalone" "$APP/current.new"
mv -Tf "$APP/current.new" "$APP/current"
sudo -n systemctl restart aircon-app
sleep 5
test "$(sudo -n systemctl is-active aircon-app)" = active
curl -fsS http://127.0.0.1:3000/ >/dev/null
curl -fsS http://127.0.0.1:3000/login >/dev/null
trap - EXIT
cleanup
echo "RELEASE=$COMMIT"
REMOTE_SCRIPT
echo "PASS: deployed $COMMIT"
