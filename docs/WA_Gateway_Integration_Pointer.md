# Integrasi WhatsApp Gateway (Lumite) — POINTER, bukan salinan

Aircon mengirim/menerima WhatsApp lewat **gateway BERSAMA Lumite** (bukan library sendiri).

## SSOT ada di gateway, BUKAN di repo ini
Panduan teknis lengkap (endpoint, auth, webhook, anti-ban) adalah SATU sumber yang dirawat
di gateway VPS dan disajikan di URL kanonik:

**https://gw.lumite.biz.id/integration-guide.md**

Jangan menyalin isinya ke repo ini (hindari SSOT ganda). Untuk membacanya, unduh langsung:

```bash
curl https://gw.lumite.biz.id/integration-guide.md -o /tmp/gateway-guide.md
```

## Implementasi Aircon yang sudah mengikuti guide itu
- `src/lib/wa/gateway-relay.ts` — klien REST ke gateway (send, init, status, logout).
- `src/app/app/pengaturan/wa-connect.tsx` — UI scan QR tenant.
- `src/app/admin/notifikasi/` — sesi WA platform Lumite (`lumite-platform`).

Config gateway (URL + key) DB-first via InfraConfig (admin panel), fallback ENV
`WA_GATEWAY_URL` / `WA_GATEWAY_KEY`.
