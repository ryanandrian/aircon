# Aircon Commission & Production Recovery Implementation Plan

> **For Hermes:** Use the `aircon-production-change-control`, `systematic-debugging`, `test-driven-development`, `browser-automation-cdp`, and `production-readiness-verification` skills. Execute task-by-task; do not skip gates.

**Goal:** Menetapkan satu source-of-truth release yang dapat dipulihkan, memulihkan seluruh regresi production, lalu memperbaiki dan memvalidasi hanya alur Agen → Reseller → Tenant Attribution → Payment PAID → CommissionLedger → Reversal → Payout.

**Architecture:** GitHub commit/tag immutable menjadi SSOT release. VPS hanya menjalankan exact SHA/tag melalui release directory atomic; `.env` production tetap berada di VPS dan tidak pernah masuk artifact. Database menggunakan migration immutable expand/backfill/verify; legacy commission columns dipertahankan sampai seluruh usage dipindahkan dan dibuktikan kosong. SOP release, CI, dan deploy guard dibuat sebagai enforcement executable—bukan dokumentasi pajangan.

**Tech Stack:** Next.js 16, Prisma 7, PostgreSQL/Supabase, Node 22 standalone, systemd `aircon-app`, nginx, Google OAuth self-host, Midtrans production path; iPaymu tetap ditahan sampai scope dan kontraknya disetujui terpisah.

---

## Hard constraints

- Tidak deploy dari working tree dirty.
- Tidak `scp` file acak atau menyalin `.next` lintas build.
- Tidak mengubah atau menghapus migration yang sudah applied.
- Tidak mengubah DB production saat fase audit.
- Tidak menyentuh WhatsApp, invoicing, onboarding umum, landing, atau iPaymu pada patch komisi, kecuali pemulihan regresi yang terbukti.
- Tidak menghapus `Agent.commissionType/value` atau `Reseller.commissionType/value` sebelum seluruh usage dipindahkan, data dibackfill, dan migration contract diuji.
- Setiap acceptance harus memiliki bukti konkret: command output, DB query, browser assertion, atau live endpoint.
- SOP enforcement adalah deliverable wajib; aturan yang hanya tertulis tanpa guard otomatis dianggap belum selesai.

## Canonical business rules

- Basic adalah label publik untuk internal key `TRIAL`; saat ini gratis, tetapi pricing future harus tetap configurable dan tidak boleh di-hardcode ke logika komisi.
- Attribution saat onboarding hanya mencatat `TenantAttribution`; tidak membuat ledger.
- Komisi hanya dibuat dari transisi Payment yang benar-benar menjadi `PAID`.
- Rate harus dibaca dari `PartnerPlanCommission` untuk plan payment yang dipilih.
- Rate `0` adalah nilai sah dan menghasilkan amount `0`.
- Ledger menyimpan snapshot plan, rate, gross, months, dan amount.
- Duplicate callback harus menghasilkan satu accrual.
- Refund harus menghasilkan satu reversal append-only dengan snapshot asli.
- Payout Agen harus merekonsiliasi accrual + reversal.

---

## Phase 0 — Freeze and evidence capture

### Task 0.1: Freeze repository and production

**Files:** none.

**Steps:**
1. Catat `git status`, branch, local HEAD, `origin/main`, deployed build ID, service status, dan public health routes.
2. Jangan edit, commit, push, migrate, restart, atau deploy pada task ini.
3. Simpan output non-secret ke `.hermes/plans/` atau evidence file yang tidak berisi credential.

**Gate:** evidence baseline tersedia dan tidak ada secret.

### Task 0.2: Inventory all backups and releases

**Files:** none.

**Steps:**
1. Inventory backup local, VPS, Git refs, build IDs, dan migration history.
2. Verifikasi archive integrity (`gzip -t`/`tar -tzf`) tanpa extract ke production.
3. Tentukan kandidat `last-known-good` berdasarkan bukti, bukan timestamp saja.

**Gate:** kandidat baseline memiliki pasangan server bundle + `.next/static` + `public` yang sama.

---

## Phase 1 — Restore a canonical production baseline

### Task 1.1: Prove the OAuth baseline

