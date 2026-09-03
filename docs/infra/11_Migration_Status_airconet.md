# Status Migrasi App Aircon → VPS airconet.id

Terakhir diperbarui: 3 Sep 2026. Diisi otomatis dari eksekusi terverifikasi.

## RINGKAS
App LIVE di **https://app.airconet.id** (TLS, Node 22, standalone). Vercel MASIH jalan paralel (DB Supabase sama).
Tahap 1–5 SELESAI & terverifikasi bukti nyata. Sisa: Tahap 6 (arahkan 3 callback + cutover) — MENUNGGU keputusan owner.

## INFRA VPS (terverifikasi)
- IP: 103.127.135.132 · user `truerad` · sudo NOPASSWD · Ubuntu 22.04.5
- Key SSH: `~/.ssh/airconet-app.pem` (sumber: `~/Downloads/aircon-ssh (1).pem`)
- Node **22.23.2** (upgrade dari 20; warning Supabase hilang) · pnpm 9.15.9
- Swap 2GB aktif · RAM app ~353MB dari 1.9GB (sangat lega)
- Hardening: UFW (hanya 22/80/443; 3000 tertutup) · fail2ban sshd aktif · SSH key-only, no-root, no-password (`/etc/ssh/sshd_config.d/99-hardening.conf`)

## APP DEPLOY (terverifikasi)
- Dir: `/opt/aircon-app` · systemd `aircon-app.service` (bind 127.0.0.1:3000, restart=always, hardening ProtectSystem)
- Build: `output: "standalone"` (next.config.ts). FIX WAJIB tiap deploy: salin `@swc/helpers/esm` yang hilang dari tracing pnpm (kalau tidak → MODULE_NOT_FOUND saat boot).
- Bundle dikirim via tar+scp lalu ekstrak. `.next/static` + `public` disalin ke standalone.
- ENV: `/opt/aircon-app/.env` (chmod 600) — 24/24 var kritis terisi (gerbang `check-env.sh` HIJAU).
  - Nilai dirakit dari `.env` lokal + `.secrets/vps-infra-credentials.txt` + nilai domain/SMTP.
  - EMQX_* & SUPABASE_SERVICE_ROLE_KEY = DEAD (0 pemakaian di kode; IoT pakai Mosquitto). Tak diisi = benar.
  - Midtrans: 2 kunci permanen (SANDBOX+PRODUCTION_SERVER_KEY) + MIDTRANS_ENV=production.
  - SMTP admin@lumite.biz.id (mail.lumite.biz.id:465) — TERBUKTI kirim email (250 OK).

## VERIFIKASI FUNGSIONAL (bukti nyata)
- HTTPS dari internet: airconet.id / www / app → semua 200; HTTP→HTTPS 301.
- Sertifikat Let's Encrypt SAN (3 nama), auto-renew aktif, expires 2 Des 2026.
- Landing render konten dari DB Supabase; /pratinjau tampil 12 PreviewItem + gambar S3.
- /api/wa/policy → 401 (guard bekerja). Tak ada 5xx/Prisma error di log.
- 3 systemd timer (dunning 01:00, reminders 02:00, reconcile 03:00 WIB) aktif; uji manual → 200 + JSON efek nyata (termasuk platformNotify autopilot).

## ARSITEKTUR DOMAIN (final, pola 12-SaaS)
- `airconet.id` + `www` → landing/marketing
- `app.airconet.id` → aplikasi (SEMUA tenant via SESI login; admin = path `/admin`)
- TIDAK per-tenant subdomain (Google OAuth tak dukung wildcard redirect + beban ops wildcard TLS/DNS). Custom-domain enterprise (CNAME) ditunda sampai permintaan nyata.
- nginx: `/etc/nginx/sites-available/aircon` (3 server_name → upstream 127.0.0.1:3000).

## SISA — TAHAP 6 (MENUNGGU OWNER; jangan eksekusi tanpa jawaban eksplisit)
1. **OAuth (Supabase dashboard SAJA — Google Console TAK berubah):**
   - Authentication → URL Configuration → Redirect URLs tambah `https://app.airconet.id/**`
   - Site URL → `https://app.airconet.id`  (project ref: ksvdjtzfpictmwuksmuu)
2. **Midtrans dashboard:** Payment Notification URL → `https://app.airconet.id/api/billing/midtrans-webhook`
3. **WA gateway callback (BISA dikerjakan agent, tapi gateway LIVE — konfirmasi dulu):**
   - Di VPS gateway 103.127.138.16, GATEWAY_APPS app `aircon` webhook: `aircon-peach.vercel.app` → `app.airconet.id`
4. **Verifikasi end-to-end di app.airconet.id lalu cutover DNS/rollout final:**
   - login Google, buat pekerjaan, invoice, bayar Midtrans NYATA (webhook masuk→status update), WA nyata terkirim, upload logo/foto (S3).
   - Rollback = arahkan balik ke Vercel (DB sama, aman).

## CATATAN
- Node 22 dipakai (bukan 20). 
- Deprecation Supabase hilang.
- Warm-up WA 7hr + pilot masih blocker go-komersial (paralel, tak tergantung migrasi).
