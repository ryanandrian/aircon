# Panduan Integrasi WhatsApp Gateway (untuk developer aplikasi)

> Audience: developer yang membangun aplikasi lain di portofolio dan butuh kirim/terima
> WhatsApp. Anda TIDAK perlu memasang whatsapp-web.js di app Anda — cukup panggil gateway.

## 1. Konsep 60 detik

**Status delivery (keputusan ACK-less — canonical contract di `lumite-gateway/docs/06_SSOT_Delivery_Callback_Contract_v2.md`):** `DELIVERED` adalah acceptance transport utama. `READ_CONFIRMED` hanya bila WhatsApp mengirim ACK_READ=3. Tanpa ACK_READ dalam observation window, gunakan `READ_UNOBSERVED` — bukan `UNREAD` dan bukan kegagalan. Balasan pelanggan adalah event `INTERACTED` terpisah.
- **App Anda** memanggil REST API gateway (`X-Api-Key`) untuk kirim pesan & kelola sesi.
- **Gateway memanggil balik** (webhook) app Anda untuk: QR, ready, pesan masuk, status kirim.
- **Session** = 1 nomor WhatsApp. `externalId` = ID milik app Anda untuk nomor itu
  (untuk aircon = `tenantId`; untuk app lain bebas, mis. `userId` atau `storeId`).
  Gateway meng-namespace jadi `{appId}:{externalId}` → app lain tak bisa menyentuh sesi Anda.

## 2. Didaftarkan dulu (sekali)
Minta admin infra menambah app Anda ke `GATEWAY_APPS` (di `.env` gateway):
```json
{"id":"appanda","key":"<API_KEY_RAHASIA>","webhook":"https://appanda.example.com/api/wa/callback"}
```
- `id` unik per app. `key` = rahasia (dikirim di header tiap request). `webhook` = URL app
  Anda yang menerima callback. Simpan `key` di ENV app Anda (jangan hardcode).

## 3. Base URL
- Dev/pilot: `http://<IP_VPS_INFRA>:8080`
- Produksi: `https://gateway.<domain-anda>` (di belakang nginx + TLS).

## 4. Alur khas
### 4.1 Siapkan sesi + tampilkan QR ke user
```
POST /v1/wa/sessions/{externalId}/init
Header: X-Api-Key: <key>
→ { ok:true, sessionId, ready:false, qr:"data:image/png;base64,..." }
```
Tampilkan `qr` (data URL) ke user Anda untuk discan (WhatsApp > Perangkat Tertaut).
Saat tertaut, gateway callback `{type:"ready"}` ke webhook Anda.

### 4.2 Cek status sesi
```
GET /v1/wa/sessions/{externalId}   → { exists, ready, qr }
```

### 4.3 Kirim pesan
```
POST /v1/wa/send
Header: X-Api-Key: <key>
Body: { "externalId":"<id>", "toPhone":"62812xxxx", "message":"Halo!" }
→ { ok:true, queued:true, messageId }
```
Gateway antre + kirim dengan throttle anti-ban. Hasil dikirim via webhook (`sent`/`failed`).

### 4.4 Logout sesi
```
DELETE /v1/wa/sessions/{externalId}
```

## 5. Webhook yang HARUS app Anda sediakan

Gateway POST JSON ke `webhook` Anda. Bentuk payload (`type` membedakan):
```jsonc
{ "type":"qr",          "externalId":"...", "qr":"data:image/png;base64,..." }
{ "type":"ready",       "externalId":"..." }
{ "type":"disconnected","externalId":"...", "reason":"..." }
{ "type":"inbound",     "externalId":"...", "fromPhone":"62...", "body":"pesan masuk" }
{ "type":"sent",        "externalId":"...", "messageId":"...", "toPhone":"62..." }
{ "type":"failed",      "externalId":"...", "messageId":"...", "error":"..." }
{ "type":"delivery_status", "externalId":"...", "deliveryId":"...", "idempotencyKey":"...", "gatewayMessageId":"...", "waMessageId":null, "toPhone":"62...", "status":"SENT|DELIVERED|READ_CONFIRMED|READ_UNOBSERVED|FAILED|RETRY_WAIT", "ack":1 }
```
`DELIVERED` adalah acceptance device yang reliable. `READ_CONFIRMED` adalah bukti opsional. `READ_UNOBSERVED` berarti tidak ada ACK_READ dalam observation window; bukan failure dan bukan `UNREAD`. Balasan masuk adalah interaksi terpisah.
Verifikasi signature HMAC sesuai SSOT gateway, proses idempoten berdasarkan `gatewayMessageId + status`, dan balas HTTP 200 maksimal 5 detik.

