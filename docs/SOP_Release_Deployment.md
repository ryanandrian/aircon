# SOP Release & Deployment Aircon

> LIVING DOCUMENT — fakta volatile wajib diverifikasi dengan probe mesin, bukan asumsi.

## Source of truth

1. GitHub tagged commit immutable.
2. Artifact immutable dengan checksum dan source SHA.
3. VPS `/opt/aircon-releases/<sha>`; symlink `current` menentukan release aktif.
4. `_prisma_migrations` adalah otoritas migration yang sudah applied.

Dilarang deploy dari working tree dirty, menyalin `.next` lintas build, `scp` file acak ke direktori aktif, memasukkan `.env`/credential ke artifact, mengedit migration applied, atau menyatakan gate lulus tanpa bukti.

## Gates wajib

```bash
git status --short                 # kosong
git diff --check
pnpm install --frozen-lockfile
pnpm exec prisma validate
pnpm exec tsc --noEmit
pnpm run lint
pnpm test
pnpm run build
auto=$(pnpm prisma migrate status)
printf '%s\n' "$auto"
bash scripts/verify-release-scope.sh <exact-tag>
bash scripts/verify-artifact.sh <artifact.tar.gz>
```

CI wajib PASS pada exact tag sebelum release. Catat source SHA, artifact SHA-256, migration status, boot check, asset HTTP 200, service status, dan endpoint checks.

## Release

Build satu kali dari exact tag di clean checkout. Artifact harus memuat `server.js`, `.next/static`, `public`, serta dependency traced yang dibutuhkan; `.env` tetap hanya di VPS. Upload ke staging release directory, checksum dan boot-check, baru switch symlink secara atomik. Release sebelumnya wajib dipertahankan.

Post-switch: cek `systemctl is-active aircon-app`, `/`, `/login`, `/masuk-teknisi`, asset URLs, OAuth authorize/callback, schema, log error, dan alur changed feature. Jika ada 502, `MODULE_NOT_FOUND`, service activating, atau error baru, switch kembali ke symlink sebelumnya dan restart.

## Ownership and approvals

Owner menyetujui scope, tag, migration, dan switch produksi. Engineer merekam evidence setiap gate. Provider E2E harus dibedakan dari synthetic callback. Sandbox default; production payment environment tidak boleh diganti oleh deploy.

## Retention and rollback

Simpan release aktif dan minimal satu release sebelumnya sampai observasi selesai. Backup wajib checksum dan dipulihkan di lokasi/database terisolasi sebelum dianggap valid. Jangan hapus satu-satunya known-good backup otomatis.

## Volatile facts

Gunakan `bash scripts/ssot-status.sh` dan probe host/database yang aman. Jangan memperbarui dokumen dengan menebak build ID, status service, migration, gateway, atau provider.
