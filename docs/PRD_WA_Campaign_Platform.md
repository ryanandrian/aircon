# PRD — Lumite WA Campaign Platform (WACP)
Platform Kampanye Marketing via WhatsApp untuk seluruh portofolio SaaS Lumite

Status: DRAFT v1 · Penulis: (disiapkan agen) · Tanggal: 2026-09-05
Sumber kebenaran keputusan produk. Nilai default = HIPOTESIS untuk dikalibrasi saat pilot (tetap konkret agar buildable).

---

## 0. Esensi & Tesis

**Bukan "aplikasi blast".** Ini **mesin akuisisi pelanggan lintas-produk** lewat WhatsApp: menjangkau segmen pasar berbeda (per produk SaaS) dengan pesan bertema, **secara aman** (tanpa membakar nomor), **terukur** (histori siapa dihubungi, kapan, hasilnya), dan **fleksibel** (otomatis aman ATAU manual satu-per-satu).

**Siapa yang dilayani:** operator marketing Lumite (saat ini: 1 orang — pemilik). Bukan multi-tenant, bukan produk yang dijual. **Alat internal** untuk memasarkan 12-SaaS.

**Nilai inti (moat operasional):**
1. **Aman-dulu** — nomor marketing tak kena ban → kampanye bisa berulang.
2. **Terorganisir per Project/Program** — tiap produk & segmen punya database nomor, tema, & histori sendiri.
3. **Jejak lengkap** — tak pernah dobel-kirim, tahu kapan terakhir dihubungi, bisa follow-up cerdas.

**Prinsip desain:** keamanan = pilar #1 (gateway = whatsapp-web.js/unofficial → risiko ban nyata). Fleksibel mode kirim. Configurable (jeda, batas, tema editable). Terisolasi dari produksi Aircon.

---

## 1. Personas & Peran

| Persona | Kebutuhan | Akses |
|---|---|---|
| **Operator Marketing** (pemilik) | Susun kampanye, kelola daftar nomor per segmen, kirim aman, pantau hasil | Penuh (satu-satunya user) |

Sistem **single-operator** untuk v1. Arsitektur menyiapkan `users` (multi-operator) tapi UI v1 hanya 1 akun.

---

## 2. Model Konsep (hierarki data)

```
Product (SaaS: Aircon, dst)
  └── Project/Program (segmen pasar; punya DB nomor sendiri)
        ├── Audience (daftar nomor + atribut, di-scope ke project)
        ├── Theme (tema pesan: image ukuran WA + narasi/caption + variasi)
        └── Campaign (eksekusi: theme + audience terpilih + mode kirim + jadwal)
              └── Delivery (per-nomor: status, waktu kirim, hasil) ← HISTORI
```

- **Product**: payung (mis. "Aircon", "SaaS #2"). Sekadar label pengelompokan.
- **Project/Program**: unit kerja utama. Beda segmen pasar = beda project (mis. "Aircon — Pengusaha AC Jabodetabek", "Aircon — Reseller"). **Tiap project punya audiens & tema sendiri.**
- **Audience/Contact**: nomor WA + nama + atribut bebas (kota, sumber, tag). Di-scope ke project.
- **Theme**: 1 gambar (spesifikasi ukuran marketing WA) + narasi/caption + beberapa **variasi teks** (spintax anti-pola).
- **Campaign**: satu pengiriman — pilih tema, pilih nomor (semua/filter/manual-centang), pilih mode, jalankan.
- **Delivery**: baris histori per nomor per campaign (idempoten, anti dobel-kirim).

---

## 3. Functional Requirements (dengan ID + acceptance criteria)

### FR-A: Keamanan Login & Recovery
- **FR-A1** Login username + password (tanpa Google). Password di-hash (argon2id/bcrypt).
  *AC:* password plaintext tak pernah tersimpan; salah 5× → lockout sementara (rate-limit).
- **FR-A2** Sesi aman: cookie httpOnly+Secure+SameSite, kedaluwarsa, logout.
  *AC:* akses tanpa sesi valid → 302 ke /login.
- **FR-A3** Recovery bila lupa: **reset via email** (kirim link/kode sekali-pakai kedaluwarsa 30 mnt ke email operator). Cadangan: **recovery code** cetak-sekali (10 kode sekali-pakai) disimpan saat setup.
  *AC:* link reset kedaluwarsa & sekali-pakai; recovery code hangus setelah dipakai.
- **FR-A4** (opsional v1.1) 2FA TOTP.

### FR-B: Struktur Project/Program
- **FR-B1** CRUD Product & Project. Tiap project milik satu product.
- **FR-B2** Project menyimpan: nama, produk induk, deskripsi segmen, **sesi WA yang dipakai** (nomor pengirim).
  *AC:* menghapus project = arsip (soft-delete), histori tetap ada.