**Files:** `src/app/auth/google/start/route.ts`, `src/app/auth/callback/route.ts`, `src/lib/auth/google-oauth.ts`.

**Steps:**
1. Trace authorize `redirect_uri` dan token-exchange `redirect_uri` dari source dan live bundle.
2. Confirm both are exactly `https://app.airconet.id/auth/callback` in production.
3. Confirm `AUTH_DRIVER=google`, not Supabase.
4. Reproduce one browser login with fresh cookies and capture callback log.

**Gate:** OAuth success is proven by a real authenticated browser session, not only HTTP 200.

### Task 1.2: Build a clean baseline release from Git

**Files:** release/deploy tooling only if already present; do not change app features yet.

**Steps:**
1. Create clean detached worktree from the proven baseline commit.
2. Build with production-compatible settings, excluding `.env`.
3. Ensure standalone bundle contains matching `.next/static`, `public`, `server.js`, and traced `@swc/helpers`.
4. Boot locally with production-like environment and run asset/OAuth route checks.
5. Commit/tag the baseline only after all checks pass.

**Gate:** baseline tag is reproducible and archive integrity passes.

### Task 1.3: Restore production atomically

**Files:** deploy script/release layout only.

**Steps:**
1. Create VPS `/opt/aircon-releases/<sha>` staging directory.
2. Keep current release untouched.
3. Upload verified artifact; verify checksum and absence of `.env`.
4. Boot-check release before switching traffic.
5. Atomic symlink switch; restart service; verify health, assets, OAuth authorize URL, tenant login, and teknisi login.
6. Retain previous release until post-deploy observation completes.

**Rollback:** switch symlink to previous release and restart; never reconstruct from memory.

---

## Phase 2 — Commission audit and canonical implementation

### Task 2.1: Reconcile schema and migrations

**Files:** `prisma/schema.prisma`, existing partner migrations only if missing from Git history.

**Steps:**
1. Compare local migration files against `_prisma_migrations` rows and checksums.
2. Reconstruct missing applied migration files exactly where possible; if checksum cannot be matched, record immutable historical migration and create a new additive reconciliation migration—never edit applied SQL silently.
3. Verify live objects: `PartnerPlanCommission`, `CommissionLedger.plan`, unique indexes, FK/check constraints.
4. Backfill every Agent/Reseller for Basic/TRIAL, Professional, Business idempotently from legacy values only where canonical rows are absent.
5. Query for missing rules, orphan rows, and dual-owner rows.

**Gate:** all existing partner entities have complete canonical rules; no destructive schema action.

### Task 2.2: Move Agent admin FE/action/service to canonical rules

**Files:**
- `src/app/admin/keagenan/manager.tsx`
- `src/app/admin/keagenan/actions.ts`
- `src/lib/partner/partner-admin-service.ts`

**TDD:**
1. Add failing tests for saving/reloading three plan rules and explicit zero.
2. Implement one validated input shape shared by create/update.
3. Persist rules transactionally with Agent updates.
4. Read canonical rules back for display after refresh.
5. Keep legacy columns synchronized only as compatibility fields until their final removal phase; runtime must not calculate from them.

**Gate:** FE → server action → service → DB persistence proven.

### Task 2.3: Move Reseller approval to canonical rules

**Files:**
- `src/app/agen/reseller/manager.tsx`
- `src/app/agen/actions.ts`
- `src/lib/partner/partner-portal-service.ts`

**TDD:**
1. Add failing tests for Basic/Professional/Business rates, zero, percent bounds, flat bounds, and agent ownership.
2. Implement transactional approval creating/upserting all plan rules.
3. Verify approval cannot write a reseller under a different agent.
4. Verify hard refresh reads persisted rules.

**Gate:** reseller approval FE → action → service → DB proven.

### Task 2.4: Make PAID accrual and reversal race-safe

**Files:**
- `src/lib/partner/partner-service.ts`
- `src/lib/services/subscription-service.ts`
- relevant payment tests.

