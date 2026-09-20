# WhatsApp Tenant Pairing-Code Alternative Implementation Plan

> Status: PLAN / AUDIT BASELINE. No implementation, migration, runtime mutation, or deployment has been performed.

**Goal:** Add a mobile-only WhatsApp tenant registration path using WhatsApp pairing code while preserving the existing QR path for laptop/PC users.

**Architecture:** Pairing code is an additive capability in the shared WhatsApp engine. QR remains the default existing flow and explicit fallback. Aircon remains a gateway client and only treats `ready + verified phone` as proof of ownership.

**Tech Stack:** Aircon Next.js/TypeScript/Prisma; shared Node ESM gateway; `whatsapp-web.js` 1.34.7; Lumite exact-SHA release pipeline; systemd runtime with persistent `.wwebjs_auth` outside release artifacts.

---

## Current verified baseline

### Aircon

- Tenant UI: `src/app/app/pengaturan/wa-connect.tsx`
- Tenant actions: `src/app/app/pengaturan/actions.ts`
- Gateway relay: `src/lib/wa/gateway-relay.ts`
- Identity ownership: `src/lib/services/wa-identity-service.ts`
- Callback: `src/app/api/wa/callback/route.ts`
- Verified number migration: `prisma/migrations/20260909060000_tenant_wa_verified_phone/migration.sql`
- Current contract uses `externalId = tenantId` and polls status approximately every 3 seconds.
- Existing anti-duplicate rule: one verified WhatsApp number cannot belong to two tenants.
- `Tenant.phone` is business identity input; `Tenant.waVerifiedPhone` is gateway-verified identity and must remain separate.

### Shared gateway

The current engine implementation audited in both repositories is QR-only:

- `WaManager.initSession()` in `gateway-engine/src/wa-manager.js`
- `WaManager.sessionStatus()` in the same file
- REST routes in `gateway-engine/src/server.js`:
  - `POST /v1/wa/sessions/:externalId/init`
  - `GET /v1/wa/sessions/:externalId`
  - `DELETE /v1/wa/sessions/:externalId`
- Existing session states include `ready`, `qr`, `phone`, and `authenticating`.
- Existing safety features that must not regress:
  - `LocalAuth` persistence;
  - stale Chromium lock cleanup;
  - zombie session detection/sweep;
  - rehydrate after restart;
  - persistent queue;
  - timeout around send operations;
  - anti-ban policy/throttle/warm-up/quiet hours;
  - app/externalId namespace isolation;
  - campaign and Aircon session coexistence.

### Pairing capability

Installed and locked `whatsapp-web.js` version is `1.34.7`. The library contains:

- `Client.requestPairingCode(phoneNumber, showNotification, intervalMs)`;
- `Client.cancelPairingCode()`;
- `code` event;
- `pairWithPhoneNumber` initialization option.

No gateway pairing implementation or API contract exists yet.

---

## Blocking issue before implementation

Canonical engine ownership is inconsistent and must be reconciled first.

Evidence:

- Aircon docs identify `/home/rad/aircon/apps/messaging-gateway` as engine source/template.
- Lumite `docs/SOP_Release_Deployment.md` and release tooling identify `lumite-gateway/gateway-engine/` as canonical release source.
- `lumite-gateway/gateway-engine` and Aircon `apps/messaging-gateway` differ in `src/auth.js`, `src/server.js`, and `src/wa-manager.js`.
- `lumite-gateway/gateway-patches` is also not byte-identical to `gateway-engine`.
- Aircon `infra/vps-infra/native/redeploy.sh` still performs a direct source copy, conflicting with the newer Lumite immutable exact-SHA release procedure.
- Live runtime is `/home/rad4ssh/infra/messaging-gateway`; it must never be edited manually.

Do not implement pairing code until one canonical engine source and one canonical deploy path are explicitly verified. Otherwise the feature may be implemented in a source tree that production does not deploy, or recent zombie/media/release fixes may be lost.

---

## Implementation phases

### Phase 0 — Source reconciliation (BLOCKING)

1. Compare the engine copies file-by-file, excluding secrets, generated output, sessions, and runtime data.
2. Verify which source is consumed by the current canonical release pipeline and which exact SHA is active in runtime.
3. Classify differences as intended live behavior, stale duplicate, or unknown.
4. Preserve all required live behavior, especially zombie recovery, media delivery, anti-ban, queue persistence, and multi-app isolation.
5. Choose one canonical source and update both SSOT pointers.
6. Deprecate or clearly mark the non-canonical direct redeploy path; do not delete artifacts blindly.
7. Leave existing `.wwebjs_auth` and persistent config/data outside release artifacts.

Completion criterion: Aircon SSOT, Lumite SSOT, release tooling, systemd path, and active runtime all point to one verified engine source/release flow.

### Phase 1 — Gateway additive contract

Implement only in the canonical engine:

1. Add a dedicated pairing request endpoint, without changing QR `init` semantics:
   `POST /v1/wa/sessions/:externalId/pair`.
2. Accept a normalized international phone number; do not treat submitted phone as proof of ownership.
3. Start pairing only after the session/browser is ready and prevent QR/pairing concurrency for one session.
4. Expose additive status fields such as `pairing`, `pairingCode`, and `pairingPhone`.
5. Emit a pairing-code callback/event for event-driven clients while retaining polling compatibility.
6. Keep `ready` as the only successful ownership boundary; capture `client.info.wid.user` only after ready.
7. Support cancellation and safe fallback to QR via `cancelPairingCode()` or a clean session transition.
8. Handle code expiry/refresh, auth failure, timeout, logout, stale state, rehydrate, and zombie cleanup.
9. Do not touch existing authenticated sessions or persistent auth directories.
10. Test every registered app, not only Aircon; campaign must retain QR behavior.

