# SOP Backup & Restore Aircon

1. Backup hanya dari release directory yang sudah diverifikasi:
   `bash scripts/backup-release.sh /opt/aircon-releases/<sha>`
2. `.env` tidak pernah masuk archive. Simpan checksum bersama archive.
3. Database backup harus dibuat oleh operator VPS dengan `pg_dump` ke storage terenkripsi; credential tidak ditulis ke log.
4. Restore selalu ke directory/database terisolasi terlebih dahulu:
   `bash scripts/restore-release.sh <archive.tar.gz> /tmp/aircon-restore-<id>`
5. Boot-test restored bundle, cek asset/static/public, OAuth URI, dan invariant database sebelum approval.
6. Pertahankan active release dan setidaknya satu known-good backup; jangan hapus backup tunggal otomatis.
