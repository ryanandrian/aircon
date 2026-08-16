# WHATSAPP STRATEGY — whatsapp-web.js (WEB) sebagai jalur tunggal v1.0

**Keputusan:** WhatsApp sepenuhnya lewat **whatsapp-web.js** (driver `WEB`). Tanpa WA Assisted. Meta Cloud API (`META`) disiapkan sebagai pintu enterprise fase berikutnya, di balik abstraksi yang sama (`Tenant.waDriver`).

## Kenapa WEB penuh
- **Gratis** (tanpa biaya per pesan Meta) + **otomatis penuh** (kirim & terima).
- Pakai **nomor WA tenant sendiri** → customer kenal pengirimnya.
- Sesuai permintaan: otomatisasi sejak v1.0, bukan 1-tap manual.

## Konsekuensi yang dikelola (bukan diabaikan)
| Risiko | Mitigasi |
|---|---|
| Nomor bisa diblokir (unofficial, ToS WA) | throttle jeda acak 4-9 dtk + batas 12/menit/tenant; tanpa blast; sarankan nomor khusus |
| Butuh host 24/7 (tak bisa Vercel) | service terpisah `apps/wa-worker` (long-running); dev = lokal, prod = VPS murah |
| Worker mati | antrean di DB (`message_log.status=QUEUED`) → terkirim saat worker nyala lagi |
| RAM per sesi (Chromium 300-500MB) | batasi sesi per host; scale-out shard per tenant |
| Onboarding perlu scan QR | QR per tenant (LocalAuth), sekali; v1.0 via console, prod via UI owner |

## Arsitektur
```
App/Edge  ──tulis──►  message_log(status=QUEUED, driver=WEB, toPhone, body)
                              │  (poll)
                     apps/wa-worker (whatsapp-web.js, sesi per tenant)
                              ├─ kirim ──► update SENT/FAILED
                              └─ balasan customer ──► insert INBOUND
```
- App utama tetap serverless (Vercel + Supabase). Hanya worker yang persisten.
- App tidak pernah memanggil whatsapp-web.js langsung — hanya menulis antrean. Loose coupling → aman & mudah diganti ke META nanti.

## Skema (sudah diterapkan)
- `Tenant.waDriver` enum {WEB, META} default **WEB**.
- `MessageLog`: `driver` default WEB, `toPhone`, status `QUEUED→SENT/DELIVERED/FAILED`, `direction` OUTBOUND/INBOUND, index `(driver,status)`.

## Template
Semua template WA (Build Spec Pack Part 3 §4) dipakai identik; worker hanya mengirim `body` final yang sudah dirender app.

## Jalur upgrade (fase enterprise)
Tambah driver `META` (Meta Cloud API, webhook di Edge Function) untuk tenant skala besar/berbayar — set `Tenant.waDriver=META`, tanpa ubah app.