### FR-C: Audience / Database Nomor (per project)
- **FR-C1** Impor nomor: paste teks / upload CSV (kolom: nomor, nama, +atribut bebas).
  *AC:* normalisasi nomor ke format 62; nomor invalid ditandai & dilewati; **dedup otomatis** dalam project.
- **FR-C2** Kelola kontak: cari, filter (by tag/kota/status), edit, hapus, tag massal.
- **FR-C3** **Status per kontak**: BELUM_DIKIRIM / TERKIRIM / GAGAL / DIBALAS / OPT_OUT.
  *AC:* kontak OPT_OUT (mis. balas "STOP") otomatis dikecualikan dari campaign berikutnya.
- **FR-C4** **Anti dobel-kirim lintas campaign**: tampilkan "terakhir dikirim kapan & campaign apa".

### FR-D: Theme (tema pesan)
- **FR-D1** CRUD tema per project: judul, **1 gambar** (validasi ukuran/rasio marketing WA — lihat NFR), **caption/narasi**, dan **variasi teks** (min 1, disarankan 3–5 untuk spintax).
  *AC:* gambar disimpan aman (S3/disk server); preview tampilan seperti di WA.
- **FR-D2** Placeholder personalisasi: `{nama}`, `{kota}`, dll → terisi dari atribut kontak.
- **FR-D3** Pratinjau pesan final (gambar+caption) sebelum kirim.

### FR-E: Campaign & Mode Kirim (INTI — fleksibel)
- **FR-E1** Buat campaign: pilih project → tema → **pilih penerima**: (a) semua di project, (b) hasil filter, atau (c) **centang manual satu-per-satu**.
  *AC:* jumlah terpilih tampil; kontak OPT_OUT & TERKIRIM (opsional) otomatis dikecualikan sesuai setelan.
- **FR-E2** **Mode kirim FLEKSIBEL** (pilih saat menjalankan):
  - **Mode Auto (blast aman):** server kirim otomatis satu-satu dengan **jeda acak** (default 30–90 dtk), **batas harian** (default 40/hari), **istirahat tiap N pesan** (default tiap 12 → jeda 5–10 mnt), **jam kirim** (default 09:00–17:00). Bisa **pause/resume/stop**.
  - **Mode Manual assisted:** sistem tampilkan antrean; per kontak tombol **"Buka WhatsApp + pesan siap"** (deep link `wa.me` / buka chat di sesi) → operator klik kirim sendiri. **Nyaris nol risiko ban.** Sistem catat "sudah dikirim" saat operator tandai.
  - **Mode Manual-terpilih:** centang beberapa kontak → kirim sekarang (tetap lewat jeda aman) — untuk follow-up kecil.
  *AC:* mode & parameter tampil sebelum "Jalankan"; Auto mematuhi semua batas; semua mode menulis Delivery.
- **FR-E3** **Pemanasan nomor (warm-up):** batas harian naik bertahap untuk nomor baru (mis. hari 1: 10, hari 2: 20, …). Configurable.
- **FR-E4** Jadwal: kirim sekarang atau jadwalkan mulai (tanggal/jam).

### FR-F: Histori & Monitoring
- **FR-F1** Dashboard campaign: total, terkirim, gagal, dibalas, sisa, progres real-time.
- **FR-F2** **Histori per nomor**: setiap Delivery tercatat (campaign, tema, waktu kirim, status, error). Bisa telusur per kontak & per campaign.
  *AC:* ekspor CSV histori.
- **FR-F3** Log kesehatan sesi WA: tersambung/putus, peringatan bila mendekati batas/anomali.
- **FR-F4** Deteksi balasan (INBOUND) → tandai kontak DIBALAS; "STOP/BERHENTI" → OPT_OUT otomatis.

### FR-G: Keamanan Operasional (anti-ban)
- **FR-G1** **Nomor pengirim TERPISAH** dari gateway produksi Aircon (sesi WA khusus marketing).
  *AC:* sistem menolak memakai sesi yang ditandai "produksi".
- **FR-G2** Semua parameter aman **configurable** (jeda min/maks, batas harian, jam kirim, ukuran istirahat).
- **FR-G3** Kill-switch: hentikan semua pengiriman seketika.
- **FR-G4** Guard rasio gagal: bila gagal beruntun > ambang (mis. 5), auto-pause + alarm (indikasi nomor bermasalah).

---

