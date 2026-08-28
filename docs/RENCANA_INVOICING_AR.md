# RENCANA KERJA — Modul Operasi Lapangan, Invoicing & Piutang (AR)

> Status: **RENCANA (belum eksekusi)**. Disusun dari audit kode nyata 28 Agu 2026.
> Tujuan: dukung alur bisnis nyata (job-order → penugasan multi-personel → invoice/proforma →
> piutang → insentif) TANPA menimbulkan bug pada sistem yang sudah jalan (201 test, money-loop live).

---

## A. RINGKAS JUJUR — SEBERAPA BESAR INI?

Permintaan ini = **modul bisnis besar, ~80% BELUM ADA**. Pada dasarnya menambah **sistem
invoicing lapangan + Account Receivable (piutang) + insentif tim** di atas sistem job yang ada.
Perkiraan: setara ~40-50% dari total yang sudah dibangun. **Wajib bertahap + verifikasi ketat.**

### Yang SUDAH ADA (dipakai ulang) ✓
- Customer (nama, phone, address, geoLat/geoLng, notes) — **koordinat & alamat SUDAH ada**
- Customer list **sudah cursor-pagination** (`listCustomers`) — tinggal pasang lazy-load di UI
- JobOrder + FSM 10-status + guard checklist/foto + money-loop (COMPLETED→reminder)
- Technician (1 job = 1 technicianId saat ini) + JobPhoto + ChecklistResult
- CompanyProfile: `isPkp`, `npwp`, `taxLabel`, `taxPercent` — **untuk Lumite** (sudah ada)
- Midtrans (langganan tenant→Lumite). PlanConfig/BillingPolicy no-hardcode.

### Yang BELUM ADA (harus dibangun) ✗
| Kebutuhan | Status |
|---|---|
| **ServiceCatalog** (daftar layanan CRUD per tenant) | ❌ tak ada |
| **CustomerPricing** (harga khusus per pelanggan) | ❌ tak ada |
| **Invoice** + **InvoiceItem** (tenant→pelanggan) | ❌ tak ada |
| **ProformaInvoice** (untuk pembayaran tempo) | ❌ tak ada |
| **Payment/Receipt pelanggan** (tunai/transfer/QRIS + kwitansi) | ❌ tak ada (Payment yg ada=langganan) |
| **Multi-personel per job** (>1 teknisi + kernet) | ❌ hanya 1 technicianId |
| **Kernet (support)** sebagai peran | ❌ tak ada |
| **Assignment per item layanan** (siapa kerjakan apa) | ❌ tak ada |
| **Insentif** (teknisi/kernet, %/nilai per item) | ❌ tak ada |
| **TOP / Terms of Payment** (Cash/Tempo 30/45/60/90) | ❌ tak ada |
| **Kolom kategori pelanggan** (rumah/masjid/kantor…) | ❌ tak ada |
| **Alamat penagihan** (bill-to berbeda) | ❌ tak ada |
| **Info pajak pelanggan** (NPWP customer, PKP B2B) | ❌ tak ada |
| **Penugasan UMUM vs SPESIFIK** | ⚠️ sebagian (job ada, tapi tak ada mode umum) |
| **Deteksi bentrok jadwal teknisi** | ⚠️ ada flag feasibility, belum enforce |
| **Laporan: piutang/penerimaan/kinerja personil** | ❌ tak ada |
| **Notifikasi penugasan ke HP teknisi/kernet** | ⚠️ ada job list, belum notif push/WA lengkap |
| **Lazy-load ratusan card pelanggan** | ⚠️ backend siap, UI belum |

---

## B. PENELITIAN PAJAK (Anda minta saya cari — ringkas & terverifikasi)

Sumber: pajak.go.id, online-pajak, klikpajak (diakses 28 Agu 2026).

### B1. Tiga lapis pajak yang RELEVAN untuk bisnis ini

