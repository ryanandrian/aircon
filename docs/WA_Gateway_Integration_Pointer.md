# Referensi Teknis Integrasi WhatsApp Gateway — keputusan ACK-less

Dokumen kanonik integrasi gateway berada di:

- https://gw.lumite.biz.id/integration-guide.md
- `docs/06_SSOT_Delivery_Callback_Contract_v2.md` di repository `lumite-gateway`

## Pendaftaran aplikasi

Setiap aplikasi wajib didaftarkan di registry gateway oleh admin infra:

```json
{
  "id": "appanda",
  "key": "<API_KEY_RAHASIA>",
  "webhook": "https://appanda.example.com/api/wa/callback"
}
```

Registry production saat ini memuat aplikasi terdaftar yang disetujui. App ID, API key, webhook, dan callback secret tidak boleh di-hardcode atau dicatat di source/help publik.

## Kontrak pengiriman

Aplikasi memanggil `POST /v1/wa/send` memakai `X-Api-Key`. Gateway mengelola antrean, lease, retry, idempotency, pacing, quiet hours, dan sesi WhatsApp.

## Status callback

Gateway dapat mengirim `delivery_status` dengan status:

```text
QUEUED, SENT, DELIVERED, READ_CONFIRMED, READ_UNOBSERVED, FAILED, RETRY_WAIT
```

`DELIVERED` adalah acceptance transport utama. `READ_CONFIRMED` hanya diterbitkan bila gateway menerima ACK_READ=3 dari WhatsApp Web. `READ_UNOBSERVED` berarti tidak ada ACK_READ dalam observation window; bukan failure dan bukan `UNREAD`.

Balasan inbound pelanggan adalah event `INTERACTED`/inbound terpisah. Aplikasi tidak boleh mengubah balasan menjadi klaim READ secara retroaktif.

## Aturan consumer

- Verifikasi callback HMAC, timestamp, body hash, dan key ID sesuai SSOT.
- Balas HTTP 200 maksimal lima detik.
- Proses idempoten dengan `gatewayMessageId + status`.
- Terapkan status monotonic.
- Jangan retry membabi-buta atas `409 duplicate`.
- Jangan menggunakan `READ` sebagai syarat bisnis pengiriman atau acceptance transaksi.
- Jika aplikasi ingin menampilkan status, gunakan label `Dibaca terkonfirmasi` dan `Status baca tidak teramati`, bukan `Belum dibaca`.

## Implementasi Aircon

Aircon memakai `src/lib/wa/gateway-relay.ts`, `MessageLog.gatewayMessageId`, dan callback `/api/wa/callback`. Detail source-of-truth tidak disalin ke dokumen produk lain; perubahan kontrak harus dilakukan di SSOT gateway lalu disinkronkan ke consumer.