**TDD:**
1. Add failing test: onboarding attribution alone creates no ledger.
2. Add failing test: PAID for each supported plan selects exact rule and snapshots it.
3. Add failing concurrency test: parallel duplicate PAID processing returns one accrual and does not surface a uniqueness failure.
4. Add failing test: REFUNDED creates exactly one reversal and preserves original plan/rates.
5. Implement with DB uniqueness as final authority and deterministic P2002 recovery.
6. Ensure non-PAID statuses cannot accrue.

**Gate:** Payment status transition → service → canonical rule → ledger proven.

### Task 2.5: Reconcile dashboard, export, and payout

**Files:**
- `src/lib/partner/partner-portal-service.ts`
- `src/lib/partner/partner-admin-service.ts`
- related FE files.

**TDD:**
1. Add failing tests for accrual plus reversal totals.
2. Ensure reseller dashboard/export includes both `ACCRUAL` and `REVERSAL`.
3. Verify Agent payout gross/deduction/net against ledger.
4. Verify duplicate payout build and mark-paid behavior.
5. Verify cross-agent/reseller isolation.

**Gate:** ledger/report/payout totals reconcile exactly.

---

## Phase 3 — Browser and real-boundary E2E

### Task 3.1: Authenticated browser harness

**Tools:** `browser-automation-cdp`, `dogfood`, `verifying-web-ui-fixes`.

**Steps:**
1. Use isolated named browser context and disposable credentials/session only.
2. Test admin keagenan page: enter three rules, submit, observe success, reload, assert values.
3. Test agent portal and reseller approval similarly.
4. Capture console/page errors; ignore only known Next prefetch abort noise.
5. Measure rendered DOM fields; do not infer success from source classes.

**Gate:** all UI actions show explicit success and persisted values.

### Task 3.2: Disposable database business E2E

**Steps:**
1. Create disposable agent with distinct rules: Basic flat 10k, Professional 10%, Business flat 30k.
2. Create disposable tenant with attribution and no payment; assert zero ledger.
3. Create one payment per plan; invoke normal payment processor with synthetic confirmed PAID events.
4. Send duplicate PAID concurrently; assert one accrual.
5. Send REFUNDED twice; assert one reversal.
6. Build payout, mark it paid with fake reference, retry, and assert idempotent rejection.
7. Verify cleanup removes only disposable records.

**Gate:** all business acceptance criteria pass and cleanup count is verified.

### Task 3.3: Provider sandbox boundary

**Scope:** only if explicitly included in the release; do not switch production environment.

**Steps:**
1. Confirm sandbox credentials via masked DB query.
2. Create sandbox payment through existing provider adapter.
3. Verify callback signature, Payment PENDING→PAID, subscription, commission ledger, duplicate callback, and refund/reversal.
4. Do not claim provider E2E from synthetic callbacks.

**Gate:** real sandbox response and callback evidence exist, or status is explicitly BLOCKED.

---

## Phase 4 — Legacy and documentation hygiene

### Task 4.1: Legacy usage closure

**Steps:**
1. Search source, migrations, tests, scripts, and docs for `Agent/Reseller.commissionType/value`.
2. Replace runtime/UI/report reads with canonical plan rules.
3. Keep columns as deprecated compatibility fields for one release cycle.
4. Verify every entity has complete canonical rows.
5. Only in a later separately reviewed migration may columns be dropped.

**Gate:** no runtime calculation depends on legacy fields; no premature destructive migration.

### Task 4.2: SSOT synchronization

**Files:**
- `docs/README.md`
- `docs/PROJECT_STATUS.md`
- `docs/Keagenan_Tahap1_Readiness.md`
- payment docs only where they state deployed gateway facts.

**Steps:**
1. Mark living vs historical documents.
2. Correct commission status and clearly state what is verified.
3. State that Basic is public label for internal TRIAL key.
4. State deployed gateway truth from probe, not stale plans.
5. Add release SHA/build ID reference only after a real tagged release exists.

**Gate:** no document claims unverified readiness.

---

## Phase 5 — Release and deployment gates

## Phase 5A — SOP, SSOT, and executable enforcement

### Task 5A.1: Create the living release SOP

**Files:**
- Create: `docs/SOP_Release_Deployment.md`
- Modify: `docs/README.md`
- Modify: `docs/PROJECT_STATUS.md`

