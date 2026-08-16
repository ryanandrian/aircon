# AC SERVICE GROWTH OS — DIFERENSIASI & DOMAIN STRATEGY

## Keputusan produk — Tenant Public Page + Booking (menyuap Money Loop)

**Konteks keputusan:** bisnis ini butuh diferensiasi & added value vs pesaing FSM yang sudah lebih dulu di market. Dokumen ini menetapkan DI MANA bertaruh diferensiasi (dan di mana tidak), serta strategi domain untuk platform & tenant.

---

## 1. PRINSIP: DIFERENSIASI DI YANG SUSAH DITIRU

Diferensiasi yang mudah ditiru = bukan moat. Fokus taruhan pada yang sulit ditiru pesaing:

| Moat (taruhan utama) | Kenapa susah ditiru | Status |
|---|---|---|
| **Money loop otomatis** (repeat engine) | pindah = kehilangan mesin repeat + history asset; butuh disiplin produk, bukan fitur tunggal | v1.0 (inti) |
| **IoT sebagai demand generator** | butuh hardware+firmware+jembatan lintas domain; pesaing software murni tak bisa cepat meniru | v1.0 (add-on) |
| **Data menumpuk** (asset history, telemetry, travel matrix) | makin lama makin pintar & makin mahal ditinggalkan | tumbuh seiring pakai |

**Komoditas (JANGAN dijadikan taruhan utama):** company profile statis, "punya website", kehadiran online biasa. Sudah disediakan Google Business Profile / IG / web builder gratis; pesaing bisa menyamai dalam minggu.

---

## 2. KEPUTUSAN: TENANT PUBLIC PAGE + BOOKING (versi minimal v1.0)

Website marketing bernilai **hanya bila menyuap money loop**, bukan sebagai brosur berdiri sendiri.

**Yang dibangun di v1.0 (kecil, berdampak):**
- Satu **halaman publik per tenant** di **subdomain platform**: `namatenant.acgrowth.com` (wildcard).
- Isi: nama usaha, layanan, area, kontak/WA, jam kerja, (opsional) galeri foto job.
- **Form booking publik** → otomatis membuat **Lead** (source=MARKETING/WEBSITE) di sistem tenant → masuk money loop (lead → job → history → repeat).
- Tombol WA langsung (konsisten prinsip WhatsApp-first).

**Kenapa ini worth it di 25 hari:**
- Memanfaatkan tabel `Lead` & alur Growth yang **sudah ada di skema** — tambahannya kecil (1 halaman publik + 1 endpoint booking).
- Memberi cerita diferensiasi konkret sejak hari-1 ke tenant DAN investor: *"daftar hari ini → langsung punya halaman + terima booking online yang otomatis masuk ke sistem Anda."*
- Memperkuat pilar **Get Customers** tanpa menggeser fokus dari moat inti.

**Yang TIDAK dibangun di v1.0 (ditunda fase 2, berbasis bukti):**
- Domain kustom milik tenant (`www.acjaya.com`) — arsitektur disiapkan, eksekusi fase 2.
- Template website kaya / multi-halaman / builder — fitur berbayar **paket Pro**, pasca-pilot.
- SEO lanjutan, blog, dsb.

---

## 3. STRATEGI DOMAIN

### 3.1 Domain platform (milik perusahaan)
- Aplikasi operasional: `app.<domainperusahaan>` (tenant & teknisi login).
- Halaman publik tenant: `*.<domainperusahaan>` (wildcard subdomain) → `namatenant.<domainperusahaan>`.
- Marketing platform (jualan SaaS ke tenant): `www.<domainperusahaan>` / root.

### 3.2 Vercel + custom domain (terverifikasi)
- Vercel mendukung **custom domain penuh + wildcard `*.domain`**, termasuk di paket **Hobby (gratis)**, dengan **SSL otomatis gratis**.
- Beli nama domain di registrar mana pun (Cloudflare/Niagahoster/Namecheap) → arahkan DNS ke Vercel.
- Biaya satu-satunya: harga domain di registrar (~Rp150–200rb/th untuk .com). Opsional saat pilot (bisa pakai `*.vercel.app` dulu).

### 3.3 Domain kustom tenant (fase 2)
- Tenant beli domain sendiri → arahkan (CNAME) ke platform → Vercel Domains API menambah domain + SSL otomatis.
- Dijadikan fitur **paket Pro** (added value berbayar).

---

## 4. DAMPAK KE SPEC

- **Skema (Build Spec Pack Part 1):** tambah kolom/tabel ringan — `Tenant.slug` (untuk subdomain, unique), `Tenant.publicProfile` (jsonb: layanan, jam, galeri), dan pemakaian `Lead.source = WEBSITE`. Endpoint publik `POST /public/:slug/booking` (tanpa auth, rate-limited) → buat Lead.
- **Screen spec (Part 2):** tambah S-O11 "Halaman Publik" di menu owner (edit profil publik, lihat link, salin). Plus halaman publik read-only (bukan bagian app login).
- **Business rules (Part 3):** booking publik → Lead(NEW, source=WEBSITE); notifikasi owner; anti-spam (rate limit + captcha ringan).
- **TechStack v2.1:** wildcard subdomain via Vercel; halaman publik = route Next.js (SSR) di app yang sama (tak perlu app terpisah).

---

## 5. RINGKAS

- **Bertaruh diferensiasi** pada money loop + IoT demand + data (susah ditiru), **bukan** pada website statis (komoditas).
- **Website tenant tetap dibangun**, tapi versi minimal yang **menyuap loop** (booking → lead), bukan brosur.
- **Domain:** platform pakai custom domain + wildcard subdomain (Vercel, gratis+SSL). Domain kustom tenant = fitur Pro fase 2.
- Tambahan scope v1.0 ini **kecil** karena menumpang alur Lead/Growth yang sudah ada — added value nyata tanpa mengorbankan deadline 25 hari.
