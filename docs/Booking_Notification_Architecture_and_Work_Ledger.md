# Aircon Booking Notification Architecture & Work Ledger

> Status: ARCHITECTURE APPROVED / IMPLEMENTATION NOT STARTED.
> This document is the continuity SSOT for booking notifications. Read it before changing this feature.

## 1. Business essence

Public booking is the first step of Aircon's money loop:

`calon pelanggan → booking → lead → tenant follow-up → customer → job → repeat service`

A booking that is silently stored is operationally incomplete. The tenant must be informed quickly and must have a clear next action.

## 2. Scope

Build a tenant-scoped notification system for new public bookings. It must support:

- durable persistence after Lead creation;
- tenant inbox and unread badge;
- real-time or short-latency panel update;
- toast/banner feedback;
- opt-in sound with browser autoplay constraints;
- browser/PWA notification when permission exists;
- optional WhatsApp fallback later through the shared Lumite Gateway;
- idempotency, tenant isolation, deduplication, and auditability.

Out of scope for the first release:

- marketing broadcast;
- replacing the existing WhatsApp gateway;
- automatic customer conversion without tenant action;
- mobile native application;
- complex notification preference center beyond the minimum opt-in sound/browser permission.

## 3. Priority-ordered delivery plan

### P0 — Durable event and tenant inbox (mandatory foundation)

Goal: no booking disappears and tenant can always find it.

Design:

`submitBooking()` → transactionally create `Lead(status=NEW, source=WEBSITE)` and durable `Notification(type=NEW_LEAD, tenantId, entityId=lead.id, dedupKey)`.

Required properties:

- same tenant ID from verified public slug;
- unique dedup key for the booking event;
- unread/read state;
- created timestamp;
- safe title/body metadata without secrets;
- notification remains if browser is closed;
- conversion/status changes do not delete history.

UI:

- new `Booking Online` nav entry with unread badge;
- inbox list, newest first;
- filter unread/all;
- link to Lead details/action;
- tenant-scoped queries and authorization.

Acceptance:

- one valid booking creates exactly one Lead and one notification;
- spam honeypot creates neither;
- two tenants cannot see each other's Lead or notification;
- refresh/browser reopen still shows unread booking;
- failed notification write rolls back the booking transaction or produces a provable retry state.

Likely files:

- `prisma/schema.prisma` + additive migration;
- `src/app/p/[slug]/actions.ts`;
- `src/lib/services/lead-service.ts`;
- new `src/lib/services/notification-service.ts`;
- `src/app/app/leads/*`;
- `src/app/app/_components/app-nav.tsx`.

### P1 — Toast/banner and unread synchronization

Goal: tenant sees a new booking while already using the panel.

Preferred first implementation: durable polling/revalidation at a bounded interval, then realtime only if the existing stack already provides a safe channel.

Rules:

- do not rely only on in-memory events;
- stop polling on unmount;
- avoid duplicate toast using notification ID/dedup key;
- update badge and list consistently;
- visible error state when refresh fails.

Acceptance:

- new booking appears without full-page refresh within the defined latency target;
- one booking produces one toast per open tenant session;
- closing/reopening does not replay old notifications as new;
- tenant isolation remains enforced server-side.

### P2 — Sound notification (opt-in)

Goal: audible alert without violating browser autoplay policy.

UX:

- explicit `Aktifkan suara notifikasi` control;
- persisted preference per browser/tenant;
- sound toggle/mute;
- first user interaction unlocks AudioContext;
- debounce/batch multiple events;
- accessible visual notification remains available when sound is blocked.

Acceptance:

- no unsolicited autoplay exception/error;
- sound plays only after opt-in/user gesture;
- mute survives refresh;
- 10 simultaneous bookings do not cause 10 overlapping sounds;
- prefers-reduced-motion/accessibility is respected for visual effects.

### P3 — Browser/PWA notification

Goal: notify tenant when the tab is backgrounded.

Rules:

- request permission only after explicit user action;
- permission denied is a normal fallback, not an error loop;
- click opens `/app/leads`;
- payload contains no unnecessary PII;
- service worker/subscription secrets remain server-side.

Acceptance:

- permission flow works where supported;
- denied/unsupported browsers retain badge/toast/sound behavior;
- notification click targets the correct tenant route.

### P4 — WhatsApp fallback (DIBATALKAN)

Tidak diperlukan karena halaman usaha publik sudah menyediakan tombol WhatsApp langsung untuk calon pelanggan/tenant. Menambahkan notifikasi WhatsApp ke tenant akan menggandakan kanal, berpotensi menimbulkan spam/duplikasi, dan menambah ketergantungan gateway tanpa nilai operasional yang cukup.

Tindak lanjut tetap dilakukan melalui:

- tombol WhatsApp pada Lead/inbox;
- inbox `Booking Online`;
- status Lead dan konversi ke Customer.

## 4. Canonical state model

Lead status remains:

`NEW → CONTACTED → QUOTED → WON`

or:

`NEW/CONTACTED/QUOTED → LOST`

Notification state:

`UNREAD → READ`

Optional delivery state for P3/P4:

`PENDING → SENT | FAILED`, with retry metadata. Delivery state never changes Lead truth.

## 5. Security and reliability invariants

- Every Lead and Notification query includes `tenantId` from authenticated context.
- Public slug resolves the tenant server-side; client input never supplies tenant ID.
- Notification dedup is enforced by a database unique key, not only frontend state.
- No credential, full phone number, or secret is logged unnecessarily.
- Booking transaction and durable event creation are atomic or have a recorded retry/outbox state.
- UI success means persisted Lead; it does not imply notification delivery.
- Existing source `Lead` conversion remains idempotent.

## 6. Verification gates

P0:

- unit tests: tenant scoping, dedup, unread/read, transaction failure;
- integration test: public booking → Lead + Notification;
- UI: inbox, filters, conversion, responsive mobile/desktop;
- typecheck, lint, full tests, build.

P1:

- polling/revalidation lifecycle;
- no duplicate toast;
- stale/failed refresh behavior.

P2:

- opt-in audio only;
- mute persistence;
- batching/debounce;
- browser permission fallback.

P3/P4:

- browser/provider-specific E2E only when those boundaries are changed.

## 7. Work ledger

| Boundary | Status | Evidence |
|---|---|---|
| Public booking currently creates tenant-scoped Lead | PASS | `src/app/p/[slug]/actions.ts`, `lead-service.ts` |
| Tenant Lead inbox/conversion | PASS | deployed Aircon commit `d15386f` |
| Durable Notification model/event | PASS | TenantNotification + public booking write + unique dedupeKey |
| Unread badge/read state | PASS | Header bell + tenant-scoped mark read |
| Toast/revalidation | PASS | 15-second durable polling + inbox visual fallback |
| Opt-in sound | PASS | Explicit user gesture + persisted preference |
| Browser/PWA notification | PASS | Explicit permission flow + denied/unsupported fallback |
| WhatsApp fallback | DIBATALKAN — tombol WhatsApp publik + inbox Lead sudah cukup |
| Production deployment of this notification plan | PENDING | exact SHA artifact/deploy still required |

## 8. Definition of done

The notification project is not complete until each required priority row is independently PASS with source SHA, artifact checksum, active production release, changed-flow evidence, and rollback availability. P0 must pass before P1; P1 before P2; P3/P4 are optional subsequent phases.

Never report “notification system selesai” from a database row, a UI mock, a pushed commit, or a toast alone.
