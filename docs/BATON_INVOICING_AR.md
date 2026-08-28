# PELACAK PEKERJAAN (BATON) — Modul Invoicing/AR/Insentif Aircon

> **FILE INI = TONGKAT ESTAFET.** Sumber kebenaran status pekerjaan. Tahan compaction/sesi-baru/kredit-habis.
> Pasangan: `docs/RENCANA_INVOICING_AR.md` (KENAPA & APA/desain). File ini = SAMPAI MANA & BAGAIMANA/status.
> Bila keduanya berbeda, RENCANA_INVOICING_AR.md menang untuk desain; file ini menang untuk status.

---

## 🔴 PROTOKOL RESUME (BACA INI DULU SETIAP MULAI/LANJUT)

1. Baca `git log --oneline -15` → cocokkan dengan "COMMIT TERAKHIR" di bawah.
2. Cari item pertama yang **belum `[x]`** dari atas → itu pekerjaan berikutnya. JANGAN lewati item.
3. Baca "STATUS SAAT INI" + "CATATAN SERAH TERIMA" di bawah untuk konteks in-flight.
4. Verifikasi baseline hijau SEBELUM menyentuh kode baru:
   `npx tsc --noEmit` (0) · `npx vitest run` (semua lulus) · `pnpm build` (0).
   Bila baseline MERAH → perbaiki dulu sampai hijau sebelum lanjut fitur (jangan menumpuk bug).
5. Kerjakan HANYA 1 item sub-fase pada satu waktu sampai DoD-nya terpenuhi, baru centang.
6. Setiap selesai item: update file ini (centang + "COMMIT TERAKHIR" + "STATUS SAAT INI") lalu commit.

## ✅ DEFINITION OF DONE (DoD) — item boleh `[x]` HANYA bila SEMUA ini benar
- [ ] Kode ditulis + mengikuti spec eksak di item (nama field/enum/route persis).
- [ ] `npx tsc --noEmit` → 0 error.
- [ ] Unit test untuk item ini ADA & LULUS (bila item punya logika/kalkulasi).
- [ ] `npx vitest run` → SELURUH suite lulus (tak ada regresi test lama).
- [ ] `pnpm build` → exit 0.
- [ ] Bila UI: dogfood ringan (render + 1 interaksi inti) via Playwright headless, 0 JS exception.
- [ ] Migrasi (bila ada) = ADDITIVE-only (nullable/tabel baru), sudah `migrate deploy` ke Supabase, `generate` OK.
- [ ] Commit + push berhasil; deploy Vercel READY (verifikasi state).
- [ ] File ini diupdate (centang + commit terakhir + catatan).
> Bila salah satu gagal → item TETAP `[ ]`. Jangan pernah centang item yang "hampir".

## 🧭 ATURAN ANTI-BUG (WAJIB tiap fase)
- Migrasi additive-only. TIDAK drop/rename kolom lama. Field baru nullable / default.
- Uang & pajak & insentif = **Decimal** (bukan float) + service MURNI + test angka eksplisit.
- Fitur baru additive: sistem lama tetap jalan bila field baru kosong (backward-compatible).
- Snapshot harga di item invoice (invoice historis tak berubah walau katalog berubah).
- Subagent paralel HANYA untuk file-eksklusif; verifikasi git sendiri.
- JANGAN kirim WA nyata saat test (pola simulasi/preview).

---

## 📌 STATUS SAAT INI  ← update tiap commit
- **Fase aktif**: FASE 1 (in-progress).
- **Item berikutnya**: F1.5 (upload logo tenant + profil pajak/rekening/QRIS) → F1.6 logo publik → F1.7 GPS.
- **COMMIT TERAKHIR (baseline)**: `f03446d` (F1.3+F1.4) + F1.3b (commit berikut).
- **Baseline hijau**: tsc 0 · 210 test · build 0.
- **CATATAN SERAH TERIMA**: F1.1, F1.2, F1.0, F1.3, F1.4, F1.3b SELESAI & terverifikasi. Pelanggan & Unit AC
  kini keduanya lazy-load (cursor + IntersectionObserver + search server-side). Form pelanggan diperkaya.
  BERIKUTNYA F1.5: presignTenantLogo (s3.ts pola presignLandingAsset) + halaman /app/pengaturan (upload logo
  512×512 + isi isPkp/npwp/taxPercent + rekening + qrisImageUrl). TenantLogo komponen sudah ada (dipakai sidebar).

