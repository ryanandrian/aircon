#!/usr/bin/env bash
# Deploy Aircon — SATU fungsi permanen untuk semua sesi.
# Dipakai: bash scripts/deploy-vps.sh [ref]   (default HEAD)
# Gabungan 2 fakta terverifikasi:
#   (A) build harus pakai .env PRODUKSI VPS (fix 4cfc7dd) karena NEXT_PUBLIC_* dibakar saat build;
#   (B) layout release live = releases/<sha>/app/{server.js,.next,public,node_modules}
#       dan current -> releases/<sha>/app  (diverifikasi langsung dari VPS 2026-10-02).
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REF="${1:-HEAD}"
APP="${AIRCON_SSH_APP_PATH:-/opt/aircon-app}"
HOST="${AIRCON_SSH_HOST:-truerad@103.127.135.132}"
KEY="${AIRCON_SSH_KEY:-$HOME/.ssh/airconet-app.pem}"
WORK="$(mktemp -d /tmp/aircon-release.XXXXXX)"
PRODENV=""
PRODPORT="${AIRCON_BOOT_PORT:-43127}"
REMOTE_STAGE_PORT=43128
cleanup() {
  [ -n "$PRODENV" ] && { shred -u "$PRODENV" 2>/dev/null || rm -f "$PRODENV"; }
  rm -rf "$WORK"
}
trap cleanup EXIT

cd "$ROOT_DIR"
[ -z "$(git status --porcelain --untracked-files=all)" ] || { echo "FAIL: working tree tidak bersih" >&2; exit 1; }
COMMIT="$(git rev-parse "$REF^{commit}")"
[ "$(git rev-parse HEAD)" = "$COMMIT" ] || { echo "FAIL: ref harus sama dengan HEAD" >&2; exit 1; }
[ -f "$KEY" ] || { echo "FAIL: SSH key tidak ada: $KEY" >&2; exit 1; }

echo "==> 1/6 Install + generate (SEBELUM env produksi — NODE_ENV=production di .env VPS akan membuat pnpm membuang devDependencies/prisma)"
pnpm install --frozen-lockfile --ignore-scripts
pnpm prisma generate

echo "==> 2/6 Build dengan .env PRODUKSI (NEXT_PUBLIC_* dibakar saat build; pola fix 4cfc7dd)"
PRODENV="$WORK/prod.env"
scp -q -i "$KEY" "$HOST:$APP/.env" "$PRODENV"
set -a; . "$PRODENV"; set +a
pnpm exec next build

echo "==> 3/6 Staging artefak (materialize symlink pnpm, buang secret)"
BUILD="$WORK/build"; EXTRACT="$WORK/extract"; mkdir -p "$BUILD/.next" "$EXTRACT"
cp -rL .next/standalone/. "$BUILD/"
rm -rf "$BUILD/.next/static" "$BUILD/public"
cp -rL .next/static "$BUILD/.next/static"
cp -rL public "$BUILD/public"
# Next 16 runtime requires BOTH @swc/helpers/_ (CJS) and /esm (ESM).
# Standalone trace omits this devDependency; materialize the exact installed package.
SWC_HELPERS="$(node -p 'require.resolve("@swc/helpers/package.json")' 2>/dev/null || true)"
if [ -z "$SWC_HELPERS" ]; then
  SWC_HELPERS="$(find node_modules/.pnpm -path '*/node_modules/@swc/helpers/package.json' -print -quit)"
fi
[ -n "$SWC_HELPERS" ] && [ -f "$SWC_HELPERS" ] || { echo "FAIL: @swc/helpers package not found" >&2; exit 1; }
mkdir -p "$BUILD/node_modules/@swc/helpers"
cp -rL "$(dirname "$SWC_HELPERS")/." "$BUILD/node_modules/@swc/helpers/"
find "$BUILD" -type f \( -name '.env' -o -name '.env.*' -o -name 'id_rsa' -o -name 'id_ed25519' -o -name '*.pem' -o -name '*.key' \) -delete
[ -z "$(find "$BUILD" -type l -print -quit)" ] || { echo "FAIL: symlink tersisa di artefak" >&2; exit 1; }
[ -f "$BUILD/server.js" ] && [ -d "$BUILD/.next/static" ] && [ -d "$BUILD/public" ] || { echo "FAIL: standalone tidak lengkap" >&2; exit 1; }

