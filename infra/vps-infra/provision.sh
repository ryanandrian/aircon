#!/usr/bin/env bash
# DEPRECATED: Aircon is not the production source or deploy authority for the
# shared Lumite WhatsApp/MQTT/IoT gateway.
set -euo pipefail
cat >&2 <<'MSG'
BLOCKED: legacy Aircon VPS provisioning is disabled.
Use /home/rad/lumite-gateway and its exact-SHA release/deployment procedure.
MSG
exit 2