## 🔬 ANALISA DAMPAK F1 (DB→BE→FE) — WAJIB dipatuhi saat implement
- **DB**: migrasi additive-only OK. Self-FK `billingCustomerId` ON DELETE SET NULL. ⚠️ RISIKO: dunning
  `purgeMarkedTenants` hard-delete `prisma.customer.deleteMany({tenantId})` — dengan self-FK, SET NULL
  menangani ref antar-customer sesama tenant. WAJIB test: purge tenant yang punya billingCustomer tak error.
- **BE**: `createCustomer`/`updateCustomer` WHITELIST field (bukan spread) → field baru HARUS ditambah
  eksplisit (aman anti mass-assignment). `createCustomerSchema` dipakai server-action DAN REST API
  (`api/customers`) → tambah field OPTIONAL = backward-compatible dua-duanya.
- **FE konsumen Customer**: pelanggan/page.tsx (map eksplisit→tambah field), customer-manager.tsx (form
  raw `<select>`+FormData→extend+pakai shadcn Select), pekerjaan/baru/page.tsx (dropdown, additive),
  asset-actions/code-actions listCustomers (additive). Tenant logo dibaca /p/[slug],/u/[code],/riwayat,/app.
- **UI LIBRARY (mandat owner: seragam)**: shadcn `ui/select.tsx` ADA → pakai untuk dropdown baru
  (kategori/TOP/tipe) + rapikan `<select>` lama. Radix Select = controlled (bukan FormData otomatis) →
  kelola via state/controlled, jangan pecahkan submit yang sudah jalan.

---

## 📚 KEPUTUSAN TERKUNCI (RUJUKAN CEPAT — JANGAN MELENCENG)
Sumber lengkap: RENCANA_INVOICING_AR.md §E,E2,E3. Ringkas paku mati:
- **K1** Midtrans HANYA tenant→Lumite. Pembayaran pelanggan→tenant = manual + upload bukti + kwitansi WA. TANPA gateway pelanggan di v1.
- **K2** Logo tenant `logoUrl` 512×512, default Aircon, tampil di: /p/[slug], /u/[code], /riwayat/[token], header /app, + invoice/proforma/kwitansi (Fase 4). Aircon tak muncul di permukaan tenant.
- **K3** Personel lapangan = SATU entitas (login+PIN). Peran teknisi/kernet **cair per-penugasan** (`roleOnJob`). N personel/job.
- **K4** Pajak OPT-IN: non-PKP + rumahan = invoice tanpa pajak. PPN bila tenant PKP. PPh23 info bila pelanggan badan. Semua configurable (bukan hardcode).
- **K5** Insentif: default dihitung dari invoice **LUNAS** dalam periode; configurable tenant (LUNAS[default]|TERBIT).
- **K6** Insentif melekat di SEMUA kategori item (jasa/consumable/sparepart). Insentif=0 → tak ada. Field: tech & kernet, masing-masing PERCENT|VALUE.
- **K7** Mode insentif tim (1 layanan dikeroyok >1 orang peran sama): BAGI_RATA[default] | PENUH — configurable tenant. Pos teknisi & kernet terpisah.
- **K8** WorkSession = layar lapangan per pelanggan: entry per unit (bisa dicicil), pilih dari daftar (minim ketik), harga auto (khusus pelanggan ?? standar) + **snapshot**. Tutup → auto-generate Invoice(Cash)/Proforma(Tempo). Teknisi tak input biaya.
- **K9** Tiap baris invoice → `assetId` (unit AC). Detail invoice dikelompokkan per unit.
- **K10** Tempo lunas 1x (TANPA cicilan di app). App = fasilitas penutupan setelah lunas.
- **K11** Revisi invoice/proforma = HANYA admin tenant (bukan teknisi).
- **K12** Diskon: hanya B2B, hanya admin (saat proforma→invoice), **per-invoice** (bukan per-item), pajak dihitung SETELAH diskon.
- **K13** Tenant: rekening (`bankName`,`bankAccountNo`,`bankAccountName`) + `qrisImageUrl` opsional. Muncul di semua invoice/proforma. App teknisi tampilkan QRIS bila cash+QRIS.
- **K14** Survei/servis gagal = item layanan "survei" berharga, opsional. Tak dibuat ribet.
- **K15** Garansi = item layanan Rp0, proses sama.
- **K16** PIC ganda: perorangan = minimal (nama+HP) wajib; badan = `picWork` & `picFinance` opsional terpisah.
- **K17** Setoran kas teknisi: status "terkumpul(teknisi)" → "disetor(pemilik)" + laporan kas belum disetor.
- **K18** Nama teknisi/kernet TIDAK muncul di invoice/proforma (hanya untuk insentif + kartu perawatan).
- **K19** Tempo→dueDate dihitung dari TOP pelanggan (CASH/TEMPO_30/45/60/90) sejak tanggal invoice terbit.
- **K20** MVP = Fase 1→4 dulu; Fase 5→7 menyusul. Tiap fase deployable & hijau sendiri.