**Lapis 1 — Lumite → Tenant (langganan SaaS):**
- Lumite saat ini **non-PKP** (`isPkp=false`) → **TIDAK memungut PPN** atas biaya langganan.
- Ini SUDAH ditangani (BillingPolicy.taxPercent, withTax). Aman.

**Lapis 2 — Tenant → Pelanggan (jasa servis AC) — INI YANG BARU:**
- **PPN**: HANYA tenant yang sudah **PKP** (omzet > Rp4,8 miliar/tahun) yang WAJIB pungut PPN
  (tarif berlaku saat ini; simpan sebagai **konfigurasi**, jangan hardcode). Tenant kecil non-PKP
  **tidak pungut PPN** — invoice tanpa PPN.
- Jadi: tiap tenant butuh flag **isPkp + npwp + taxPercent sendiri** (mirip CompanyProfile Lumite,
  tapi per-tenant). Invoice menghitung PPN hanya bila tenant PKP.

**Lapis 3 — Pelanggan memotong PPh 23 (khusus B2B):**
- Bila **pelanggan adalah badan usaha (PT/CV)** dan tenant menyediakan **jasa** (servis/maintenance AC
  = objek PPh23), pelanggan (sebagai pemotong) **memotong PPh 23 = 2%** dari nilai jasa (DPP).
- Bila penyedia jasa **tidak punya NPWP → tarif 2% × 200% = 4%** (lebih tinggi 100%).
- PPh23 **bukan menambah** tagihan — ia **PENGURANG** yang dipotong pelanggan saat bayar
  (tenant terima lebih sedikit, dapat bukti potong untuk kredit pajak). Untuk pelanggan **perorangan/rumah
  tangga (bukan pemotong)** → **tidak ada PPh23**.
- Material/sparepart murni (bukan jasa) umumnya **bukan** objek PPh23 (harus dipisah dari jasa di invoice).

### B2. Implikasi desain (yang WAJIB dikonfigurasi, bukan hardcode)
1. **Per-tenant tax profile**: `isPkp`, `npwp`, `taxPercent` (default nilai berlaku, editable).
2. **Per-customer tax profile**: `customerType` (perorangan/badan), `npwp`, `isPkpWithholder`
   (apakah pelanggan memotong PPh23), untuk B2B.
3. **Invoice memisahkan**: DPP jasa vs DPP barang (karena PPh23 hanya kena jasa).
4. **Invoice menampilkan**: PPN (bila tenant PKP) sebagai TAMBAHAN; PPh23 sebagai INFO potongan
   (estimasi yang akan dipotong pelanggan) — opsional tampil, karena ini urusan tenant↔pelanggan.
5. **JANGAN** paksa pajak untuk tenant kecil non-PKP dengan pelanggan rumahan (mayoritas pilot) —
   invoice mereka bersih tanpa pajak. **Anti over-engineering** (prinsip Anda): pajak muncul HANYA
   bila relevan (tenant PKP atau pelanggan badan).

> ⚠️ Catatan kejujuran: saya bukan konsultan pajak. Angka (2%, 4%, batas 4,8M, PPN%) saya jadikan
> **default yang dapat diubah admin**, dan sarankan tenant PKP konsultasi ke konsultan pajaknya.
> Sistem menyediakan MEKANISME, bukan nasihat pajak.

---

## C. RENCANA BERTAHAP (7 FASE — tiap fase: migrate → service → test → UI → verifikasi → commit)

**Prinsip anti-bug (WAJIB tiap fase):**
- Schema: `prisma migrate` additive-only (kolom baru nullable / tabel baru) → **tak merusak data/kode lama**.
- TDD: tulis unit test service (kalkulasi invoice/pajak/insentif/bentrok) SEBELUM UI.
- Tiap fase: `tsc --noEmit` 0 + `vitest` hijau + `build` hijau + dogfood ringkas SEBELUM commit.
- Fitur baru **opt-in / additive** — sistem lama tetap jalan bila field baru kosong.
- Uang & pajak: kalkulasi di service murni + test angka eksplisit (Decimal, bukan float).

