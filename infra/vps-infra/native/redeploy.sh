#!/usr/bin/env bash
# DEPRECATED: shared Lumite Gateway deployment no longer originates from Aircon.
#
# Canonical source and release authority:
#   /home/rad/lumite-gateway
#   its exact-SHA release pipeline
#
# This compatibility guard intentionally fails closed so an old operator cannot
# overwrite the shared Lumite gateway from the Aircon repository.
set -euo pipefail
cat >&2 <<'MSG'
BLOCKED: Aircon no longer deploys the shared Lumite Gateway.
Use the exact-SHA release procedure in /home/rad/lumite-gateway:
  deploy/build-release.sh
  deploy/verify-release.sh
  deploy/package-release.sh
  deploy/install-release.sh
MSG
exit 2
