# iPaymu environment switcher (active payment runbook)

`IpaymuConfig` stores both environments with AES-GCM encrypted VA/API Key values; `SANDBOX` is the safe default. Platform Admin can switch only after the selected pair is complete. Switching writes `PlatformAuditLog`.

## Before iPaymu verifier testing

1. Open Admin Platform → Pembayaran iPaymu.
2. Enter Sandbox and Production VA/API Key directly in the form; secrets are never logged or shown.
3. Keep `SANDBOX` active while configuring and performing preflight.
4. After iPaymu confirms whitelist/domain/IP, select `PRODUCTION`, save, and verify the active badge.
5. Create one controlled payment from Aircon and let the verifier complete the hosted checkout.
6. Never copy production credentials into chat, source, `.env` committed files, or screenshots.

## Rollback

Select `SANDBOX` and save. Existing payment records retain their own provider identifiers; do not reuse a sandbox transaction for a production test.

## Safety

- Never expose VA/API keys.
- One active gateway at a time.
- Sandbox credentials never enter production mode.
- Do not infer success from a dashboard label; use callback/check-transaction evidence.
- Legacy provider records are not part of the active payment domain. Migration-history names, if any,
  are immutable technical history and must not be copied into runtime configuration or active SSOT.

## Current sandbox configuration

Server-only environment:

```text
PAYMENT_GATEWAY=ipaymu
IPAYMU_ENV=sandbox
IPAYMU_SANDBOX_VA=<secret>
IPAYMU_SANDBOX_API_KEY=<secret>
IPAYMU_APP_URL=https://app.airconet.id
```

Endpoints:

- Redirect: `https://sandbox.ipaymu.com/api/v2/payment`
- Callback: `https://app.airconet.id/api/billing/ipaymu-webhook`
- Return: `https://app.airconet.id/app/langganan?status=sukses`
- Cancel: `https://app.airconet.id/app/langganan?status=dibatalkan`

## Verified sandbox procedure

1. Owner opens `/app/langganan`.
2. A paid plan creates a local `PENDING` Payment.
3. Aircon sends the official Redirect Payment request.
4. Browser reaches `sandbox-payment.ipaymu.com`.
5. Sandbox simulation completes.
6. iPaymu sends callback; Aircon validates signature and returns HTTP 200.
7. Aircon processes the same reference idempotently and activates the subscription.
8. Protected reconcile calls the official transaction endpoint and repairs missed callbacks.

Verified evidence on 2026-09-15:

- Local: TypeScript, lint, 382 tests, and production build pass.
- Live callback: HTTP 200 `{"ok":true}`.
- Live reconcile: `checkedSubscriptions=13`, `settled=3`.
- Live database audit: four Jaya Mandiri sandbox payments are PAID; remaining records retain their actual local pending/expired state.

## Required tests before calling sandbox complete

- [x] Redirect request accepted and returns SessionID/Url.
- [x] Callback signature accepted from real sandbox simulator.
- [x] Callback HTTP 200.
- [x] PAID callback activates subscription.
- [x] Official check-transaction endpoint returns paid state.
- [x] Reconcile maps paid/escrow provider state to PAID.
- [ ] Duplicate callback proves no duplicate coupon/commission/activation.
- [ ] Pending simulation does not activate.
- [ ] Failed simulation does not activate.
- [ ] Expired simulation does not activate.
- [ ] Resume Payment is tested from Aircon UI.
- [ ] Mobile hosted checkout reviewed on representative phone viewport.
- [ ] QA records are classified/removed only after audit approval.

## Merchant verification gate

Before submitting:

- public website and legal pages work;
- checkout reaches iPaymu hosted page;
- callback, return, and cancel URLs are HTTPS/public;
- sandbox evidence is available;
- provider feedback is recorded verbatim.

Do not enable production until verification is approved.

## Production cutover gate

- production VA/API key issued;
- domain/IP approved;
- backup and rollback dry-run complete;
- freeze billing changes;
- set `IPAYMU_ENV=production` and production credentials server-side;
- build guard passes;
- controlled production payment succeeds;
- callback and tenant activation verified;
- owner approves stabilization.

## Rollback

If payment succeeds but activation fails, signature fails, amount mapping is wrong, or duplicate effects occur:

1. stop new checkout;
2. preserve evidence without secrets;
3. restore the previous gateway switch/build;
4. restart and health-check;
5. reconcile already-created iPaymu orders manually/provider-side;
6. never delete payment history.
