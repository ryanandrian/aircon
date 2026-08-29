# Rencana Migrasi APP Aircon: Vercel → VPS (bebas-bug, terverifikasi)

Status: RENCANA (belum eksekusi). Prinsip: tiap tahap punya GERBANG VERIFIKASI — tak lanjut sebelum hijau.
Tujuan: pindah APP aircon (bukan gateway) dari Vercel serverless ke VPS Node, tanpa bug baru & tanpa downtime tak terkendali.

---

## 0. KEPUTUSAN YANG HARUS DIKUNCI DULU (menentukan risiko bug)
1. **VPS target app**: 103.103.22.227 (SSH `vps` sudah ada) ATAU VPS baru?  → menentukan resource & isolasi dari gateway (103.127.138.16).
2. **Database**:
   - Opsi A (DIREKOMENDASIKAN, risiko minimal): TETAP Supabase Postgres. Hanya APP yang pindah; DB tak disentuh → nol risiko kehilangan/migrasi data. Cukup pastikan VPS bisa akses Supabase (pooler port 6543 / direct 5432).
   - Opsi B: Postgres self-hosted di VPS. Perlu dump+restore + uji integritas + ganti DATABASE_URL. Risiko jauh lebih besar. TIDAK disarankan untuk cutover pertama.
3. **Domain app**: mis. `app.lumite.biz.id` → butuh A record ke IP VPS, TLS (Let's Encrypt), dan update:
   - `NEXT_PUBLIC_APP_URL`
   - Google OAuth redirect URI (Supabase Auth + Google Console)
   - Midtrans notification/callback URL (jika pakai domain app)
   - WA gateway callback (jika app jadi tujuan callback)

## 1. SIAPKAN APP UNTUK VPS (di repo, aman diuji lokal)
- [ ] `next.config.ts`: tambah `output: "standalone"` → build mandiri, tak butuh `next start` penuh node_modules. GERBANG: `pnpm build` sukses + `.next/standalone` muncul.
- [ ] Pastikan Prisma client ter-generate di build VPS (postinstall / build step). GERBANG: `node .next/standalone/server.js` boot lokal OK.
- [ ] Tidak ada dependensi Vercel-only (edge runtime, `@vercel/*`). GERBANG: grep bersih.
- [ ] Uji lokal: `pnpm build && node .next/standalone/server.js` → landing + /login + 1 API route 200.

## 2. INFRA VPS (native systemd, konsisten dgn gateway yg sudah ada)
- [ ] Node LTS + pnpm (samakan versi dgn dev: Node 26.x, pnpm 9).
- [ ] User non-root `aircon`, dir `/opt/aircon-app`.
- [ ] `aircon-app.service` (systemd): `node server.js`, PORT=3000, EnvironmentFile=/opt/aircon-app/.env, restart=always.
- [ ] Nginx reverse proxy :443 → :3000 + Let's Encrypt (certbot) utk domain app.
- [ ] Firewall: buka 80/443; app port 3000 hanya localhost.
- GERBANG: `curl https://app.domain/` → landing 200 + TLS valid.

## 3. ENV (28 var — pindah dari Vercel ke /opt/aircon-app/.env)
Kelompok (nilai diambil dari Vercel env / yang Anda pegang; JANGAN commit):
- Supabase: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL, DIRECT_URL
- App: NEXT_PUBLIC_APP_URL (→ domain VPS)
- Midtrans (PROD live): MIDTRANS_ENV, *_SERVER_KEY, NEXT_PUBLIC_* client keys, MERCHANT_ID
- IoT/EMQX: EMQX_*, IOT_BRIDGE_TOKEN
- WA gateway: WA_GATEWAY_URL/KEY/CALLBACK_SECRET
- Lain: PARTNER_ENC_KEY, SESSION_SECRET, CRON_SECRET
- GERBANG: script cek semua 28 key terisi sebelum start (fail-fast).

## 4. CRON (Vercel cron → systemd timer) — PENTING
Vercel `vercel.json` punya 3 cron: dunning (01:00), reminders (02:00), reconcile (03:00).
Di VPS Vercel cron TIDAK jalan. Ganti dengan 3 systemd timer yang `curl` endpoint dgn header `Authorization: Bearer $CRON_SECRET`:
- [ ] aircon-dunning.timer → 01:00
- [ ] aircon-reminders.timer → 02:00
- [ ] aircon-reconcile.timer → 03:00
- Catatan: di VPS BEBAS sub-daily (tak seperti Vercel Hobby 1x/hari). Tapi pertahankan jadwal sama dulu utk paritas.
- GERBANG: jalankan manual tiap endpoint → 200 + efek benar (cek DB), lalu pastikan timer aktif.

## 5. CUTOVER (tanpa kaget)
- [ ] Deploy app ke VPS + semua GERBANG 1-4 hijau, TAPI DNS masih ke Vercel.
- [ ] Uji VPS via IP/hosts sementara: login Google, buat pekerjaan, invoice, bayar (Midtrans), kirim WA, cron manual. SEMUA hijau.
- [ ] Baru arahkan DNS domain → VPS. TTL rendah dulu.
- [ ] Pantau 24 jam. Rollback = arahkan DNS balik ke Vercel (DB sama, aman).

## 6. VERIFIKASI PASCA-CUTOVER (bukti nyata, bukan asumsi)
- [ ] Landing + SEO (sitemap/robots/JSON-LD) 200 di domain baru.
- [ ] Login owner (Google) — redirect URI baru bekerja.
- [ ] Login teknisi (phone+PIN).
- [ ] Alur uang: kerja→invoice→bayar Midtrans→webhook masuk→status update.
- [ ] WA nyata terkirim (bukan queued).
- [ ] Upload logo (server-side) sukses.
- [ ] 3 cron timer jalan + efek benar.
- [ ] Tidak ada 5xx di log 24 jam.

## RISIKO UTAMA (yang biasa bikin "banyak bug saat pindah") & mitigasi
1. **OAuth Google callback** beda domain → login gagal. Mitigasi: daftarkan redirect URI domain VPS di Google Console + Supabase SEBELUM cutover.
2. **Midtrans notification URL** masih ke Vercel → status bayar tak update. Mitigasi: update di Midtrans dashboard saat cutover.
3. **Cron tak jalan** (lupa timer) → dunning/reminder mati diam. Mitigasi: GERBANG #4 wajib.
4. **Env kurang 1 var** → crash saat fitur dipakai. Mitigasi: fail-fast check 28 var.
5. **Standalone build** kurang file statis/public. Mitigasi: copy `.next/static` + `public` sesuai dok Next standalone. GERBANG boot lokal.
6. **DB pooling**: Supabase pooler (6543) vs direct (5432) — pakai yang benar utk runtime vs migrasi.