echo "==> 4/6 Pack + boot-test lokal (byte persis yang akan di-upload)"
tar -czf "$WORK/release.tar.gz" -C "$BUILD" .
tar xzf "$WORK/release.tar.gz" -C "$EXTRACT"
if tar tzf "$WORK/release.tar.gz" | grep -Eiq '(^|/)(\.env|\.env\.|id_rsa|id_ed25519|.*\.pem|.*\.key)'; then
  echo "FAIL: ada file secret di artefak" >&2; exit 1
fi
(
  cd "$EXTRACT"
  PORT="$PRODPORT" HOSTNAME=127.0.0.1 NODE_ENV=production node server.js >"$WORK/boot-local.log" 2>&1 &
  PID=$!
  trap 'kill "$PID" 2>/dev/null || true' EXIT
  for _ in $(seq 1 40); do
    if curl -fsS "http://127.0.0.1:$PRODPORT/" >/dev/null 2>&1; then
      curl -fsS "http://127.0.0.1:$PRODPORT/login" >/dev/null; exit 0
    fi
    kill -0 "$PID" 2>/dev/null || { cat "$WORK/boot-local.log" >&2; exit 1; }
    sleep 1
  done
  cat "$WORK/boot-local.log" >&2; exit 1
)
HASH="$(sha256sum "$WORK/release.tar.gz" | awk '{print $1}')"
echo "ARTIFACT_SHA256=$HASH"

echo "==> 5/6 Upload + boot-test di VPS + switch atomic (dengan rollback otomatis)"
REMOTE="/tmp/aircon-release-$COMMIT.tar.gz"
scp -q -i "$KEY" "$WORK/release.tar.gz" "$HOST:$REMOTE"
ssh -i "$KEY" "$HOST" bash -s -- "$APP" "$COMMIT" "$REMOTE" "$HASH" "$REMOTE_STAGE_PORT" <<'REMOTE_SCRIPT'
set -Eeuo pipefail
APP="$1"; COMMIT="$2"; REMOTE="$3"; HASH="$4"; BOOT_PORT="$5"
test -f "$APP/.env"
OLD="$(readlink -f "$APP/current")"
test -n "$OLD" -a -d "$OLD"
test ! -e "$APP/releases/$COMMIT"
printf '%s  %s\n' "$HASH" "$(basename "$REMOTE")" | (cd "$(dirname "$REMOTE")" && sha256sum -c -)
STAGE="$(mktemp -d "$APP/.stage-$COMMIT.XXXXXX")"
BOOT_LOG="/tmp/aircon-boot-$COMMIT.log"
cleanup() { rm -rf "$STAGE" "$REMOTE" "$BOOT_LOG"; }
trap cleanup EXIT
tar xzf "$REMOTE" -C "$STAGE"
test -f "$STAGE/server.js" && test -d "$STAGE/.next/static" && test -d "$STAGE/public"
(
  cd "$STAGE"
  PORT="$BOOT_PORT" HOSTNAME=127.0.0.1 NODE_ENV=production node server.js >"$BOOT_LOG" 2>&1 &
  PID=$!
  trap 'kill "$PID" 2>/dev/null || true' EXIT
  ready=0
  for _ in $(seq 1 40); do
    if curl -fsS "http://127.0.0.1:$BOOT_PORT/" >/dev/null 2>&1; then
      curl -fsS "http://127.0.0.1:$BOOT_PORT/login" >/dev/null; ready=1; break
    fi
    kill -0 "$PID" 2>/dev/null || { cat "$BOOT_LOG" >&2; exit 1; }
    sleep 1
  done
  [ "$ready" = 1 ] || { cat "$BOOT_LOG" >&2; exit 1; }
)
mkdir -p "$APP/releases/$COMMIT/app"
cp -a "$STAGE/." "$APP/releases/$COMMIT/app/"
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
ln -sfn "$APP/releases/$COMMIT/app" "$APP/current.new"
mv -Tf "$APP/current.new" "$APP/current"
sudo -n systemctl restart aircon-app
sleep 5
test "$(sudo -n systemctl is-active aircon-app)" = active
curl -fsS http://127.0.0.1:3000/ >/dev/null
curl -fsS http://127.0.0.1:3000/login >/dev/null
test "$(cat "$APP/current/source-sha")" = "$COMMIT"
trap - EXIT
cleanup
echo "RELEASE=$COMMIT"
REMOTE_SCRIPT

echo "==> 6/6 Verifikasi live HTTPS"
for p in / /login; do
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 25 "https://app.airconet.id$p")"
  [ "$code" = 200 ] || { echo "FAIL: https://app.airconet.id$p -> $code" >&2; exit 1; }
  echo "  $p -> $code"
done
echo "PASS: deployed $COMMIT"
