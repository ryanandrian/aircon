# Local Server Diagnosis — Current Source Snapshot

Tanggal: 2026-09-17
Root: `/home/rad/aircon`

## Actions completed

- Source backup created: `/home/rad/aircon-source-backups/local-diagnosis-20260917T173118Z`
- Git history bundle, working-tree patch, source archive without secrets, status, and SHA256 manifest created.
- Local config/dependency audit completed.
- `.env.local` created from `.env.example` with local URL, `NODE_ENV=development`, Google auth flag, iPaymu sandbox flag, and WA safe mode. No production secret copied.
- Prisma Client regenerated from current `prisma/schema.prisma`.
- `pnpm exec tsc --noEmit`: PASS.
- Local Next dev server started successfully.

## Route diagnosis

With `.env.local` active:

- `/login`: HTTP 200
- `/masuk-teknisi`: HTTP 200
- `/auth/google/start`: HTTP 307
- `/admin/keagenan`: HTTP 307 (auth redirect)
- `/agen`: HTTP 307 (auth redirect)
- `/reseller`: HTTP 307 (auth redirect)
- `/`: HTTP 500

## Root cause observed

The local server loaded `.env.local`, whose database variables are empty/template values. Prisma attempted `127.0.0.1:5432` and returned `P1001 DatabaseNotReachable` while rendering `src/app/page.tsx` (`PlanConfig` query).

This is a local configuration blocker, not yet evidence of source-code corruption.

## Not yet done

- No source-code fix was made during this diagnosis.
- No production `.env` was copied or changed.
- No database migration or write was performed.
- Browser screenshot/console diagnosis was not run because the root route requires a reachable DB.

## Next required decision

To make the current source fully browsable locally, configure a database target for local development. Options must be decided explicitly:

1. Local PostgreSQL with imported disposable schema/data.
2. Disposable remote/test database using credentials stored outside the repository.
3. Existing configured database target, only if explicitly accepted for development use and with no destructive commands.

Until one target is selected and configured, `/` cannot be validated locally.
