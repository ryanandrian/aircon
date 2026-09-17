# Commission Recovery Evidence — 2026-09-17 (latest)

Plan SSOT: `/home/rad/aircon/.hermes/plans/2026-09-17_220000-rekonsiliasi-recovery-komisi.md`

## Verified PASS

- Commission logic and canonical plan-rule paths implemented.
- Concurrent attribution/reversal unique races handled idempotently.
- Payment late-callback downgrade guard implemented.
- PAID transition activation guarded with conditional update.
- Agent rule update is transactional.
- Payout paid transition requires non-empty transfer reference and conditional state update.
- Additive `Payment.commissionBaseIdr` snapshot authored; existing historical rows intentionally not fabricated.
- `git diff --check`
- Prisma generate/validate
- TypeScript noEmit
- ESLint
- 384 Vitest tests
- Next production build
- shell syntax checks
- artifact structure and secret exclusion; deliberate `.env` rejection
- live `/`, `/login`, `/masuk-teknisi`: HTTP 200
- live `aircon-app`: active

## Explicitly BLOCKED / not claimed

- Phase 0 baseline gate: dirty tree, no immutable tag, no verified release+DB backup pair.
- New migration `20260917230000_payment_commission_base_snapshot` is not applied; `prisma migrate status` correctly reports it pending. No production migration was run.
- Local standalone boot cannot be accepted: with no production-like DB env it returns `P1001` for localhost DB; login routes return 200 but this is insufficient.
- No authenticated browser E2E.
- No disposable DB/concurrency business E2E.
- No provider sandbox E2E.
- Live DB invariant query remains blocked by unavailable DB URL in VPS probe shell.
- Legacy commission display reads remain and need closure.
- No CI run on pushed immutable tag.
- No backup/restore drill.
- No commit, tag, push, or production deploy.

Production deployment remains withheld until every plan checklist item has concrete evidence.