---

# ═══════ FASE 1 — Pelanggan diperkaya + Logo & Rekening Tenant ═══════
Status fase: [ ] BELUM

### F1.1 — Schema: enum + kolom (migrasi additive)  [x] DONE (migrasi 20260828, deploy OK)
- [x] enum `CustomerCategory` { RUMAH, SEKOLAH_KAMPUS, MASJID_MUSHOLA, TOKO_OUTLET, RUKO_RUKAN, KANTOR_PERUSAHAAN, LAINNYA }
- [x] enum `CustomerType` { PERORANGAN, BADAN }
- [x] enum `TopType` { CASH, TEMPO_7, TEMPO_14, TEMPO_30, TEMPO_45, TEMPO_60, TEMPO_90 }
- [x] Customer + kolom (semua nullable/optional): `category`, `customerType`, `topType`, `npwp`, `isPphWithholder`, `billingCustomerId` (self-relation), PIC work/finance
- [x] Tenant + kolom: `logoUrl`, `isPkp`, `npwp`, `taxPercent`, `bankName`, `bankAccountNo`, `bankAccountName`, `qrisImageUrl`
- DoD: ✅ validate · migrate diff additive-only (19 ADD COLUMN + 3 enum, 0 destruktif) · deploy · generate · tsc 0 · build 0.

### F1.2 — Validasi (Zod) + service Customer diperluas  [x] DONE
- [x] Zod: field baru optional + enum tervalidasi (customer.ts)
- [x] Service: create/update whitelist field baru; `resolveBillingCustomer` (tenant-scoped, fallback diri)
- [x] Test: tests/customer-invoicing-fields.test.ts (9 test: enum valid/invalid, backward-compat, billing-to, isolasi tenant) → 210 test total lulus, tsc 0, build 0

### F1.0 — APP SHELL responsif (sidebar tenant) [x] DONE
> Owner: dashboard jangan sekadar launcher card; pakai menu samping responsif agar dashboard maksimal.
- [x] `src/app/app/layout.tsx`: shell sidebar persisten (desktop md+) + drawer (mobile) via shadcn Sheet
      (`ui/sheet.tsx` baru, di atas @base-ui Dialog — seragam dgn ui/dialog.tsx).
- [x] `_components/app-nav.tsx` (APP_NAV 1 sumber, usePathname, ikon Lucide, active-state) — 9 menu.
- [x] `_components/mobile-nav.tsx` hamburger→Sheet drawer; tutup saat pilih menu (onNavigate).
- [x] Hamburger dipasang di AppHeader (muncul di SEMUA halaman /app otomatis, md:hidden). Back button opsional.
- [x] Dashboard /app/page.tsx: header lama diganti AppHeader; NavCard grid diringkas jadi "Aksi Cepat" 4
      pintasan; metrik jadi fokus. Navigasi utama via sidebar.