**Contents required:**
1. Source-of-truth hierarchy: GitHub tagged commit → immutable artifact → VPS release symlink; DB migration history is authoritative for applied migrations.
2. Branch, review, commit, tag, push, CI, deploy, rollback, and incident procedures.
3. Explicit prohibition of dirty-tree deploy, manual `scp` to active directory, local `.env` in artifacts, migration edits after apply, and unverified claims.
4. Required commands and expected evidence for every gate.
5. Ownership, approval points, retention, and rollback criteria.
6. Living-document marker and rule that volatile facts come from machine probes.

**Gate:** an engineer unfamiliar with the incident can execute the SOP without guessing; every command points to an existing script or is marked TODO until implemented.

### Task 5A.2: Add CI release enforcement

**Files:**
- Create/modify: `.github/workflows/ci.yml`
- Create: `scripts/verify-release-scope.sh`
- Create: `scripts/verify-artifact.sh`

**Required checks:**
1. Clean checkout and locked dependency install.
2. Prisma validate, typecheck, lint, full tests, production build.
3. Scope allowlist for commission release; fail on unrelated paths.
4. Fail if any `.env`/credential file enters the artifact.
5. Verify artifact has `server.js`, matching `.next/static`, `public`, and required traced dependencies.
6. Record artifact SHA-256 and source commit SHA as CI artifacts.
7. Release job may run only from a protected tag after CI passes.

**Gate:** deliberately introduce each failure condition in a disposable branch and prove CI rejects it; restore branch afterwards.

### Task 5A.3: Replace manual deployment with atomic release script

**Files:**
- Modify: `scripts/deploy-vps.sh`
- Create if absent: `scripts/verify-vps-release.sh`

**Required behavior:**
1. Refuse dirty Git tree, non-tag/non-commit input, missing remote push, and unapproved scope.
2. Build exactly once from the specified commit/tag.
3. Refuse `.env` in tarball and refuse build/static/public mismatch.
4. Upload to `/opt/aircon-releases/<commit-sha>/`, never active directory.
5. Verify checksum and boot the staged release before switch.
6. Preserve `/opt/aircon-app/.env` and previous release.
7. Atomically switch `current` symlink and restart service.
8. Run health, assets, OAuth, login, DB/schema, and error-log checks.
9. Automatically switch back to previous symlink on failed post-switch checks.
10. Print release SHA and evidence paths without secrets.

**Gate:** run the script against a disposable staging directory with induced missing asset, `.env`, bad dependency, and failed-health cases; each must abort/rollback.

### Task 5A.4: Establish backup and restore SOP

**Files:**
- Create: `scripts/backup-release.sh`
- Create: `scripts/restore-release.sh`
- Create: `docs/SOP_Backup_Restore.md`

**Required behavior:**
1. Durable backup location with retention, checksum, and timestamp.
2. Application release backup plus encrypted database backup; no secrets in logs.
3. Restore into an isolated directory/database first.
4. Verify restored service boot, assets, OAuth redirect, and representative DB invariants.
5. Never delete the only known-good backup automatically.

**Gate:** perform one restore drill and retain the command output/evidence; a backup that has never been restored is not accepted as valid.

### Required local gates

```bash
git status --short                    # must be clean before release
git diff --check
pnpm exec prisma validate
pnpm exec tsc --noEmit
pnpm run lint
pnpm test
pnpm run build
pnpm prisma migrate status
```

Additional mandatory release commands:

```bash
bash scripts/verify-release-scope.sh <tag-or-sha>
bash scripts/verify-artifact.sh <artifact>
```

### Required release gates

- Commit contains only approved scope.
- Commit pushed to GitHub.
- Immutable tag created.
- CI passes on that exact tag.
- Artifact checksum recorded.
- Artifact contains no `.env`.
- Artifact boot test passes.
- Asset URLs all return HTTP 200.
- OAuth authorize and callback URI are production-correct.
- DB migration/checksum/schema verified.
- VPS checks out exact tag/SHA.
- Previous release retained for rollback.
- SOP enforcement checks pass; deliberate-failure tests are recorded.

### Required live gates

