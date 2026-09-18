# Aircon — iPaymu Integration Specification

Status: ACTIVE — sole payment gateway; sandbox verified, production pending merchant approval
Last reviewed: 2026-09-18
Official sources:
- https://docs.ipaymu.com/id/docs/signature
- https://docs.ipaymu.com/id/docs/payment/redirect-payment
- https://docs.ipaymu.com/id/docs/callback
- https://docs.ipaymu.com/id/docs/verification

## Scope

Aircon uses iPaymu as its sole active payment gateway. The active sandbox configuration is server-only: `PAYMENT_GATEWAY=ipaymu`, `IPAYMU_ENV=sandbox`. No legacy provider is used for new, resumed, callback, or reconcile payment flows.

## Redirect Payment contract

- Sandbox: `https://sandbox.ipaymu.com/api/v2/payment`
- Production: `https://my.ipaymu.com/api/v2/payment`
- Method: POST, JSON body.
- Required business URLs: `returnUrl`, `notifyUrl`, `cancelUrl`.
- Aircon notify URL: `https://app.airconet.id/api/billing/ipaymu-webhook`.
- Aircon return URL: `https://app.airconet.id/app/langganan?status=sukses`.
- Aircon cancel URL: `https://app.airconet.id/app/langganan?status=dibatalkan`.
- Actual sandbox request shape accepted by provider: `product[]`, `qty[]`, `price[]`, `buyerName`, `referenceId`, `amount`, URLs.
- Optional product presentation fields from the current official Redirect Payment documentation: `description[]` and `imageUrl[]`; both arrays follow the same product index. Aircon sends the public HTTPS logo URL `/brand/aircon-logo.png` for each product line.
- Successful response shape observed: `Data.SessionID`, `Data.Url`.

The browser redirect and callback are independent: callback does not navigate a browser; `returnUrl` does.

## Request signature

From the official signature guide:

1. `bodyJson = JSON.stringify(body)` with PHP `JSON_UNESCAPED_SLASHES` equivalence.
2. `bodyHash = SHA256(bodyJson)` lowercase hex.
3. `stringToSign = METHOD:VA:bodyHash:API_KEY`.
4. `signature = HMAC-SHA256(stringToSign, API_KEY)` lowercase hex.
5. Headers: `Content-Type`, `va`, `signature`, `timestamp`.

## Callback signature and normalization

From the official callback guide:

1. Parse callback data.
2. Normalize `is_escrow` to boolean.
3. Normalize `trx_id`, `status_code`, `transaction_status_code`, `paid_off` to integers.
4. Convert `additional_info="[]"` to array and add it when absent.
5. Keep other fields as strings/arrays.
6. Remove a body `signature` field if present.
7. Sort keys with `localeCompare`.
8. `JSON.stringify`, then escape `/` to `\/`.
9. HMAC-SHA256 the canonical JSON using merchant VA as secret.
10. Compare timing-safely with `X-Signature`.

The live sandbox simulator proved this path with HTTP 200 `{"ok":true}`.

## Callback status mapping

- `status=berhasil`, `status_code=1`, or check response `PaidStatus=paid` → Aircon `PAID`.
- `pending`/unknown non-success → `PENDING`.
- `expired` → `EXPIRED`.
- `failed`/`cancelled` → `FAILED`.
- Check response `StatusDesc=Escrow`, `Status=7`, `SubTotal=149000`, `Amount=151682`, `PaidStatus=paid` is treated as paid; `Amount` includes fee, while Aircon validates the order subtotal.

## Idempotency and security

- Unknown reference does not activate a tenant.
- Invalid signature is rejected with non-200.
- PAID is not activated twice.
- Callback raw data is audit data; secrets and full credentials never enter logs.
- Payment amount comparison uses provider `sub_total`, not fee-inclusive `amount`.

## Reconcile

Aircon calls official iPaymu `POST /api/v2/transaction` with a transaction ID and the same request signature headers. The observed response nests data under `Data` and uses `TransactionId`, `ReferenceId`, `Status`, `StatusDesc`, `PaidStatus`, `SubTotal`, `Amount`, and `SuccessDate`. `PaidStatus=paid` or `Status=7` is mapped to PAID and passed through the same idempotent domain processor.

## Production gate

Production remains blocked until iPaymu merchant verification, production credentials, IP/domain validation, controlled production payment, callback, and rollback evidence are complete.