- [x] `components/tenant-logo.tsx` (reusable, fallback logo Aircon) — dipakai di sidebar (F1.6 lanjut ke publik).
- [x] Icon set +Menu/Settings/Dashboard.
- [x] DoD: tsc 0 · 210 test · build 0 · dogfood desktop(sidebar 9 link, active-state) + mobile(drawer,
      auto-close) 0 JS exception. Visual world-class diverifikasi (screenshot).

### F1.3 — UI: lazy-load daftar pelanggan (ratusan card)  [x] DONE
- [x] Service `listCustomerRows` (cursor id desc + _count assets/jobs + search server-side).
- [x] Server action `actionLoadCustomers` (batch berikutnya / pencarian).
- [x] customer-manager.tsx: IntersectionObserver infinite-scroll + Skeleton; page kirim batch pertama.
- [x] Dogfood: list render, search server-side cocok, 0 JS exception.

### F1.3b — UI: lazy-load daftar UNIT AC (ratusan) [x] DONE  ← arahan owner (institusi besar)
- [x] Service `listAssetRows` (cursor id desc + customer name + _count jobs + nextServiceDate + search).
- [x] Server action `actionLoadAssets`. unit-manager.tsx: state list + IntersectionObserver + Skeleton;
      search server-side; mutasi (edit/hapus/tambah/bind) refresh list lokal. Fitur scan/bulk/edit/delete UTUH.
- [x] Dogfood: list render + Scan/Tambah tetap ada (regresi OK), search nomatch benar, form Tambah terbuka,
      0 JS exception. tsc 0, 210 test, build 0.

### F1.4 — UI: form pelanggan diperkaya (kategori/TOP/tipe/pajak/PIC)  [x] DONE
- [x] Field baru di form (shadcn Select: kategori/jenis/TOP/sumber — seragam). PIC+pajak muncul hanya bila BADAN.
- [x] Perorangan: wajib nama+HP. Badan: NPWP/PPh/PIC pekerjaan+keuangan opsional.
- [x] Dogfood: tambah pelanggan BADAN + PIC + TOP → tampil (badge Tempo) + PERSIST diverifikasi via DB
      (customerType/topType/npwp/picWorkName/picFinanceName tersimpan benar). 0 JS exception.

### F1.5 — Logo tenant: upload + komponen TenantLogo  [ ]
- [ ] `presignTenantLogo` di s3.ts (pola presignLandingAsset). Validasi 512×512 (atau resize sisi klien) + tipe gambar.
- [ ] Komponen `<TenantLogo tenant/size>` reusable: logo tenant, fallback logo Aircon bila `logoUrl` kosong.
- [ ] Halaman `/app/pengaturan` (baru) atau seksi di /app/langganan: upload logo + profil pajak (isPkp/npwp/taxPercent) + rekening + QRIS.
- [ ] Test: fallback logo Aircon saat kosong; presign menghasilkan URL.
- [ ] Dogfood: upload logo → tampil.

### F1.6 — Pasang TenantLogo di permukaan publik + dashboard  [ ]
- [ ] `/p/[slug]` — ganti avatar-huruf → `<TenantLogo>`.
- [ ] `/u/[code]` — ganti teks "Ditenagai Aircon" → logo tenant (boleh footer halus "dibuat dengan Aircon").
- [ ] `/riwayat/[token]` — header pakai logo tenant.
- [ ] Header dashboard `/app` — logo tenant.
- [ ] Dogfood: keempat halaman render logo (fallback Aircon bila kosong), 0 exception.

### F1.7 — UI: teknisi isi koordinat pelanggan saat di lokasi  [ ]
- [ ] Tombol "Ambil lokasi GPS" (navigator.geolocation) di layar teknisi → simpan geoLat/geoLng ke Customer.
- [ ] Server action tenant-scoped; hormati bila pelanggan sudah punya koordinat (konfirmasi timpa).
- [ ] Test action + dogfood.