## 6. Contoh (Node/TypeScript, dari app mana pun)
```ts
const GW = process.env.WA_GATEWAY_URL!;      // https://gateway.domain
const KEY = process.env.WA_GATEWAY_KEY!;     // API key app Anda
async function sendWa(externalId: string, toPhone: string, message: string) {
  const r = await fetch(`${GW}/v1/wa/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": KEY },
    body: JSON.stringify({ externalId, toPhone, message }),
  });
  if (!r.ok) throw new Error(`gateway ${r.status}`);
  return r.json();
}
```

## 7. Cara aircon memakainya (referensi implementasi)
aircon TIDAK memuat whatsapp-web.js. Alur aircon:
1. App menulis `MessageLog(status=QUEUED)`.
2. Adapter Aircon memanggil `POST /v1/wa/send` melalui shared gateway.
3. Callback dapat menaikkan status menjadi `SENT` atau `DELIVERED`.
4. `READ_CONFIRMED` hanya ditulis jika gateway menerima ACK_READ=3.
5. Jika observation window berakhir tanpa ACK_READ, status operasional adalah `READ_UNOBSERVED` — bukan FAILED dan bukan klaim `UNREAD`.
6. Balasan pelanggan dicatat terpisah sebagai `INTERACTED`.

## 8. Masa depan (penting untuk keputusan desain Anda)
Mesin di balik gateway akan **ditukar dari whatsapp-web.js ke WhatsApp Cloud API** saat
skala tumbuh. **Kontrak API di dokumen ini TIDAK berubah** — app Anda tetap `POST /v1/wa/send`.
Jadi bangun app Anda terhadap API ini, jangan pernah panggil whatsapp-web.js langsung.

## 9. Batasan & etika (WAJIB dipahami) — server NOTIFIKASI, bukan blasting
Gateway ini dirancang untuk **notifikasi transaksional/opt-in** (pengingat servis,
konfirmasi booking, status pekerjaan, tagihan) — BUKAN blasting promosi massal.
Proteksi anti-ban yang SUDAH tertanam di gateway (otomatis, tak perlu app urus):

| Proteksi | Fungsi |
|---|---|
| **Jeda acak manusiawi** (6–15 dtk) | pola kirim tak seperti bot |
| **Batas per menit / nomor** (default 8) | cegah burst |
| **Plafon HARIAN / nomor** (default 200) | batas wajar notifikasi; di atas ini ditunda |
| **Warm-up nomor baru** (7 hari ramp) | nomor baru mulai pelan (±20/hari) lalu naik — kritis agar tak langsung diblokir |
| **Jam tenang** (21:00–07:00 WIB) | tak kirim tengah malam (mencurigakan + mengganggu) |
| **Dedup** | pesan identik ke nomor sama dalam 60 dtk ditolak (cegah kirim ganda) |
| **Batas sesi hidup + evict idle** | hemat RAM; Chromium idle ditutup |

Semua angka di atas dari ENV (setel di `.env` gateway tanpa ubah kode). **Aturan pakai:**
- Kirim HANYA pesan yang diminta/diharapkan penerima (transaksional/opt-in). Jangan promosi massal.
- Sediakan cara berhenti (STOP) bila mengirim pesan berulang non-transaksional.
- Jika `POST /v1/wa/send` mengembalikan `409 duplicate`, itu dedup — jangan retry membabi-buta.
- Pesan yang melebihi plafon harian TIDAK hilang — tetap diantre & terkirim hari berikutnya.

> Catatan RAM: 1 sesi = 1 nomor = ~250–500MB. Gateway membatasi jumlah sesi hidup
> (`WA_MAX_LIVE_SESSIONS`) & menutup sesi idle. Koordinasikan jumlah nomor aktif dengan
> admin infra (lihat 30_Capacity_and_Specs.md).
