# Keputusan Arsitektur Hosting — Vercel vs VPS (Analisis Mendalam)

> Pemicu: "Kita sewa VPS untuk MQTT + waweb.js. Mengapa app utama tetap di Vercel,
> bukan semua di VPS?" — pertanyaan strategis owner. Dokumen ini jujur & dua-arah.

## 0. Reframe penting (ini mengubah seluruh perhitungan)
Pilihan sebenarnya BUKAN "Vercel gratis vs VPS berbayar". Faktanya:
- **Vercel Hobby (yang kita pakai sekarang) = NON-KOMERSIAL menurut ToS Vercel.**
  Begitu aircon menagih tenant (Midtrans sudah live), menjalankannya di Hobby
  melanggar ToS. Untuk komersial WAJIB Vercel **Pro (~US$20/bln ≈ Rp320rb/bln per member).**
- VPS BiznetGio: **sudah akan disewa** untuk MQTT + WA worker → biaya marginal
  menaruh app di situ ≈ Rp0.

Jadi pada saat KOMERSIAL, pilihannya jujur = **Vercel Pro (~Rp320rb/bln) vs VPS (sudah dibayar).**
Insting owner benar secara ekonomi: kalau VPS sudah ada, konsolidasi menghemat fee Pro.

## 1. Argumen KUAT mempertahankan app di Vercel (arsitektur terpisah)
### Teknis
1. **Isolasi failure domain (ARGUMEN TERKUAT).** waweb.js = headless Chromium =
   rakus RAM & sering crash/OOM. Tiap tenant butuh SATU sesi Chromium persisten
   (tenant link WA sendiri). 50 tenant = 50 Chromium = beban RAM masif. Kalau app
   customer-facing satu box dengan armada Chromium, crash WA bisa menyeret app
   pelanggan ikut tumbang. Memisah = app tetap responsif walau WA fleet megap-megap.
2. **Zero-ops deploy.** git push → build/CDN/TLS/rollback otomatis. Di VPS: kelola
   sendiri nginx, perpanjangan TLS, pm2/systemd, zero-downtime deploy, pipeline build.
3. **Auto-scale + CDN global.** Lonjakan trafik ditangani otomatis; aset statik cepat.
   VPS = kapasitas tetap satu lokasi.
4. **Patch runtime dikelola Vercel.** VPS = kita patch OS/Node/nginx sendiri (beban keamanan).

### Bisnis
1. **Sekarang gratis (Hobby).** Disiplin modal — belum keluar uang saat unjuk-produk.
2. **Kecepatan ke pasar.** Deadline 25 hari; nol waktu devops = lebih banyak waktu produk & jualan.
3. **Uptime = kepercayaan.** SaaS tumbang = pelanggan hilang. Uptime Vercel > single VPS swa-kelola.
4. **Skala portofolio "12 SaaS".** Zero-ops Vercel = pengali besar saat mengelola BANYAK produk;
   12 VPS swa-kelola oleh 1 orang = mimpi buruk operasional.

## 2. Argumen KUAT konsolidasi semua ke VPS
### Teknis
1. **Satu box, satu model mental.** Tanpa split-brain; semua log/proses di satu tempat.
2. **Bebas batas Vercel.** Hobby: cron 1×/hari (KITA SUDAH KENA ini), timeout fungsi
   pendek, non-komersial. VPS: cron sesuka hati, proses long-running, WebSocket, tanpa cold start.
3. **Ko-lokasi app ↔ MQTT.** Latensi internal kecil (walau Supabase tetap di Tokyo,
   jadi keuntungan lokalitas DB nihil).
4. **Kendali penuh.** nginx custom, worker background, tuning apa pun.

### Bisnis
1. **Biaya marginal ≈ Rp0** (VPS sudah disewa) → hemat fee Vercel Pro saat komersial.
2. **Biaya rata & terprediksi** (VPS flat/bln) vs Vercel Pro usage-based yang bisa naik.
3. **Tanpa risiko ToS** non-komersial Hobby.
4. **Hosting lokal (BiznetGio ID)** — nilai lebih untuk kepercayaan lokal & UU PDP
   (data di Indonesia), walau app stateless (data asli di Supabase Tokyo).

## 3. Titik lemah masing-masing (jujur)
- **Vercel:** Hobby non-komersial (harus Pro saat menagih) · cron/timeout terbatas ·
  vendor lock-in ringan (fungsi/cron format Vercel) · biaya Pro tumbuh per-member.
- **VPS-semua:** beban ops (patch, TLS, deploy, monitoring, backup) di 1 dev ·
  risiko single-point-of-failure kalau tak ada redundansi · Chromium bisa mencekik
  resource app kalau tak di-isolasi (Docker + cgroup limit + auto-restart WAJIB) ·
  tak auto-scale.

## 4. Fakta pengunci: whatsapp-web.js adalah dinding skala
1 sesi Chromium persisten PER tenant (~0,5–1 GB RAM/tenant realistis). Ini:
- Membuat WA worker MENDOMINASI resource VPS → alasan kuat app JANGAN sekamar dengannya.
- Menuntut, di masa depan: session pooling / worker horizontal / antrean — apa pun
  hostingnya. Ini masalah worker, bukan masalah app.

## 5. REKOMENDASI — bertahap (reversible, sesuai disiplin modal)
**Fase 1 — SEKARANG (unjuk-produk, pra-revenue nyata):** PERTAHANKAN split.
App di Vercel (Hobby, gratis; caveat non-komersial dapat diterima selama pilot/uji
karena belum skala komersial). VPS HANYA untuk yang Vercel tak bisa: Mosquitto + WA worker.
Alasan: velocity + reliability + Rp0 saat membuktikan produk. **Ini rencana kita sekarang & benar untuk fase ini.**

**Fase 2 — SAAT LAUNCH KOMERSIAL (tenant bayar nyata):** titik keputusan sadar. Dua opsi bersih:
- **(A) Vercel Pro + VPS (MQTT/WA).** Tetap zero-ops app. Pilih bila menghargai
  reliability/velocity di atas ~Rp320rb/bln. Cocok untuk model "12 SaaS" (zero-ops menskala).
- **(B) Semua di VPS (Docker Compose: nginx + Next.js + Mosquitto + WA worker,
  tiap layanan ber-limit resource + auto-restart).** Hemat fee Pro. Pilih bila
  disiplin biaya dominan DAN ada kapasitas ops. WAJIB kontainerisasi + isolasi
  memori Chromium, kalau tidak crash WA menyeret app.

**Rekomendasi condong:** untuk aircon spesifik (disiplin modal kuat + VPS toh disewa
+ produk tunggal yang sedang divalidasi), **Opsi B menarik di skala komersial ASAL
di-Docker-kan rapi.** Tapi selama fase validasi, split (Vercel Hobby) memberi
velocity & keandalan tanpa biaya — jangan tukar itu terlalu dini.

**Aturan pengunci:** apa pun dipilih, WA worker + Mosquitto tetap kontainer terpisah
ber-limit resource. App customer-facing TIDAK PERNAH berbagi proses dengan Chromium.

## 6. Yang membuat keputusan ini reversible
App = Next.js standar (Node). Pindah Vercel→VPS = tambah Dockerfile + nginx + systemd/pm2,
tanpa ubah kode aplikasi. Jadi tak ada lock-in mahal; kita bisa mulai di Vercel dan
pindah saat Fase 2 tanpa menulis ulang. Itu sebabnya menunda keputusan = murah.
