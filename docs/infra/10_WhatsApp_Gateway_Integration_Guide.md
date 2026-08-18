# Panduan Integrasi WhatsApp Gateway (untuk developer aplikasi)

> Audience: developer yang membangun aplikasi lain di portofolio dan butuh kirim/terima
> WhatsApp. Anda TIDAK perlu memasang whatsapp-web.js di app Anda — cukup panggil gateway.

## 1. Konsep 60 detik
- **Gateway** = 1 service bersama di VPS-INFRA yang memegang mesin WhatsApp.
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
```
Rekomendasi: verifikasi sumber (mis. shared secret / IP allowlist) & proses idempoten
(pakai `messageId`).

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
1. App menulis `MessageLog(status=QUEUED)` (money-loop reminder, dunning, dsb).
2. Sebuah adapter (`src/lib/wa/gateway.ts` + relay) memanggil `POST /v1/wa/send` gateway,
   `externalId = tenantId`.
3. Callback gateway (`/api/wa/callback`) meng-update status & menyimpan pesan masuk.
> Catatan: selama pilot, aircon bisa tetap pakai worker lama (poll DB). Untuk portofolio,
> pola gateway inilah yang dipakai semua app baru. Lihat 40_Migration_and_Rollout.md.

## 8. Masa depan (penting untuk keputusan desain Anda)
Mesin di balik gateway akan **ditukar dari whatsapp-web.js ke WhatsApp Cloud API** saat
skala tumbuh. **Kontrak API di dokumen ini TIDAK berubah** — app Anda tetap `POST /v1/wa/send`.
Jadi bangun app Anda terhadap API ini, jangan pernah panggil whatsapp-web.js langsung.

## 9. Batasan & etika (wajib dipahami)
- whatsapp-web.js = tak resmi → ada risiko ban. Hormati throttle, jangan spam, pakai
  hanya untuk pesan yang diminta/diharapkan user (transaksional/opt-in).
- 1 sesi = 1 nomor = ~250–500MB RAM di gateway. Koordinasikan jumlah sesi dengan admin infra
  (lihat 30_Capacity_and_Specs.md).
