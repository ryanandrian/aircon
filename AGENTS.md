# Aircon — Prosedur Deploy (WAJIB DIBACA DULU)

Repo ini punya fungsi deploy PERMANEN. Untuk SEMUA permintaan deploy/update/upload ke VPS:

```bash
cd /home/rad/aircon && bash scripts/deploy-vps.sh
```

Aturan keras:
- JANGAN menyusun ulang, menyalin, atau menulis prosedur/script deploy baru. Jangan
  membuat langkah manual paralel, temp file, atau pemeriksaan improvisasi.
- JANGAN mengubah `scripts/deploy-vps.sh` kecuali run-nya GAGAL. Kalau gagal: baca
  error → perbaiki SATU baris terkait → commit → jalankan ulang. Jangan tambal per-modul.
- Jangan commit apapun selain perbaikan itu (file secret/generated tidak boleh ikut).
- Script sendiri yang menegakkan: tree bersih + HEAD==origin/main, build pakai .env
  produksi VPS, boot-test lokal, checksum remote, boot-test di VPS, switch atomic
  dengan rollback otomatis, retensi maksimal 3 release, verifikasi https 200, dan
  guard idempoten (commit sudah live → tidak ada yang diubah, exit 0).
- Kalau sudah PASS, TIDAK ADA lagi yang perlu dikerjakan — jangan melakukan verifikasi
  tambahan, pengecekan tambahan, atau perbaikan tambahan.
- Fakta layout (diverifikasi 2026-10-02): `current -> releases/<sha>/app`,
  `source-sha` ada di `releases/<sha>/source-sha` (BUKAN di dalam `app/`),
  service `aircon-app`, host `truerad@103.127.135.132`, key `~/.ssh/airconet-app.pem`.
- Skill pendukung: `aircon-live-deploy` (jalur + evidence gate + checklist PASS).

Kegagalan historis yang tidak boleh terulang: commit 827f534 pernah MENGHAPUS script
deploy sehingga tiap sesi menulis ulang dari nol dan gagal berulang kali. Script ini
sudah ter-track di git — pertahankan.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
