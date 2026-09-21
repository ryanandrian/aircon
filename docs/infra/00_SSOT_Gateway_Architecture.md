# Aircon Gateway Integration Pointer

> This is an integration pointer, not a second gateway architecture SSOT.
>
> Canonical architecture SSOT: `../../lumite-gateway/docs/00_SSOT_Gateway_ControlPlane.md`
> Repository: `/home/rad/lumite-gateway`
> Control Plane: `https://wa-mqtt.lumite.biz.id/`

> **Canonical shared gateway:** Lumite Gateway owns the shared WhatsApp/MQTT/IoT gateway for all Lumite applications. Aircon is an integration client and does not supply gateway source to production.
>
> Canonical engine source: `/home/rad/lumite-gateway/gateway-engine/`.
> Canonical deployment is managed in the Lumite Gateway repository.
> Live runtime: `/home/rad4ssh/infra/messaging-gateway/` (generated; never edit manually).

## Verified boundary

| Area | Canonical location |
|---|---|
| Shared WhatsApp engine source/template | `/home/rad/lumite-gateway/gateway-engine/` |
| Shared WhatsApp engine live runtime | `/home/rad4ssh/infra/messaging-gateway/` |
| Live service | `aircon-gateway.service` on VPS `103.127.138.16` |
| Control Plane source | `/home/rad/lumite-gateway/` (`webui/`, `ops/`, `gateway-patches/`) |
| Aircon client relay | `src/lib/wa/gateway-relay.ts` |
| Aircon callback | `/api/wa/callback` |
| Aircon policy endpoint | `/api/wa/policy` |

## Aircon contract

Aircon is a gateway client. It does not load `whatsapp-web.js` directly.

- Gateway authentication uses the Aircon app key through server-only configuration.
- Session identity is namespaced with `appId=aircon` and `externalId=tenantId`.
- Existing endpoints used by Aircon are the shared gateway contract:
  - `POST /v1/wa/sessions/:externalId/init`
  - `GET /v1/wa/sessions/:externalId`
  - `DELETE /v1/wa/sessions/:externalId`
  - `POST /v1/wa/send`
- Gateway callbacks return session/message events to Aircon's `/api/wa/callback`.

## Change ownership

- Changes to the shared WhatsApp engine/API start in `/home/rad/lumite-gateway/gateway-engine/` and must be verified against every registered app.
- Changes to Control Plane, app registry, watchdog, or gateway operations start in `/home/rad/lumite-gateway`.
- Changes to Aircon UI/client integration start in `/home/rad/aircon`.
- Do not delete, fork, or create another gateway copy without first updating the canonical Lumite SSOT and this pointer.

## Decision rule for future sessions

- Pairing code pada engine: mulai di `/home/rad/lumite-gateway/gateway-engine/`.
- Perubahan UI/relay Aircon: mulai di `src/` repo Aircon.
- Perubahan Control Plane/registry/watchdog: mulai di repo `lumite-gateway`.
- Runtime `/home/rad4ssh/infra/messaging-gateway` hanya target deploy; bukan workspace edit.
- Jika fakta berbeda dari dokumen, hentikan perubahan dan audit source + service live terlebih dahulu.

For topology, runtime paths, registry, deployment, security, and cross-app invariants, read the canonical SSOT above. This file must not duplicate those details.