Completion criterion: Existing QR contract and behavior remain backward compatible; pairing is additive and session state cannot become ambiguous or zombie.

### Phase 2 — Engine tests

Add mocked engine-level tests in the canonical engine repository/source for:

- QR init still returns QR;
- pairing request validates phone and returns a code;
- `code` event/status refresh reaches clients;
- pairing reaches `ready` and reports the actual linked phone;
- invalid/expired pairing fails explicitly;
- cancel returns to QR mode;
- authenticated session does not request a new pairing code;
- simultaneous QR and pairing requests are rejected safely;
- Aircon and campaign namespaces remain isolated;
- existing rehydrate/zombie behavior remains intact.

Completion criterion: focused engine tests pass, syntax checks pass, and no regression appears in existing Control Plane tests.

### Phase 3 — Aircon integration

1. Extend `src/lib/wa/gateway-relay.ts` with a pairing request function and additive status fields.
2. Extend `src/app/app/pengaturan/actions.ts` with owner/admin-guarded pairing action.
3. Add a mobile-first option in `src/app/app/pengaturan/wa-connect.tsx`:
   - QR path for laptop/PC;
   - pairing-code path for one-HP users.
4. Normalize and validate the input number; do not expose secrets.
5. Show exact WhatsApp HP instructions and code expiry/refresh state.
6. Continue polling the existing status endpoint until `ready`.
7. Run `reconcileVerifiedWaPhone()` only after gateway `ready` returns the actual linked phone.
8. Keep duplicate-number conflict handling and logout/relink semantics unchanged.
9. Preserve QR as fallback and do not require a second device for the pairing path.

Completion criterion: Both flows converge on the same verified `ready` state and existing anti-duplicate behavior.

### Phase 4 — Cross-repository verification

Local gates, selected by changed boundary:

- TypeScript/typecheck, lint, targeted Aircon tests;
- engine syntax/tests and Control Plane tests;
- production builds for affected applications;
- contract checks for all registered apps;
- no migration required unless the implementation changes the existing schema (the preferred design is additive without a new DB field).

Manual/E2E cases:

1. Tenant with laptop/PC uses QR successfully.
2. Tenant with one HP enters number and receives pairing code.
3. Pairing succeeds and the exact linked phone is persisted as `waVerifiedPhone`.
4. Wrong/expired code shows recoverable failure.
5. Pairing cancellation returns to QR.
6. Duplicate verified number is rejected and session is released.
7. Existing tenant logout and relink works.
8. Existing Aircon sessions remain available after engine restart.
9. Campaign session remains isolated and functional.

Completion criterion: all affected boundaries have evidence; no claim is based only on HTTP 200 or `queued: true`.

### Phase 5 — Exact-SHA release and live verification

1. Resolve dirty trees and commit only intended changes; preserve unrelated changes.
2. Build/package from exact pushed SHA using the canonical Lumite release pipeline.
3. Verify artifact completeness and checksum.
4. Keep `.wwebjs_auth`, config, secrets, and persistent data external.
5. Upload to staging, verify, atomically switch release, and restart once.
6. Verify active release SHA/path, services, `/health`, registered apps, existing sessions, logs, Aircon QR, and pairing flow.
7. Retain previous release until observation passes.
8. Roll back immediately on activation failure, 502, missing module, session loss, or new runtime errors.

Completion criterion: exact source/artifact/runtime SHA alignment and live proof of both QR and pairing paths.

---

## Current work ledger

Completed:

- Read-only deep audit of Aircon WA integration.
- Read-only deep audit of Lumite Control Plane, engine, release docs, and library capability.
- Confirmed `whatsapp-web.js 1.34.7` supports pairing code.
- Confirmed current gateway is QR-only.
- Confirmed Aircon already has verified-number ownership and duplicate prevention.
- Identified canonical-source/deployment contradiction.
- Confirmed no code, migration, runtime, or deployment changes were made.

Not completed:

- Source reconciliation.
- Canonical engine ownership decision recorded in both SSOTs.
- Pairing endpoint/state/callback implementation.
- Aircon pairing UI and relay implementation.
- Engine/Aircon/Control Plane tests for pairing.
- Exact-SHA build, deploy, rollback, and live E2E.

Current repository conditions observed during audit:

- Aircon has unrelated/dirty `docs/infra/00_SSOT_Gateway_Architecture.md`.
- Lumite has untracked `default.tar.gz`.
- Do not reset, delete, or deploy either tree wholesale without inspecting ownership.

## Non-negotiable safety constraints

- Do not edit `/home/rad4ssh/infra/messaging-gateway` manually.
- Do not delete or overwrite `.wwebjs_auth` during update or rollback.
- Do not upgrade `whatsapp-web.js` unless the locked 1.34.7 capability proves insufficient.
- Do not remove QR support.
- Do not persist a submitted phone as verified before gateway `ready` reports the actual linked phone.
- Do not claim delivery or registration from an enqueue response, HTTP 200, or a plan.
- Do not deploy until source ownership and release authority are reconciled.