- `aircon-app` active.
- `/`, `/login`, `/masuk-teknisi` return expected status.
- Authenticated Google login succeeds.
- Admin/Agen/Reseller browser flows succeed.
- PAID, duplicate, REFUNDED, reversal, payout evidence reconciles in DB.
- No new application errors in journal.
- Release SHA/build ID matches the tagged commit.

## Definition of done

The work is complete only when every acceptance item has PASS evidence. Report separately:

- Restored production baseline.
- Commission implementation.
- Database/migration state.
- Browser E2E.
- Provider sandbox E2E.
- Deployment/live verification.
- Remaining BLOCKED items.

Never report “100% valid” when any required boundary is untested or any source (local/GitHub/VPS) is not reconciled.

---

## Execution checklist — updated 2026-09-17

Legend: `[x]` verified PASS evidence; `[~]` partially executed / blocked; `[ ]` not executed.

### Phase 0 — Freeze and evidence capture

- [~] 0.1 Freeze repository and production — refreshed: production active, public routes 200, OAuth authorize URI correct; tree dirty, no immutable provenance, and no verified backup pair. No mutation performed.
- [~] 0.2 Inventory backups and releases — refreshed: VPS release directory count 0 and active bundle is flat; no matching immutable archive pair found.

### Phase 1 — Restore canonical production baseline

- [~] 1.1 Prove OAuth baseline — authorize probe proves production callback URI; authenticated browser proof not run.
- [~] 1.2 Build clean baseline release from Git — standalone artifact structure passes; boot requires production-like DB env and failed locally with `P1001` against localhost, so gate remains open.
- [ ] 1.3 Restore production atomically — intentionally not run.

### Phase 2 — Commission audit and canonical implementation

- [~] 2.1 Schema/migration files audited; canonical rules and additive snapshot migration authored. `prisma migrate status` identifies one unapplied additive migration; live DB invariant query remains blocked. No production migration run.
- [~] 2.2 Admin Agent canonical rule path implemented and locally typechecked/tested; integration persistence test not yet run.
- [~] 2.3 Reseller approval canonical rule path implemented and locally typechecked/tested; integration persistence/ownership test not yet run.
- [~] 2.4 PAID accrual/reversal race and monotonic callback fixes implemented; integration/concurrency DB tests not yet run.
- [~] 2.5 Dashboard/export/payout reconciliation fixes implemented; disposable DB payout test not yet run.

### Phase 3 — Browser and real-boundary E2E

- [ ] 3.1 Authenticated browser harness.
- [ ] 3.2 Disposable database business E2E.
- [ ] 3.3 Provider sandbox boundary — explicitly not included/switched; status BLOCKED, not claimed.

### Phase 4 — Legacy and documentation hygiene

- [~] 4.1 Legacy usage closure — compatibility fields retained; runtime legacy reads remain in display paths and require closure.
- [~] 4.2 SSOT synchronization — evidence/SOP documents added; status documents still require reconciliation against verified release facts.

### Phase 5 — Release and deployment gates

- [x] 5A.1 Living release SOP created.
- [~] 5A.2 CI release enforcement created; CI has not run on a pushed immutable tag and deliberate CI branch rejection has not been recorded.
- [~] 5A.3 Atomic deployment guard created; local staged boot reached routes but `/` returned 500 without DB env; production deployment intentionally withheld and rollback drill not run.
- [~] 5A.4 Backup/restore scripts and SOP created; real encrypted DB backup and restore drill not run.
- [ ] Required release gates — not passed.
- [ ] Required live gates — not passed.

### Current gate

**BLOCKED at Phase 0 and release gates.** Production must not be deployed until all unchecked/partial items have concrete evidence.

---

## Revised execution strategy — evidence-based, 2026-09-17

### Findings that change the execution plan