### FASE 1 — Pelanggan diperkaya + LOGO TENANT (fondasi, risiko rendah)
Tambah kolom Customer (semua **nullable/optional**, tak rusak data lama):
- `category` (enum: RUMAH, SEKOLAH_KAMPUS, MASJID_MUSHOLA, TOKO_OUTLET, RUKO_RUKAN, KANTOR_PERUSAHAAN, LAINNYA)
- `topType` (enum: CASH, TEMPO_30/45/60/90, ...) — referensi TOP
- `billingCustomerId` (self-relation: alamat/entitas penagihan; kosong = tagih ke diri sendiri)
- Tax: `customerType` (PERORANGAN/BADAN), `npwp`, `isPphWithholder` (bool)
- Koordinat sudah ada → tambah UI teknisi "isi lokasi saat di tempat" (tombol ambil GPS)
- **UI**: lazy-load daftar pelanggan (pakai `listCustomers` cursor yang sudah ada) — antisipasi ratusan card
- CRUD pelanggan diperluas (form + edit) untuk field baru

**LOGO TENANT (amandemen [2]):**
- Tambah `logoUrl String @default("")` di model **Tenant** + `isPkp`/`npwp`/`taxPercent` per-tenant (untuk Fase 4 invoice).
- Upload logo **512×512** via S3 presign (pola `presignLandingAsset` di s3.ts) — validasi rasio/ukuran.
- Komponen `<TenantLogo tenant={...} />` reusable: tampil logo tenant, fallback ke logo **Aircon** bila kosong.
- Pasang di: /p/[slug] (ganti avatar-huruf), /u/[code] (ganti "Ditenagai Aircon"), /riwayat/[token],
  dan header dashboard /app. (Invoice/proforma/kwitansi menyusul di Fase 4.)
- Halaman **/app/pengaturan** (atau /app/langganan → profil usaha): owner upload logo + isi profil pajak.

Test: validasi enum, billing-to resolution, kategori filter, presign logo, fallback logo Aircon.

### FASE 2 — ServiceCatalog (daftar layanan) + harga khusus pelanggan
- Model **ServiceCatalog**: `code, name, category (MAINTENANCE/SERVICE/CONSUMABLE/SPAREPART/PAKET/...),
  standardPrice (Decimal), unit, description, active, techIncentiveType (PERCENT/VALUE), techIncentiveValue,
  kernetIncentiveType, kernetIncentiveValue` — **CRUD per tenant** (flexible per kategori).
- Model **CustomerPricing**: `customerId, serviceId, price` (override harga standar; opsional).
- Service: `resolvePrice(customerId, serviceId)` → harga khusus ?? standar.
- **UI**: /app/layanan (CRUD) + kelola harga khusus per pelanggan.
Test: resolusi harga (khusus vs standar), CRUD, kalkulasi insentif per item.

### FASE 3 — Multi-personel & Peran Cair (perluas penugasan)
- **Personel lapangan = satu entitas** (Technician yang sudah ada, punya login+PIN). TIDAK ada tipe
  akun kernet terpisah. Peran teknisi/kernet ditentukan **per penugasan**, bukan per orang.
- Model **JobAssignment**: `jobId, personId (userId/technicianId), roleOnJob (TECHNICIAN | KERNET),
  isLead` — **N personel per job**, peran cair (orang sama bisa teknisi di job A, kernet di job B).
  Additive di atas `technicianId` tunggal (backward-compatible; migrasi isi assignment dari technicianId lama).
- Penugasan **UMUM** (tanpa unit/layanan detail — pelanggan baru) vs **SPESIFIK** (dgn unit+layanan):
  tambah `assignmentType` di JobOrder.
- **Deteksi bentrok**: service `detectConflict(personId, windowStart, windowEnd)` — tolak/peringatkan
  penugasan tumpang-tindih waktu untuk personel yang sama (berlaku ke peran apa pun).
