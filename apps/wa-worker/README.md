# AC WA Worker (whatsapp-web.js)

Service **long-running** yang mengirim & menerima WhatsApp untuk semua tenant.
BUKAN bagian dari app Next.js (Vercel serverless tak bisa memegang koneksi WA persisten).

## Cara kerja
- Satu sesi WhatsApp **per tenant** (`LocalAuth`, clientId = tenantId). Nomor WA = nomor tenant sendiri.
- Poll `message_log` di Supabase untuk baris `driver=WEB, direction=OUTBOUND, status=QUEUED` → kirim → update `SENT/FAILED`.
- Balasan customer masuk sebagai `direction=INBOUND`.
- **Anti-ban:** jeda acak antar pesan + batas per menit per tenant. Jangan blast.

## Ketahanan
- Worker mati → pesan tetap `QUEUED` di DB, terkirim saat worker nyala lagi.
- Restart → sesi dipulihkan dari `WA_SESSION_DIR` (tak perlu scan QR ulang).

## Onboarding tenant (scan QR)
Saat tenant pertama kali, worker menampilkan **QR di console**. Tenant buka
WhatsApp > Perangkat Tertaut > Tautkan Perangkat → scan. (Untuk produksi, QR ini
akan dialirkan ke UI onboarding owner; v1.0 dev: via console.)

## Jalankan
```bash
cd apps/wa-worker
pnpm install
export SUPABASE_URL=...            # sama dgn project app
export SUPABASE_SERVICE_ROLE_KEY=...
node src/worker.js
```

## ENV
| var | default | fungsi |
|---|---|---|
| SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY | — | akses DB (wajib) |
| WA_POLL_MS | 5000 | interval poll antrean |
| WA_MIN_GAP_MS / WA_MAX_GAP_MS | 4000 / 9000 | jeda acak antar kirim |
| WA_MAX_PER_MIN | 12 | batas kirim/tenant/menit |
| WA_SESSION_DIR | ./.wwebjs_auth | lokasi sesi WA |

## Host produksi
Butuh host nyala 24/7 (VPS murah disarankan). 1 Chromium ≈ 300-500MB RAM per sesi tenant;
batasi jumlah sesi per host, scale-out dengan menambah worker (shard per tenant).