## 4. Non-Functional Requirements
- **NFR-1 Isolasi:** app & sesi WA blast TERPISAH dari produksi Aircon (proses/sesi berbeda; ideal nomor & bahkan host/worker berbeda). Ban di marketing TIDAK menyentuh pengingat tenant.
- **NFR-2 Keamanan:** hanya operator (auth). Rate-limit login. Kredензial & token via env/secret, tak di-commit.
- **NFR-3 Ketahanan:** pengiriman = antrean persisten; worker mati → lanjut saat hidup (tak dobel, tak hilang). Idempoten via Delivery unik (campaign×contact).
- **NFR-4 Ukuran gambar marketing WA:** simpan & validasi. Default rekomendasi: rasio **1:1 (1080×1080)** atau **4:5 (1080×1350)**; format JPG/PNG; < 5 MB (batas WA). Caption teks terpisah dari gambar.
- **NFR-5 Skala:** ratusan–ribuan kontak per project; puluhan project. SQLite/Postgres cukup untuk v1.
- **NFR-6 Auditability:** setiap kirim tercatat permanen (siapa, kapan, ke siapa, hasil).

---

## 5. Out of Scope (v1)
- Bukan multi-tenant / bukan produk dijual (alat internal).
- Bukan Meta Cloud API (v1 pakai sesi whatsapp-web.js yang ada; Cloud API = fase lanjut bila skala/keamanan menuntut).
- Tanpa balasan otomatis/chatbot (hanya deteksi STOP untuk opt-out).
- Tanpa A/B testing statistik lanjut (variasi teks ada, tapi analitik A/B menyusul).
- Tanpa penjadwalan kampanye berulang kompleks (v1: sekali jalan / jadwal mulai).

---

## 6. Definition of Done (v1)
1. Operator bisa login aman + reset password via email; recovery code berfungsi.
2. Bisa buat Product→Project; impor nomor (CSV/paste) dengan dedup & normalisasi.
3. Bisa buat Tema (gambar+caption+variasi) dengan pratinjau.
4. Bisa buat Campaign, pilih penerima (semua/filter/centang), pilih mode (Auto/Manual).
5. Mode Auto mengirim dengan jeda acak + batas harian + pause/resume/stop; mematuhi jam kirim.
6. Mode Manual menampilkan antrean "buka chat + tandai terkirim".
7. Setiap pengiriman tercatat di Histori; anti dobel-kirim; opt-out otomatis.
8. Dashboard progres real-time; ekspor CSV histori.
9. Sesi WA marketing TERPISAH dari produksi Aircon (terverifikasi).
10. Kill-switch berfungsi.

---

## 7. Keputusan Arsitektur (ringkas — detail di Tech Spec terpisah)
- **Isolasi:** aplikasi WACP baru (web) + **worker pengirim** sendiri. Reuse gateway whatsapp-web.js yang ada TAPI **sesi/nomor terpisah** bertag "marketing". Idealnya worker terpisah agar beban blast tak ganggu produksi.
- **Stack (usulan, konfirmasi di Tech Spec):** Next.js (konsisten dgn Aircon) + Postgres/SQLite + antrean di DB (pola QUEUED seperti Aircon) + worker Node polling. Deploy di VPS (butuh proses 24/7 — bukan serverless).
- **Data model inti:** users, products, projects, contacts, themes, campaigns, deliveries (+ send_settings). Skema detail di Build Spec Pack.

---

## 8. Risiko & Mitigasi
| Risiko | Dampak | Mitigasi |
|---|---|---|
| Nomor kena ban WhatsApp | Kampanye mati | Nomor terpisah, jeda acak, batas harian, warm-up, mode manual, kill-switch |
| Ban menular ke produksi Aircon | Pengingat tenant mati (FATAL) | **Isolasi sesi/nomor/worker** (NFR-1, FR-G1) |
| Dianggap spam → laporan | Reputasi & ban | Opt-out otomatis, variasi teks, target relevan, volume wajar |
| Operator lupa password | Terkunci | Reset email + recovery code (FR-A3) |
| Dobel-kirim | Reputasi | Delivery idempoten (NFR-3, FR-C4) |

---

## 9. Pertanyaan Terbuka (untuk Anda putuskan sebelum Tech Spec / Gate 1)
1. **Nomor marketing:** siapkan nomor WA kedua khusus? (sangat disarankan) — atau v1 mulai dgn mode Manual saja (nol ban) lalu tambah nomor untuk Auto nanti?
2. **Recovery:** email reset ke alamat mana? (usul: admin@lumite.biz.id, SMTP sudah jalan)
3. **Host:** worker blast di VPS yang sama dgn gateway (103.127.138.16) atau VPS lain? (usul: sama dulu, sesi terpisah)
4. **Gambar:** ukuran default final 1:1 atau 4:5? (usul: dukung keduanya, default 4:5 untuk WA)
```