- **Notifikasi penugasan**: ke HP tiap personel (WA + in-app), isi: pelanggan/PIC, waktu, kontak,
  alamat + link Google Maps (geoLat/geoLng), catatan, **sistem bayar (Cash/Tempo dari Customer)**,
  **peran-nya di job ini (teknisi/kernet)**.
Test: conflict detection (overlap/no-overlap, lintas-peran), assignment multi-personel peran cair, notif payload.

### FASE 4 — Invoice & Proforma (INTI, paling sensitif)
- Model **Invoice**: `number, tenantId, customerId, billingCustomerId, jobId?, status (DRAFT/ISSUED/PAID/
  OVERDUE/CANCELLED), issueDate, dueDate (dihitung dari TOP), subtotal, taxableService, taxableGoods,
  ppnPercent, ppnAmount, total, paidAt, paymentMethod, paymentProofUrl`.
- Model **InvoiceItem**: `invoiceId, serviceId?, description, category, qty, unitPrice, lineTotal,
  assignedTechIds[], assignedKernetIds[]` (personel **per item**, opsional; **TIDAK tampil di invoice**,
  hanya untuk insentif + kartu perawatan).
- Model **ProformaInvoice** (+items): sama, tapi **tanpa nomor pajak resmi**; jadi dasar admin buat Invoice.
- **Alur pembayaran** (dari kebutuhan Anda):
  - **CASH**: teknisi terbitkan Invoice → pelanggan bayar (tunai/transfer/QRIS) → teknisi upload bukti →
    status PAID → **WA kwitansi otomatis** ke pelanggan.
  - **TEMPO**: teknisi hanya buat **Proforma** → WA proforma ke pelanggan → admin kantor buat Invoice
    dari proforma → tagih → pantau jatuh tempo.
- **Pajak** (dari Bagian B): PPN dihitung hanya bila tenant PKP; PPh23 info opsional; DPP jasa/barang dipisah.
- **Penomoran**: sequence per tenant per tahun (anti-duplikat, gap-aware).
Test (BANYAK — ini jantung uang): kalkulasi total (Decimal), PPN on/off, TOP→dueDate, proforma→invoice,
penomoran konkuren, kwitansi payload. **Semua angka diuji eksplisit.**

### FASE 5 — Piutang (AR) & Penerimaan
- Service query: **piutang s/d tanggal** (invoice ISSUED belum lunas, umur), **penerimaan per periode**,
  **invoice jatuh tempo** (+ notif ke admin tenant), **closing** (tandai lunas + bukti).
- Cron/notif: invoice OVERDUE → ingatkan admin tenant (bukan pelanggan otomatis — hati-hati reputasi).
Test: aging buckets, filter periode, transisi status, idempoten closing.

### FASE 6 — Insentif & Laporan Kinerja
- Service `computeIncentives(period)`: agregasi item→personel→insentif (%/nilai), per teknisi & kernet.
- Laporan tenant: **kinerja personil per periode**, **job belum ditugaskan**, **penugasan berlangsung**,
  **proforma belum jadi invoice**.
- Laporan teknisi (/t): **penugasan belum close**, **selesai per periode**, **insentif per periode**
  (bila item punya nilai insentif).
Test: agregasi insentif (%/nilai/multi-personel per item), filter periode, edge (0 insentif).

### FASE 7 — Kartu Perawatan diperkaya + polish
- Kartu perawatan unit: tampilkan "terakhir dilayani APA, oleh SIAPA, TANGGAL berapa"
  (dari InvoiceItem.assignedTech + service) — **tanpa biaya** (konsisten prinsip publik strip harga).
- Dogfood menyeluruh + regresi money-loop lama + laporan final.

---

## D. RISIKO & MITIGASI (anti-bug)

