# RENCANA — Halaman Usaha Publik /p: konfigurasi tenant + redesign world-class

> Konteks: /p/[slug] = wajah usaha ke calon pelanggan (SEO + konversi booking). Owner minta lebih
> world-class (senuansa /riwayat, Varian A hero premium) + banyak elemen configurable dari panel
> tenant, TAPI semuanya punya DEFAULT value (tenant baru langsung tampil rapi tanpa setup).
> Mockup disetujui: docs/mockups/halaman-usaha-publik-worldclass.html (VARIAN A dipilih).

## Model data (least-migration)
- Elemen configurable disimpan di `Tenant.publicProfile` (Json?, SUDAH ADA) + `Tenant.serviceArea`
  (Json, SUDAH ADA). Field skalar yg sudah ada (name, tagline, phone, address, logoUrl) dipakai apa adanya.
- publicProfile shape (superset, semua opsional, default di layer baca):
  { description?, tagline?, services?: string[], operatingHours?: string,
    trustBadges?: {label:string}[], instagram?, mapUrl?,
    customers?: {name:string, logoUrl:string}[]  // Prioritas 3 (point 9)
  }

## DIKERJAKAN SEKARANG — Prioritas 1 & 2 (disetujui owner)
Semua editable di /app/pengaturan (kartu baru "Halaman Usaha Publik") + default value:
1. Layanan Kami — chip list. Default: [Cuci AC, Isi Freon, Perbaikan, Pasang Baru, Pengecekan].
2. Area Layanan — kota/kecamatan (serviceArea.cities/districts). Default: kosong (sembunyi bila kosong).
3. Deskripsi usaha — paragraf. Default: kalimat generik existing.
4. Jam operasional — mis "Senin–Sabtu, 08.00–17.00". Default: "Setiap hari, 08.00–17.00".
5. Trust badges (3) — teks bisa diganti. Default: [Respons cepat, Dikonfirmasi WhatsApp, Pesan online 24 jam].
6. Instagram + Google Maps — opsional; item disembunyikan bila kosong.
+ /p diredesign ke VARIAN A (hero gelap premium + kartu konversi mengambang), IKON pakai <TenantLogo>
  (sama dengan panel tenant), bukan ikon statis.

## PRIORITAS 3 — DICATAT, DIKERJAKAN KEMUDIAN (jangan lupa)
7. Galeri foto before/after hasil kerja — butuh upload multi-gambar (presigned PUT pola existing) +
   penyimpanan array URL. Menjual untuk jasa AC. Milestone terpisah (lebih berat).
8. Testimoni pelanggan — butuh moderasi/kurasi + anti-spam. Milestone terpisah.
9. **"Our Customers" / Klien Kami** — deretan LOGO pelanggan/klien saja (tanpa nama panjang),
   ukuran SERAGAM yang kita tetapkan (mis. tinggi 40–48px, grayscale→warna saat hover, grid rapi).
   Data: publicProfile.customers[] = {name, logoUrl}. Upload logo pola TenantImageField existing.
   Default: kosong → seksi disembunyikan bila belum ada. Menambah kredibilitas B2B (Pizza Hut dkk).

## Prinsip
- Setiap field ada DEFAULT masuk akal → /p tenant baru penuh & profesional tanpa setup.
- Seksi disembunyikan bila datanya kosong DAN tak punya default (mis. Instagram, Maps, Customers).
- publicProfile = JSON → NOL migrasi DB. Validasi zod ketat (panjang, jumlah item, url).
- Reuse: TenantLogo, TenantImageField (upload), token design system (OKLCH), komponen ui.
