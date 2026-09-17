# Aircon Payment & Dunning SSOT

Status: ACTIVE SSOT — iPaymu-only sandbox payment verified; production activation remains a merchant gate
Last reviewed: 2026-09-18
Application: https://airconet.id / https://app.airconet.id

## Authority and update rule

This document is the operational index for payment and subscription dunning. Provider facts come only from official iPaymu documentation or recorded live evidence. Aircon facts come from source code, database evidence, tests, and deployment output. Every billing change must update this document and the relevant provider specification in the same change.

## Active business lifecycle

Payment lifecycle:

`PENDING → PAID | FAILED | EXPIRED | REFUNDED`

A `PAID` payment activates or extends the tenant subscription exactly once. Callback retries must not repeat subscription activation, coupon redemption, or partner commission.

Tenant lifecycle:

`TRIAL → ACTIVE → PAST_DUE → SUSPENDED → marked for deletion → purged`

Basic is free forever when `nextDueDate` is null. There is no auto-charge; paid plans are manual checkout and manual renewal.

## Gateway state

| Environment | Gateway | Status |
|---|---|---|
| Current Aircon VPS at last verified deploy | iPaymu sandbox | Active for controlled sandbox verification |
| iPaymu production | Not configured/approved | Not allowed |
| Legacy provider path | Removed from active source and payment data | Not available |

The active provider migration is complete in source and payment data. Production activation remains a separate gate: iPaymu merchant verification, production credentials, production domain/IP approval, and a controlled production smoke test.

## iPaymu redirect integration — verified facts

Official sources:
- https://docs.ipaymu.com/id/docs/signature
- https://docs.ipaymu.com/id/docs/payment/redirect-payment
- https://docs.ipaymu.com/id/docs/callback
- https://docs.ipaymu.com/id/docs/verification

Request:
- Sandbox base: `https://sandbox.ipaymu.com`
- Production base: `https://my.ipaymu.com`
- Endpoint: `POST /api/v2/payment`
- Request uses server-only VA/API key signature.
- Actual sandbox request accepted flat arrays: `product[]`, `qty[]`, `price[]`.
- Response contains `Data.SessionID` and `Data.Url`.
- `returnUrl` is browser navigation after hosted checkout.
- `notifyUrl` is server-to-server callback and never navigates the browser.
- `cancelUrl` is browser navigation for cancellation.

Callback:
- Sandbox delivered a JSON-shaped payload with `Content-Type: application/x-www-form-urlencoded`.
- Official callback normalizer converts `is_escrow`, integer fields, and `additional_info`, sorts keys, escapes `/`, then HMAC-SHA256s the JSON using merchant VA.
- `status=berhasil` and `status_code=1` are success indicators.
- Check-transaction response used by sandbox returns `PaidStatus=paid`, `StatusDesc=Escrow`, `SubTotal`, `Amount`, `TransactionId`, and `Status=7`.
- `Escrow` is provider settlement presentation; it is not the Aircon domain status. Aircon maps confirmed paid provider state to `PAID`.

## Aircon implementation map

| File | Responsibility | State |
|---|---|---|
| `src/lib/billing/ipaymu-client.ts` | request signature, redirect request, check transaction | Implemented |
| `src/lib/billing/ipaymu-logic.ts` | pure status mapping | Implemented |
| `src/app/api/billing/ipaymu-webhook/route.ts` | callback parsing, signature validation, domain dispatch | Implemented |
| `src/lib/services/subscription-service.ts` | Payment persistence and idempotent business effects | Implemented |
| `src/app/app/langganan/actions.ts` | start/resume provider dispatch | Implemented |
| `src/app/app/langganan/plan-cards.tsx` | hosted redirect UI | Implemented |
| `src/app/app/langganan/resume-pay-button.tsx` | hosted redirect resume UI | Implemented |
| `src/lib/services/reconcile-service.ts` | iPaymu provider pull reconciliation | Implemented for iPaymu sandbox |
| `src/lib/services/dunning-service.ts` | overdue tenant lifecycle and reminders | Existing, gateway-neutral |
| `src/app/api/cron/dunning/route.ts` | dunning cron entrypoint | Existing |
| `src/app/api/cron/reconcile/route.ts` | payment reconcile cron entrypoint | Gateway-dispatched |

## Dunning SSOT

Dunning is separate from customer service reminders. It acts on tenant `nextDueDate`:

- within grace: `PAST_DUE`, tenant remains usable;
- after `graceDaysBeforeSuspend`: `SUSPENDED`, data retained;
- after `daysBeforeDelete`: marked for deletion;
- purge requires the configured purge grace period and a separate run;
- payment before purge returns tenant to `ACTIVE` and cancels deletion.

All dunning timing, templates, tax, and reminder settings are configurable through `BillingPolicy`; no payment provider status may bypass the domain rules. A confirmed `PAID` event enters `activateSubscription`, which resets the overdue lifecycle.

Refund policy: `src/app/refund/page.tsx` — publik dan dirujuk dari Ketentuan, footer, dan Kontak.
Kontak publik: `src/app/kontak/page.tsx` — alamat, telepon, email, jam kerja.

## Verified evidence
- Live callback: iPaymu sandbox callback returned HTTP 200 `{"ok":true}`.
- Live reconcile: protected `/api/cron/reconcile` returned `checkedSubscriptions=13`, `settled=3`.
- Live database audit after reconcile: four Jaya Mandiri sandbox payments had `status=PAID`; genuinely unpaid/older records remained pending/expired according to their local history.
- Latest deploy: VPS service active; `/` and `/login` HTTP 200.

## Remaining gates

- [ ] Run full duplicate callback test and prove no duplicate side effects.
- [ ] Run official pending/failed/expired sandbox simulations and record evidence.
- [ ] Verify responsive hosted checkout on representative mobile devices.
- [ ] Complete iPaymu merchant verification.
- [ ] Obtain production VA/API key.
- [ ] Validate production domain/IP and callback.
- [ ] Controlled production smoke test.
| - [ ] Stabilization period and owner approval for production activation.

## Change ledger

| Date | Files/area | Evidence | Status |
|---|---|---|---|
| 2026-09-18 | iPaymu-only adapter, callback, reconcile, active payment schema/data | DB audit: 5 Payment records; latest pending and 4 paid redirects use iPaymu sandbox | Active migration complete; production gate pending |
| 2026-09-15 | Public refund/contact pages, terms/footer links | tsc + test + lint + build passed; deploy pending | Ready to deploy |

## Stop conditions

Never infer provider state from the dashboard label alone. If callback/check-transaction fields differ from official docs, capture the real payload, update the provider spec, add a regression test, and only then modify the adapter. Never activate production credentials before merchant verification.
