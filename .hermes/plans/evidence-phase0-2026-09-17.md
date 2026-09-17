# Phase 0 Evidence — refreshed 2026-09-17

- Repo: `/home/rad/aircon`
- Branch: `main`
- HEAD: `24482a3874a46660e173e86155f88f8477925e26`
- origin/main: `87a5887a5e5c4b4ca68d431efd7f145ab208d0cd`
- Working tree: DIRTY, with unrelated app/gateway/payment/UI changes and commission changes.
- Production: `103.127.135.132`, service `aircon-app` active.
- Production BUILD_ID: `Hlb7acDTHsF8OEvroli_C`.
- Production `/opt/aircon-releases`: 0 release directories; current deployment remains flat.
- Live `/`, `/login`, `/masuk-teknisi`: HTTP 200.
- Live OAuth authorize probe: HTTP 307; redirect URI observed as `https://app.airconet.id/auth/callback`; client ID/state redacted.
- No production mutation: no migrate, restart, deploy, commit, or push.

## Gate

BLOCKED. No immutable release provenance or verified application+database backup pair exists; working tree is dirty. Authenticated OAuth success is not proven and production DB invariant probe remains unavailable. Do not proceed to Phase 1 production restore or deployment.
