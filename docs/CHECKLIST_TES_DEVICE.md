# Checklist Tes Device Nyata — Aircon (pra-go-komersial)

> **Tujuan**: memvalidasi fitur yang TIDAK bisa diuji headless (kamera, GPS, PWA, WA nyata) di HP asli,
> SEBELUM pilot & sebelum migrasi VPS. Dijalankan di produksi Vercel saat ini: https://aircon-peach.vercel.app
> **Prinsip**: HTTPS wajib (kamera & GPS hanya jalan di HTTPS) — Vercel sudah HTTPS, jadi valid.
> Tandai ✅/❌ + catat device & versi OS. Bila ❌, catat gejala persis (screenshot) untuk perbaikan.

Diverifikasi terhadap kode: 2026-08-29 (commit 1746afc).

---

## Device uji (isi minimal 2: 1 Android + 1 iOS bila bisa)
| Slot | Merk/Model | OS & versi | Browser |
|---|---|---|---|
| A | | Android __ | Chrome |
| B | | iOS __ | Safari |

---

## 1. PWA — Install ke home screen (owner & teknisi)
Kode: `public/manifest.json` (display standalone, start_url `/`). **Catatan: TIDAK ada service worker** →
aplikasi TIDAK offline & TIDAK push notification (memang belum ada di MVP; jangan diuji).
- [ ] Buka URL di Chrome (Android): muncul prompt / menu "Add to Home Screen" / "Install app".
- [ ] Buka di Safari (iOS): Share → "Add to Home Screen" berhasil.
- [ ] Ikon & nama "Aircon" muncul benar di home screen.
- [ ] Dibuka dari ikon → tampil **fullscreen (standalone)**, tanpa address bar browser.
- [ ] Rotasi & ukuran layar kecil (HP) tetap rapi (tak ada elemen terpotong).

## 2. Kamera — Scan QR unit AC (owner/teknisi)
Kode: `src/app/app/unit/qr-scanner.tsx` — mesin `jsQR` (canvas, kompatibel iOS Safari), `getUserMedia` facingMode kamera belakang.
- [ ] Buka layar scan QR → browser minta **izin kamera** → izinkan.
- [ ] **Kamera belakang** yang aktif (bukan depan).
- [ ] Arahkan ke QR unit → **ter-decode < 3 detik**, langsung ke unit yang benar.
- [ ] Uji cahaya redup / QR agak miring → masih terbaca (atau gagal dengan pesan jelas).
- [ ] iOS Safari: kamera benar-benar tampil (ini titik paling rawan — jsQR dipilih justru untuk ini).
- [ ] Tolak izin kamera → muncul pesan error yang ramah (bukan layar blank/crash).

## 3. GPS — Simpan lokasi pelanggan (teknisi)
Kode: `src/app/t/pekerjaan/[id]/save-location.tsx` — `navigator.geolocation.getCurrentPosition` (butuh HTTPS + izin).
- [ ] Login sebagai teknisi (phone+PIN) → buka pekerjaan → tombol simpan lokasi.
- [ ] Browser minta **izin lokasi** → izinkan → koordinat tersimpan (cek muncul di detail pelanggan).
- [ ] Akurasi wajar (titik dekat lokasi asli, bukan meleset jauh).
- [ ] Tolak izin lokasi → pesan error ramah, tak crash.
- [ ] iOS Safari: geolocation berfungsi (kadang perlu izin ulang per-sesi).

## 4. WhatsApp — kirim nyata ke pelanggan (jalur produksi)
Kode: `src/lib/services/message-dispatch-service.ts` → gateway → callback `src/app/api/wa/callback/route.ts`.
> ⚠️ Ini kirim WA NYATA ke nomor pelanggan. Gunakan nomor uji milik sendiri dulu. Hormati warm-up (§lihat bawah).
- [ ] Sesi WA tenant sudah READY (scan QR sekali) — via menu WA di app.
- [ ] Trigger 1 pesan transaksional (mis. kwitansi/kirim invoice) ke nomor uji → **benar-benar diterima di HP**.
- [ ] Status di app ter-update jadi **terkirim** (callback `sent` masuk → MessageLog), bukan diam di "queued".
- [ ] Isi pesan benar (logo/format/link sesuai), nomor tujuan benar.
- [ ] Kirim ke nomor non-WA / typo → app menandai **failed**, tak menggantung.

## 5. Alur inti mobile-first (owner & teknisi) di HP
- [ ] Owner: buat pelanggan → unit → jadwalkan pekerjaan → assign tim. Semua layar nyaman di layar HP (tombol ≥44px).
- [ ] Teknisi: login PIN → lihat tugas → mulai WorkSession → catat item → tutup → invoice ter-generate.
- [ ] Owner: tandai invoice lunas → laporan (piutang/penerimaan/insentif) tampil benar.
- [ ] Input angka (harga/qty) pakai keyboard numerik yang benar di HP.
- [ ] Tak ada horizontal-scroll tak sengaja / teks terlalu kecil / kontras buruk (WCAG).

---

## Catatan warm-up WhatsApp (WAJIB sebelum volume penuh)
Nomor WA baru harus di-ramp ±7 hari (hari-1 ±20 pesan, naik bertahap → 200/hari). Proteksi sudah ada di gateway
(quiet-hour, throttle, plafon harian). **Jangan blast di hari pertama** — nomor bisa diblokir WhatsApp.
Mulai warm-up = kirim sedikit pesan transaksional nyata tiap hari selama seminggu.

## Definition of Done (siap pilot)
- Semua ✅ di minimal 1 Android + 1 iOS (idealnya).
- ❌ apa pun di §2/§3/§4 = BLOCKER (fitur inti lapangan) → perbaiki dulu.
- Setelah lulus → jalankan pilot 1 tenant nyata → BARU migrasi ke VPS.
