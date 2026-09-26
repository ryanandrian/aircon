# RENCANA — Aircon Delivery Status (Terkirim / Sampai / Dibaca)

**Status:** PLAN — BELUM ada perubahan program.
**Trigger eksekusi:** FASE GATEWAY (`lumite-gateway`) dan FASE WA-CAMPAIGN sudah selesai 100% valid di production.
**SSOT contract:** `lumite-gateway/docs/06_SSOT_Delivery_Callback_Contract_v2.md`
**Rencana umum:** `lumite-gateway/docs/05_PLAN_Delivery_Status_ACK.md` → bagian F3.

Rencana ini KHUSUS domain Aircon. Gateway sudah menyiapkan event generic;
Aircon hanya mengonsumsinya — **tidak ada logika ACK di gateway yang bersifat khusus Aircon.**

---

## 1. Gap yang terbukti (fakta kode)

| # | Gap | Bukti |
|---|-----|-------|
| G-A1 | Tenant Aircon TIDAK melihat status pengiriman WA sama sekali | tidak ada query `MessageLog` di halaman UI tenant |
| G-A2 | `MessageLog` ditandai `SENT` saat HTTP gateway sukses, **bukan** saat pesan benar-benar terkirim | `message-dispatch-service.ts:39-44` |
| G-A3 | Callback Aircon menuntut `x-callback-secret`; gateway mengirim `x-inbound-token` → kemungkinan 401 setiap callback | kedua source |
| G-A4 | Gateway tidak memeriksa status HTTP response callback → kegagalan hilang diam-diam | `lumite-gateway/gateway-engine/src/wa-manager.js:176-186` |
| G-A5 | Tidak ada konsep `READ` di Aircon | `MessageStatus` enum: QUEUED, SENDING, SENT, DELIVERED, FAILED, LOGGED |
| G-A6 | `DELIVERED` sudah ada di enum tetapi hanya dipakai untuk pesan **INBOUND**, belum pernah untuk OUTBOUND | `api/wa/callback/route.ts:37` |

> Catatan: `TenantNotification.readAt` adalah **lonceng in-app**, BUKAN status kirim WA.
> Dua hal berbeda; jangan tertukar.

---

## 2. Aturan status canonical (dari contract v2)

```text
QUEUED     request diterima gateway
SENT       WhatsApp menerima submission      ← ARTI TIDAK BERUBAH (backward compat)
DELIVERED  ACK_DEVICE — sampai ke HP tujuan
READ       ACK_READ   — dibaca
FAILED     gagal permanen
RETRY_WAIT gagal sementara
```

Aturan keras di Aircon:
```text
1. MONOTONIC : QUEUED < SENT < DELIVERED < READ — tidak pernah turun
2. IDEMPOTENT: dedupe per gatewayMessageId + status
3. SENT tidak pernah diturunkan oleh FAILED datang telat
   (FAILED hanya sah bila status masih QUEUED/SENDING)
4. DELIVERED/READ = informasi tambahan, BUKAN syarat sukses.
   ACK bisa tidak datang; pesan tetap sukses bila SENT.
```

---

## 3. Scope pekerjaan Aircon

### S1. Auth callback (sinkron dengan gateway)
- Verifikasi `X-Gateway-Key-Id` + `X-Gateway-Timestamp` + `X-Gateway-Signature`
  (HMAC-SHA256 atas `timestamp + "." + sha256(rawBody)`).
- Replay window ±300 detik, timing-safe compare.
- **Hapus ketergantungan pada `x-callback-secret` tunggal** — atau pertahankan
  sementara sebagai fallback selama masa dual-publish.
- `WA_GATEWAY_CALLBACK_SECRET` tetap dipakai sebagai material HMAC.

### S2. Prisma migration
```prisma
enum MessageStatus {
  QUEUED
  SENDING
  SENT
  DELIVERED
  FAILED
  LOGGED
  READ        // ← TAMBAHAN
}
```
- Migration forward + migration rollback wajib teruji.
- Tidak ada perubahan relasi/index lain.

### S3. Handler callback `delivery_status` (v2)
- Terima payload contract v2.
- Guard monotonic + idempotent.
- Catat `gatewayMessageId` bila belum ada (untuk korelasi dan reconciler).
- Payload v1 (`sent`/`failed`) tetap diproses selama dual-publish.

### S4. Perbaikan penandaan awal
- `message-dispatch-service`: `SENT` tetap ditulis saat HTTP gateway accepted
  (backward compatible, tidak merusak money-loop).
- `DELIVERED`/`READ` hanya menaikkan status, tidak pernah menurunkan.
- Evaluasi: berhenti memakai `SENT` sebagai proxy keberhasilan akhir di UI.

### S5. UI tenant — riwayat notifikasi WA
- Tampilan 4 status dengan label:
  ```text
  Antre              → menunggu pengiriman
  Terkirim           → diterima WhatsApp
  Diterima perangkat → sampai ke HP tujuan
  Dibaca             → dibaca
  ```
- Filter + ringkasan per kategori pesan (reminder, invoice, dunning, platform).
- Indikator jelas bila status lama (`SENT`) belum pernah menerima ACK.

### S6. Reconciler
- Periodik: pesan `SENT` yang terlalu lama tanpa ACK → ditandai
  `SENT (tanpa konfirmasi)`, bukan diam-diam dianggap sampai.
- Callback hilang → dipulihkan bila gateway masih menyimpan mapping.

### S7. Regression money-loop (WAJIB lulus semua)
```text
reminder-service       → grouped reminder per pelanggan
dunning-service        → tunggakan
invoice-service        → kirim invoice & kwitansi
inactivity-sweeper     → reminder inaktivitas
platform-notification  → notifikasi platform
message-dispatch       → flusher antrean
tenant UI + cron routes
test suite             → 369 test harus tetap lulus
```

---

## 4. Prasyarat (belum terpenuhi saat ini)

```text
[ ] Akses deploy/Aircon prod 103.127.135.132
    (port 22 TERTUTUP dari environment ini saat ini)
[ ] Jalur backup DB Aircon + checksum + restore dry-run
[ ] Staging/preview instance Aircon
[ ] Konfirmasi gateway F1 lulus (log callback tidak lagi hilang)
[ ] Konfirmasi campaign F2 lulus (DELIVERED/READ terbukti live)
```

Selama prasyarat ini belum ada, **fase Aircon tetap TIDAK DIMULAI.**

---

## 5. Gate acceptance Aircon

```text
[ ] Migration apply + rollback teruji
[ ] Seluruh regression money-loop lulus (369 test)
[ ] Callback signature valid (0x 401 pada observasi window)
[ ] BUKTI LIVE: notifikasi Aircon naik
    QUEUED → SENT → DELIVERED → READ pada pengiriman nyata
[ ] Status hanya naik (monotonic) — uji out-of-order
[ ] Idempoten — kirim callback ganda, counter tidak ganda
[ ] Tenant melihat status di UI
[ ] Rollback deploy + rollback migration terbukti
[ ] SSOT (gateway + aircon) konsisten
```

---

## 6. Urutan kerja

```text
Gateway F1 lulus
→ Campaign F2 lulus
→ Aircon: backup → migration → callback handler → UI → reconciler
→ regression money-loop → live acceptance → rollback drill
→ final acceptance lintas ketiga app
```

Aircon TIDAK dikerjakan lebih awal, karena:
1. owner meminta gateway & campaign tuntas dulu;
2. host Aircon terpisah dan akses deploynya belum ada;
3. menjaga satu contract disalin oleh tiga app tanpa bergeser di tengah jalan.