| Risiko | Mitigasi |
|---|---|
| Migrasi rusak data lama | Additive-only, nullable, tak drop/rename kolom lama. Migrate ke Supabase Tokyo diuji di dev dulu. |
| Kalkulasi uang salah (float) | Prisma **Decimal** + service murni + test angka eksplisit (termasuk pembulatan). |
| Pajak salah terap | Default configurable + pajak OPT-IN (muncul hanya bila tenant PKP / pelanggan badan). Sertakan disclaimer. |
| `technicianId` tunggal → multi | JobAssignment additive; kode lama baca technicianId tetap jalan; migrasi data isi assignment dari technicianId. |
| Penomoran invoice duplikat | Sequence transaksional per tenant/tahun (unique constraint + retry). |
| Regresi money-loop / 201 test | Jalankan full suite tiap fase; tambah test baru, jangan ubah test lama tanpa alasan. |
| Scope terlalu besar sekali jalan | 7 fase terpisah, tiap fase deployable & hijau sendiri. |
| Notifikasi WA spam saat testing | Simulasi dulu (pola demo), kirim nyata hanya setelah warm-up + izin. |

---

## E. KEPUTUSAN (default diambil agent — sesuai disiplin modal & pilot-first; owner bisa override)

### AMANDEMEN OWNER (28 Agu 2026) — WAJIB IKUT
- **[1] Midtrans HANYA tenant→Lumite** (langganan). Pembayaran pelanggan→tenant di v1 = **catat manual
  + upload bukti + kwitansi WA**. TIDAK ada gateway pembayaran pelanggan→tenant di v1. (FINAL)