### F1.GATE — Verifikasi Fase 1  [ ]
- [ ] tsc 0 · seluruh vitest lulus · build 0 · deploy READY.
- [ ] Regresi: 201 test lama tetap lulus. Money-loop tak tersentuh.
- [ ] Update file ini + commit "FASE 1 DONE".

---

# ═══════ FASE 2 — ServiceCatalog + Harga Khusus Pelanggan ═══════
Status fase: [ ] BELUM

### F2.1 — Schema ServiceCatalog + CustomerPricing (additive)  [ ]
- [ ] enum `ServiceCategory` { MAINTENANCE, SERVICE, CONSUMABLE, SPAREPART, PAKET, SURVEI, GARANSI, LAINNYA }
- [ ] enum `IncentiveType` { PERCENT, VALUE }
- [ ] model `ServiceCatalog` { id, tenantId, code, name, category ServiceCategory, standardPrice Decimal @db.Decimal(12,2), unit String, description String?, active Boolean @default(true), techIncentiveType IncentiveType @default(VALUE), techIncentiveValue Decimal @default(0), kernetIncentiveType IncentiveType @default(VALUE), kernetIncentiveValue Decimal @default(0), createdAt, updatedAt, @@unique([tenantId, code]) }
- [ ] model `CustomerPricing` { id, tenantId, customerId, serviceId, price Decimal, @@unique([customerId, serviceId]) }
- DoD schema (validate/migrate/generate/tsc/build).

### F2.2 — Service catalog + resolusi harga + insentif murni  [ ]
- [ ] `service-catalog-service.ts`: CRUD (tenant-scoped), list per kategori.
- [ ] `resolvePrice(tenantId, customerId, serviceId)` → CustomerPricing.price ?? ServiceCatalog.standardPrice.
- [ ] `computeItemIncentive(catalogItem, roleOnJob, qty, personCountSameRole, teamMode)` MURNI → nilai per personel (hormati K6 semua kategori, K7 bagi-rata/penuh, insentif=0).
- [ ] Test BANYAK: %/nilai, qty>1, bagi-rata 2-3 orang, penuh, insentif=0, kategori consumable/sparepart.

### F2.3 — UI /app/layanan (CRUD katalog)  [ ]
- [ ] Halaman + form (shadcn), field insentif tech & kernet dengan teks bantu aturan bagi-rata (K6/K7).
- [ ] Dogfood: tambah item jasa + item sparepart berinsentif → persist.

### F2.4 — UI harga khusus pelanggan  [ ]
- [ ] Kelola CustomerPricing per pelanggan (pilih layanan → harga khusus).
- [ ] Dogfood: set harga khusus → resolvePrice pakai harga khusus.

### F2.GATE — Verifikasi Fase 2  [ ] (tsc/test/build/deploy/regresi + update file ini + commit)

---

# ═══════ FASE 3 — Multi-personel & Peran Cair + Penugasan ═══════
Status fase: [ ] BELUM

### F3.1 — Schema JobAssignment + assignmentType (additive)  [ ]
- [ ] enum `AssignmentRole` { TECHNICIAN, KERNET }
- [ ] enum `AssignmentType` { UMUM, SPESIFIK }
- [ ] model `JobAssignment` { id, tenantId, jobId, personId (→User/Technician), roleOnJob AssignmentRole, isLead Boolean @default(false), createdAt, @@index([tenantId, jobId]), @@index([tenantId, personId]) }
- [ ] JobOrder + `assignmentType AssignmentType @default(SPESIFIK)` (backward-compat: job lama = SPESIFIK).
- [ ] Migrasi data: isi JobAssignment dari `technicianId` lama (1 baris TECHNICIAN isLead) — script one-shot idempoten.
- DoD schema + migrasi data terverifikasi (hitung baris).