1. The local working tree is dirty with multiple unrelated feature clusters. It is not a valid release source as-is.
2. `HEAD` is not a valid standalone baseline for this work: its schema requires `CommissionLedger.plan`, while its service code does not consistently provide it; the current working tree also contains the dependent iPaymu files.
3. The current production bundle is flat at `/opt/aircon-app`; `/opt/aircon-releases` has no release directories. Production is healthy but provenance is unverified.
4. Required operator capabilities are present locally: GitHub CLI authenticated, Aircon SSH key readable, Playwright CLI available, local env and provider credential reference files present. Capability presence is not proof that a provider transaction, DB mutation, or browser login succeeds.
5. The database URL is present in the local env, but its value is never printed. Production DB access must be verified by a masked connectivity/query probe before any migration or disposable-data test.
6. The current deploy guard/artifact tooling is not sufficient until the artifact is boot-tested with production-like runtime configuration and the release script is tested against an isolated staging directory.

### Correct execution order

**Gate A — source assembly (no production mutation)**

- Build one explicit release manifest from the current working tree, including every imported dependency of the commission path and excluding unrelated gateway, landing, invoicing, and iPaymu changes unless the selected payment path imports them.
- Use a temporary clean worktree; never reset or stash the user's dirty tree.
- Run `git diff --check`, Prisma validate, TypeScript, lint, tests, build, and artifact verification there.
- If the manifest cannot pass, fix the manifest/code mismatch before any DB or deployment work.

**Gate B — database capability and schema evidence (read-only first)**

- Run a masked DB connectivity check using the existing configured connection, never print credentials.
- Query `_prisma_migrations`, `information_schema`, indexes, constraints, canonical rule counts/gaps, orphan rules, dual-owner rules, and ledger nulls.
- Compare live migration names/checksums to repository files.
- If the live DB already contains an object with missing migration history, record the gap and create only an additive reconciliation migration; never edit/replay an applied migration.
- Only after the read-only evidence is captured, apply the pending additive migration using the official Prisma command, then re-query schema and counts.

**Gate C — commission correctness**

- Add integration tests against an isolated disposable database/schema, not production records.
- Prove attribution-only creates no ledger; all three plans select their exact rules; zero rate yields zero; duplicate PAID and duplicate REFUNDED are idempotent; late non-PAID cannot downgrade PAID; payout totals reconcile; cross-agent/reseller isolation holds.
- Fix any failure at the service/database boundary, then rerun focused and full tests.

**Gate D — browser boundary (mandatory, no bypass)**

- Use a named isolated browser context and disposable identities/session only.
- Test admin Agent rules, Agent portal, and Reseller approval; assert explicit success feedback, reload, persisted plan values, and no unexpected console errors.
- This gate may not be marked `BLOCKED`, `N/A`, or inferred from HTTP 200. It must produce concrete browser evidence.

**Gate E — provider boundary (mandatory, no bypass)**

- Use the provider specified by this plan: Midtrans production path remains the application production path; use Midtrans sandbox for safe transaction testing without switching production.
- Verify real sandbox create, hosted checkout boundary, callback/signature, status transition, duplicate notification, refund/reversal, and database result using a disposable tenant/payment.
- iPaymu remains outside this commission release unless a separate approved scope changes the provider contract; its existing files must not silently enter this release.
- This gate may not be marked `BLOCKED` or inferred from historical documentation. It must produce fresh provider evidence.

**Gate F — database, backup, CI, and VPS boundaries (mandatory, no bypass)**

- Verify production DB connectivity and all required invariants through masked queries.
- Apply only the approved additive migration after backup and schema evidence; re-query objects, checksums, counts, and constraints.
- Create and checksum application plus encrypted database backups; restore both into isolated targets and boot-test them.
- Push the curated commit, create an immutable tag, run CI on that exact tag, and retain artifact SHA-256 plus source SHA.
- Deploy only the verified artifact to `/opt/aircon-releases/<sha>`, boot-check before switch, atomically switch symlink, verify live routes/assets/OAuth/schema/commission flow, and retain the previous release.
- Execute and verify rollback before declaring deployment complete. Any failed post-switch check must trigger rollback and re-verification, followed by correction and a fresh full run.

### Non-negotiable completion rule

A task is `[x]` only when its own acceptance evidence exists. A capability check, source inspection, historical document, local unit test, or HTTP 200 is not a substitute for DB, browser, provider, backup/restore, CI, or live evidence. If a required external boundary cannot be exercised, the final status is `BLOCKED`, not 100% complete.