- **[2] LOGO TENANT** (BARU — masuk Fase 1): tambah field `logoUrl` di **Tenant** (bukan hanya
  CompanyProfile Lumite). Upload gambar **512×512** (persegi) ke S3 BiznetGio (presign pola s3.ts).
  **Default = logo Aircon** sampai tenant upload. Logo tenant WAJIB tampil di SEMUA permukaan milik tenant,
  dan **Aircon TIDAK boleh muncul** di sana:
  1. Header **Invoice** & **Proforma-invoice** (PDF/print + web)
  2. **Kwitansi** WA/PDF
  3. Booking publik **/p/[slug]** (ganti avatar-huruf → logo)
  4. Kartu unit publik **/u/[code]** (ganti "Ditenagai Aircon" → logo tenant; boleh "dibuat dengan
     Aircon" halus di footer, TAPI brand utama = tenant)
  5. Kartu perawatan **/riwayat/[token]**
  6. (opsional) header dashboard tenant /app
  → **KEPUTUSAN: logoUrl di Tenant, 512×512, default Aircon, dipakai di 5-6 permukaan di atas.**
- **[3] KERNET login atau tidak** → **DIPUTUSKAN OWNER (28 Agu): PERAN CAIR PER-PENUGASAN.**
  Realita lapangan: pada proyek besar, teknisi kadang ditugaskan sebagai kernet, dan kernet yang sudah
  bisa cuci AC kadang menangani kerja teknisi. Jadi **teknisi/kernet BUKAN peran tetap per-orang**,
  melainkan **peran per-penugasan**.
  → **DESAIN FINAL:**
  - **Satu entitas "personel lapangan"** (punya login + PIN, seperti Technician sekarang). TIDAK ada
    tipe akun kernet terpisah.
  - **Peran ditentukan per penugasan** di `JobAssignment.roleOnJob` (TECHNICIAN | KERNET). Orang sama
    bisa TECHNICIAN di job A, KERNET di job B.
  - **Insentif ikut peran per-penugasan**: si personel dapat insentif-teknisi bila ditugaskan sebagai
    teknisi, insentif-kernet bila sebagai kernet (nilai dari ServiceCatalog per item).
  - **Semua personel login** & lihat tugas + insentifnya sendiri (tak ada kernet-tanpa-login).
  - Dampak: pertanyaan "kernet login atau tidak" GUGUR — semua login, peran fleksibel.

### Keputusan default lain (tetap berlaku)
1. **Urutan**: MVP **Fase 1-4** dulu (pelanggan+katalog+penugasan+invoice+**logo tenant**), lalu 5-7.
2. **Pajak**: **OPT-IN** (non-PKP + rumahan = tanpa pajak; PPN bila tenant PKP; PPh23 info bila pelanggan badan).
4. **Pembayaran CASH**: manual + bukti + kwitansi WA. Struktur siap-QRIS nanti (bukan v1).

---

## E2. GAP DARI ARAHAN OWNER (masukan agent 28 Agu — MENUNGGU KEPUTUSAN OWNER)

> Happy-path arahan owner sudah sangat lengkap. Gap ada di titik UANG & SENGKETA (paling mahal bila
> ketinggalan). Diurut dari paling berisiko. #1-4 mengubah STRUKTUR DATA → sebaiknya diputus SEBELUM coding.

### KRITIS (uang & kepercayaan)
1. **Setoran kas teknisi (cash settlement)** — GAP TERBESAR. Uang tunai masuk kantong TEKNISI dulu.
   "Invoice lunas" ≠ uang sampai ke pemilik. Perlu status "terkumpul (di teknisi)" vs "disetor ke pemilik"
   + laporan "kas belum disetor per teknisi". Krusial untuk tim; tak perlu bila pemilik=teknisi.
2. **Kapan insentif earned/dibayar?** Saat SELESAI atau saat LUNAS? Untuk tempo yang macet, bayar insentif
   sebelum uang masuk = pemilik rugi. Rekomendasi: earned saat selesai, DIBAYAR saat invoice lunas. → KEPUTUSAN OWNER.
3. **Invoice dirakit DI LOKASI** oleh teknisi (penugasan umum). Teknisi pilih item dari ServiceCatalog di HP
   + tambah item tak terduga + qty on-site. Masuk eksplisit Fase 4 + daftar layanan harus akses teknisi.
4. **Tiap InvoiceItem → assetId (unit AC tertentu).** 1 kunjungan = banyak unit. Kartu perawatan butuh
   "unit INI dikerjakan apa, oleh siapa, kapan". Tambah `InvoiceItem.assetId` di Fase 4.

### PENTING (sering terjadi — sebaiknya v1)
5. **Pembayaran SEBAGIAN** (tempo B2B nyicil) + **revisi/pembatalan invoice** (nota kredit). "Lunas/belum" tak cukup.
6. **Diskon** per-baris / per-invoice (nego lapangan).
7. **Rekening bank tenant** tampil di invoice tempo (tujuan transfer). Tambah field rekening di Tenant.
8. **Biaya kunjungan / servis gagal** (datang tapi batal / survei saja) — bagaimana dicatat.

### DITUNDA (agent sarankan JANGAN v1 — anti over-engineering)
9. **e-Faktur PKP (Faktur Pajak resmi + NSFP dari DJP)** — sistem berat & terpisah. v1 cukup PPN sederhana
   + disclaimer "tenant PKP urus e-Faktur di aplikasi pajak sendiri". Mayoritas pilot non-PKP.
10. **Stok consumable/sparepart (inventory)** — v1 perlakukan sebagai item invoice biasa (tanpa stok);
    inventory modul tersendiri bila pilot minta.
11. **Servis garansi/komplain (nilai Rp0)** tetap tercatat di kartu perawatan + mungkin insentif. Perlu definisi.
12. **PIC ganda institusi** (PIC lapangan ≠ PIC keuangan). 2 kontak per pelanggan badan. Ringan.

**Butuh keputusan owner sebelum Fase 4 (uang):** (a) timing insentif [#2], (b) fitur setoran kas [#1],
(c) mana dari #5-8 masuk v1. #3, #4 sudah pasti masuk Fase 4 (struktur data).

---

## E3. KEPUTUSAN OWNER FINAL (28 Agu) — jawaban atas 12 gap E2

1. **Setoran kas teknisi**: ADA. Status kas "terkumpul (di teknisi)" → "disetor ke pemilik" + laporan
   "kas belum disetor per teknisi".
2. **Insentif**: default = **invoice LUNAS dalam periode**. Konfigurasi tenant "Acuan insentif":
   (A) tanggal LUNAS [default], (B) tanggal invoice TERBIT (abaikan status bayar).
3. **Layar kerja lapangan (WorkSession per pelanggan)** — INTI:
   - Teknisi isi pekerjaan PER UNIT AC, **bisa dicicil** (entry tiap unit selesai).
   - Minim ketik: pilih unit (dari daftar pelanggan / tambah baru) + pilih layanan (katalog). Harga
     **auto**: harga khusus pelanggan bila ada, else standar. **Harga di-SNAPSHOT** saat entry (imun
     terhadap perubahan harga katalog kemudian).
   - Tiap baris layanan @unit tampung **1+ teknisi & 1+ kernet** (peran cair). Nama TIDAK di invoice.
   - Tutup → sistem **generate otomatis** Invoice (Cash) / Proforma (Tempo). Teknisi tak input biaya.
   - Sumber tunggal WorkSession mengalir ke: **invoice/proforma + kartu perawatan + insentif**.
   - **Mapping**: 1 penugasan/kunjungan = 1 WorkSession = 1 Invoice/Proforma.
4. **InvoiceItem.assetId** wajib (tiap baris → unit AC). Detail invoice dikelompokkan per unit:
   `[kode unit + keterangan] → baris: layanan | qty | harga | satuan | total`.
5. **Tempo lunas 1x** (TANPA cicilan di app; cicilan dicatat manual di luar). App = fasilitas penutupan
   setelah lunas. **Revisi** invoice/proforma **hanya admin tenant** (teknisi minta admin bila salah).
   **Diskon**: hanya B2B, hanya admin (saat proforma→invoice), **per-invoice** (bukan per-item),
   **pajak dihitung SETELAH diskon**. Teknisi tak bisa diskon (invoice cash tanpa diskon).
6. = 5.
7. **Tenant**: field rekening (`bankName`, `bankAccountNo`, `bankAccountName`) + `qrisImageUrl` (opsional,
   QRIS **statis** = upload gambar). Muncul di SETIAP invoice/proforma (tunai & tempo). App teknisi
   tampilkan QRIS tenant bila pelanggan cash mau bayar QRIS.
8. **Biaya survei/kunjungan** = cukup item layanan "survei" berharga, ditagihkan opsional. Servis gagal
   (pelanggan tak ada) = tenant bebas tagih layanan kunjungan atau tidak. TAK dibuat ribet.
9. Tanpa e-Faktur (bukan ERP). 10. Tanpa stok/inventory (bukan ERP).
11. **Garansi** = item layanan harga Rp0, proses sama layanan lain.
12. **PIC ganda**: Customer perorangan = data minimal wajib. Badan = opsional `picWork` (nama/HP/jabatan)
    & `picFinance` (nama/HP) terpisah. Semua opsional kecuali minimal perorangan (nama+HP).

**MENUNGGU 1 KEPUTUSAN UANG**: aturan pembagian insentif bila 1 baris layanan dikerjakan >1 personel
peran sama (bagi rata vs penuh) — lihat pertanyaan ke owner.

---

## F. RINGKAS SATU PARAGRAF
Aplikasi **belum** mendukung alur bisnis nyata invoicing/piutang/insentif ini — sebagian besar (katalog
layanan, invoice, proforma, multi-personel, kernet, insentif, TOP, kategori/pajak pelanggan, laporan AR)
**belum ada** dan perlu dibangun sebagai modul baru ~7 fase. Fondasinya (Customer dgn koordinat, JobOrder+FSM,
pagination pelanggan, profil pajak Lumite) **sudah ada** dan dipakai ulang. Rencana ini additive & bertahap
agar **nol regresi** pada 201 test + money-loop yang sudah live. Pajak dirancang **opt-in & configurable**
sesuai realita (mayoritas pilot = tenant kecil non-PKP + pelanggan rumahan → invoice bersih tanpa pajak;
PPN/PPh23 aktif hanya untuk tenant PKP / pelanggan badan B2B).