### F3.2 — Service penugasan multi-personel + deteksi bentrok  [ ]
- [ ] `assignJob(jobId, [{personId, roleOnJob, isLead}], window)` tenant-scoped.
- [ ] `detectConflict(personId, windowStart, windowEnd, excludeJobId?)` MURNI/queried → overlap waktu.
- [ ] Kode lama baca `technicianId` tetap jalan (backward-compat).
- [ ] Test: conflict overlap/no-overlap/lintas-peran, multi-personel, migrasi data.

### F3.3 — UI penugasan (admin) + notifikasi personel  [ ]
- [ ] UI admin: pilih N personel + peran masing-masing; mode UMUM vs SPESIFIK; peringatan bentrok.
- [ ] Notifikasi ke tiap personel (in-app + WA SIMULASI dulu): pelanggan/PIC, waktu, kontak, alamat + link Google Maps (geoLat/geoLng), catatan, sistem bayar (Cash/Tempo), peran di job ini.
- [ ] Dogfood: assign 2 personel beda peran → muncul di /t masing-masing.

### F3.GATE — Verifikasi Fase 3  [ ] (tsc/test/build/deploy/regresi + update + commit)

---

# ═══════ FASE 4 — WorkSession + Invoice/Proforma + Pajak (INTI UANG) ═══════
Status fase: [ ] BELUM  ·  ⚠️ PALING SENSITIF — test angka eksplisit wajib.

### F4.1 — Schema WorkSession + Invoice + Proforma (additive)  [ ]
- [ ] enum `DocType` { INVOICE, PROFORMA }
- [ ] enum `InvoiceStatus` { DRAFT, ISSUED, PAID, OVERDUE, CANCELLED }
- [ ] enum `PayMethod` { CASH, TRANSFER, QRIS }
- [ ] enum `CashRemitStatus` { HELD_BY_TECH, REMITTED } (K17)
- [ ] model `WorkSession` { id, tenantId, jobId?, customerId, status (OPEN/CLOSED), openedById, closedAt, createdAt }
- [ ] model `WorkItem` { id, tenantId, workSessionId, assetId (K9), serviceId?, descSnapshot, category, qty Decimal, unit, unitPriceSnapshot Decimal (K8 snapshot), lineTotal Decimal, techIds String[], kernetIds String[] (K18 tak di invoice) }
- [ ] model `Invoice` { id, tenantId, docType DocType, number String, customerId, billingCustomerId?, workSessionId?, jobId?, status InvoiceStatus, issueDate, dueDate (K19), subtotal Decimal, discountAmount Decimal @default(0) (K12), taxableService Decimal, taxableGoods Decimal, ppnPercent Float @default(0), ppnAmount Decimal @default(0), total Decimal, payMethod PayMethod?, paymentProofUrl?, paidAt?, cashRemitStatus CashRemitStatus?, createdById, @@unique([tenantId, number]) }
- [ ] model `InvoiceItem` { id, invoiceId, assetId (K9), descSnapshot, category, qty, unit, unitPrice, lineTotal }
- DoD schema.

### F4.2 — Service penomoran + kalkulasi (MURNI, test berat)  [ ]
- [ ] `nextInvoiceNumber(tenantId, docType, year)` transaksional anti-duplikat (unique + retry).
- [ ] `computeInvoiceTotals({items, discountAmount, tenantIsPkp, taxPercent, customerType})` MURNI:
      subtotal → dikurangi diskon → pajak SETELAH diskon (K12) → total. Pisah DPP jasa vs barang (K4/PPh info).
- [ ] `computeDueDate(issueDate, topType)` (K19).
- [ ] Test angka EKSPLISIT (Decimal): non-PKP tanpa pajak; PKP + PPN; diskon→pajak; TOP→dueDate; pembulatan; penomoran konkuren.

### F4.3 — WorkSession UI teknisi (layar lapangan K8)  [ ]
- [ ] Layar per pelanggan: daftar unit (pilih/ tambah), per unit pilih layanan dari katalog (minim ketik), qty, harga auto+snapshot, tandai teknisi/kernet (1+).
- [ ] Bisa dicicil (entry per unit selesai). Ringkas berjalan (subtotal).
- [ ] Tutup sesi → auto-generate Invoice (Cash) / Proforma (Tempo) sesuai `customer.topType`. Teknisi tak input biaya.
- [ ] Dogfood: sesi 2 unit × 2 layanan → tutup → dokumen ter-generate benar.

### F4.4 — Invoice/Proforma: tampilan + PDF + kwitansi + WA  [ ]
- [ ] Halaman invoice/proforma: header logo tenant (K2) + rekening/QRIS (K13); detail dikelompokkan per unit (K9); nama personel TIDAK tampil (K18).
- [ ] Cash: teknisi tandai bayar (CASH/TRANSFER/QRIS) + upload bukti → status PAID → kwitansi WA (SIMULASI dulu) (K1).
- [ ] Tempo: proforma auto-WA ke pelanggan; admin buat Invoice dari proforma (K10/K11) + diskon (K12).
- [ ] QRIS tenant tampil di app teknisi bila cash+QRIS (K13).
- [ ] Dogfood: cash→bukti→PAID→preview kwitansi; tempo→proforma→admin jadikan invoice+diskon.

### F4.5 — Revisi (admin only) + pajak tenant PKP  [ ]
- [ ] Revisi/pembatalan invoice HANYA admin (K11); teknisi tak bisa.
- [ ] Pajak muncul hanya bila tenant PKP (K4); non-PKP invoice bersih. Disclaimer e-Faktur (tak dibangun, K9-tunda).
- [ ] Test + dogfood.

### F4.GATE — Verifikasi Fase 4  [ ] (tsc/test/build/deploy/regresi + update + commit) ⚠️ + review uang manual.

---

# ═══════ FASE 5 — Piutang (AR), Penerimaan, Setoran Kas ═══════ (post-MVP)
Status fase: [ ] BELUM
- [ ] F5.1 Service query: piutang s/d tanggal (aging), penerimaan per periode, invoice jatuh tempo.
- [ ] F5.2 Setoran kas teknisi (K17): tandai remitted, laporan kas belum disetor per teknisi.
- [ ] F5.3 Notif admin: invoice OVERDUE (bukan auto ke pelanggan).
- [ ] F5.4 UI laporan tenant: piutang, penerimaan, closing.
- [ ] F5.GATE verifikasi.

# ═══════ FASE 6 — Insentif & Laporan Kinerja ═══════ (post-MVP)
Status fase: [ ] BELUM
- [ ] F6.1 `computeIncentives(period, acuan=LUNAS|TERBIT K5)`: agregasi item→personel→insentif (K6/K7).
- [ ] F6.2 Laporan tenant: kinerja personil/periode, job belum ditugaskan, penugasan berlangsung, proforma belum jadi invoice.
- [ ] F6.3 Laporan teknisi (/t): penugasan belum close, selesai/periode, insentif/periode.
- [ ] F6.GATE verifikasi.

# ═══════ FASE 7 — Kartu Perawatan diperkaya + Bug Testing Final ═══════
Status fase: [ ] BELUM
- [ ] F7.1 Kartu perawatan unit: "terakhir dilayani APA, oleh SIAPA, TANGGAL" (dari WorkItem, tanpa biaya).
- [ ] F7.2 **BUG TESTING MENYELURUH** (skill dogfood + audit keamanan subagent):
      publik + login (teknisi/owner/admin) + alur uang end-to-end + regresi money-loop.
      Chrome headless+Playwright; sesi dev lokal untuk area login; bersihkan artefak setelah.
- [ ] F7.3 Audit isolasi-tenant khusus tabel uang baru (Invoice/WorkSession/Catalog): tak bocor antar tenant.
- [ ] F7.GATE final: 0 CRITICAL/HIGH, semua test hijau, deploy READY, laporan final ditulis.

---

## 🗂️ RIWAYAT SERAH TERIMA (append tiap sesi berakhir/lanjut)
- 2026-08-28: file baton dibuat. Belum ada kode. Baseline 29dfce1 (tsc0/201test/build0). Menunggu "mulai Fase 1".
