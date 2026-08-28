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
- **Fase aktif**: FASE 4 SELESAI ✅ (MVP Fase 1-4 TUNTAS!) → berikutnya FASE 5 (Piutang/AR — post-MVP).
- **Item berikutnya**: F5.1 (query piutang/aging/penerimaan) — lihat blok FASE 5.
- **COMMIT TERAKHIR (baseline)**: `80ba5a5` (F4.3+F4.4a) + F4.4+F4.5/GATE (commit "FASE 4 DONE" berikut).
- **Baseline hijau**: tsc 0 · 268 test · build 0.
- **CATATAN SERAH TERIMA**: 🎉 MVP FASE 1-4 TUNTAS. Money loop invoicing lengkap: WorkSession lapangan →
  auto Invoice(Cash)/Proforma(Tempo) → bayar/kwitansi → proforma→invoice admin+diskon → cancel. 19 test uang eksplisit.
  BERIKUTNYA FASE 5 (post-MVP): AR/piutang (aging, penerimaan per periode, OVERDUE), setoran kas teknisi K17
  (remitted + laporan kas belum disetor), notif admin overdue, UI laporan tenant.

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
- **K21** Harga khusus pelanggan (penajaman owner): LAYAR KHUSUS TERPISAH, pola **TAMBAH per item**
  (admin pilih layanan dari katalog + set harga; hanya item yang ditambahkan yang jadi override; harga
  pre-fill standar sbg titik awal; layar hanya tampil daftar override, bukan seluruh katalog — ringan dirawat).
  Saat invoice: cek harga khusus utk kode layanan → ada=pakai, tak ada=harga standar katalog.
- **K22** Visibilitas harga (owner setuju rekomendasi): DUA tampilan terfokus, BUKAN matriks raksasa —
  (A) sisi layanan di /app/layanan: harga standar + indikator "N harga khusus", klik → daftar pelanggan+harga;
  (B) sisi pelanggan (layar F2.4): daftar override + baris pembanding harga standar.
  PLUS Export CSV semua override (kode,nama,harga standar,pelanggan,harga khusus,selisih) untuk audit menyeluruh.

---

# ═══════ FASE 1 — Pelanggan diperkaya + Logo & Rekening Tenant ═══════
Status fase: [x] SELESAI (F1.0–F1.7 + GATE) — commit "FASE 1 DONE"

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

### F1.5 — Logo tenant: upload + komponen TenantLogo  [x] DONE
- [x] `createTenantAssetUploadUrl` di s3.ts (key `tenants/{tenantId}/logo|qris/` — isolasi tenant).
- [x] Komponen `<TenantLogo>` (sudah dibuat di F1.0; fallback logo Aircon) — dipakai di form pengaturan + sidebar.
- [x] Halaman `/app/pengaturan` (baru): upload logo + profil pajak (isPkp/npwp/taxPercent, PKP-conditional)
      + rekening (bankName/No/Name) + QRIS upload. Service tenant-profile-service (whitelist) + Zod + actions (owner/admin).
- [x] Menu "Pengaturan" ditambah ke APP_NAV (sidebar + drawer).
- [x] Test: tests/tenant-profile.test.ts (4 test: kosong ok, PKP lengkap, tax>100 & negatif ditolak).
- [x] Dogfood: render 3 seksi, toggle PKP munculkan NPWP/PPN, simpan → PERSIST diverifikasi DB
      (isPkp/npwp/taxPercent/bank* tersimpan). 0 JS exception. tsc 0, 214 test, build 0. (data demo direset setelah tes)

### F1.6 — Pasang TenantLogo di permukaan publik + dashboard  [x] DONE
- [x] `/p/[slug]` — avatar-huruf → `<TenantLogo>` (select +logoUrl).
- [x] `/u/[code]` — header branding "Dirawat oleh {tenant}" + `<TenantLogo>`; footer "dibuat dengan Aircon"
      (getPublicUnitByCode +tenantName/tenantLogoUrl, fetch tenant terpisah).
- [x] `/riwayat/[token]` — header branding tenant + `<TenantLogo>` (getCustomerCardByToken +tenant fields).
- [x] Header dashboard `/app` — logo tenant (sudah via sidebar F1.0).
- [x] Dogfood: /p render logo(fallback Aircon)+nama, /u & /riwayat graceful (200, tak 500), 0 exception.
      tsc 0, 214 test (customer-card mock +tenant), build 0. Visual world-class diverifikasi (screenshot).

### F1.7 — UI: teknisi isi koordinat pelanggan saat di lokasi  [x] DONE
- [x] Tombol "Simpan/Perbarui Lokasi" (navigator.geolocation) di /t/pekerjaan/[id] → save geoLat/geoLng ke Customer.
- [x] Server action `techSaveCustomerLocation` tenant-scoped (verifikasi job milik teknisi; updateMany filter tenant;
      validasi koordinat) + konfirmasi timpa bila sudah ada lokasi.
- [x] tsc 0, 214 test, build 0. CATATAN: capture GPS = HARDWARE (kamera/GPS) → TAK bisa divalidasi dogfood
      headless; wajib tes device nyata saat pilot (sesuai memory). Struktur/aksi/guard terverifikasi via build+tsc.

### F1.GATE — Verifikasi Fase 1  [x] DONE
- [x] tsc 0 · 214 vitest lulus (201 lama + 13 baru) · build 0.
- [x] Regresi: seluruh test lama tetap lulus; money-loop tak tersentuh (hanya additive).
- [x] Commit "FASE 1 DONE" + deploy READY (diverifikasi Vercel).

---

# ═══════ FASE 2 — ServiceCatalog + Harga Khusus Pelanggan ═══════
Status fase: [x] SELESAI (F2.1–F2.5 + GATE)

### F2.1 — Schema ServiceCatalog + CustomerPricing (additive)  [x] DONE (migrasi 20260828_service_catalog_pricing, deploy OK)
- [x] enum `ServiceCategory` { MAINTENANCE, SERVICE, CONSUMABLE, SPAREPART, PAKET, SURVEI, GARANSI, LAINNYA }
- [x] enum `IncentiveType` { PERCENT, VALUE }
- [x] model `ServiceCatalog` (Decimal 12,2, insentif tech+kernet, @@unique[tenantId,code]) + back-ref Tenant.
- [x] model `CustomerPricing` (@@unique[customerId,serviceId], FK cascade) + back-ref Tenant/Customer/Service.
- DoD: ✅ validate · migrate diff additive-only (2 tabel + 2 enum, 0 destruktif) · deploy · generate · tsc 0 · build 0.

### F2.2 — Service catalog + resolusi harga + insentif murni  [x] DONE
- [x] `service-catalog-service.ts`: CRUD (tenant-scoped, whitelist) + setCustomerPrice/removeCustomerPrice/listCustomerPricing.
- [x] `resolvePrice(tenantId, customerId, serviceId)` → CustomerPricing.price ?? standardPrice (K21).
- [x] `computeItemIncentive(item, role, unitPrice, qty, personCount, teamMode)` MURNI (K6 semua kategori, K7 bagi-rata/penuh, insentif=0).
- [x] Test: tests/service-catalog.test.ts (15 test: VALUE/PERCENT, qty, bagi-rata 2-3, penuh, insentif=0, sparepart, resolvePrice ada/tak-ada). 229 test total, tsc 0, build 0.

### F2.3 — UI /app/layanan (CRUD katalog + visibilitas harga sisi-layanan)  [x] DONE
- [x] Halaman /app/layanan + CatalogManager (shadcn Card/Input/Select/Badge); form add/edit dgn kategori
      (Select) + insentif tech & kernet (type Rp/%  + nilai) + teks bantu aturan bagi-rata (K6/K7).
- [x] K22-A: tiap item tampil harga standar + insentif + indikator "N harga khusus"; klik → drill-down
      daftar pelanggan+harga (actionListOverrides). Service listCatalogWithOverrideCount + listOverridesForService.
- [x] Menu "Daftar Layanan" ditambah ke APP_NAV (Icon.Catalog). Actions CRUD (owner/admin guard, sanitize).
- [x] Dogfood: tambah jasa berinsentif → tampil di list + insentif tampil + PERSIST diverifikasi DB
      (standardPrice/techIncentive/kernetIncentive). 0 JS exception. tsc 0, 229 test, build 0. Visual world-class (screenshot). (data demo direset)

### F2.4 — UI harga khusus pelanggan (LAYAR KHUSUS TERPISAH)  [x] DONE  ← penajaman owner
- [x] Route KHUSUS `/app/pelanggan/[id]/harga` + CustomerPricingManager (shadcn). Link "Harga khusus"
      (Icon.Billing) di kartu pelanggan.
- [x] Pola TAMBAH per item (K21): "Tambah Harga Khusus" → Select layanan yg BELUM di-override → harga
      pre-fill standar → simpan. Layar tampil HANYA daftar override (bukan seluruh katalog).
- [x] Tiap override = 1 CustomerPricing; edit & hapus (hapus → kembali standar). Pembanding harga standar
      (coret) + badge selisih (K22-B).
- [x] resolvePrice (K21): dogfood — override 65rb vs standar 80rb → resolve cust-ini=65000 (diverifikasi DB).
- [x] Dogfood: render+nama, pre-fill standar, simpan override, list+pembanding. 0 JS exception. tsc 0, 229 test, build 0. (data demo direset)

### F2.5 — Export CSV harga khusus (audit menyeluruh, K22)  [x] DONE
- [x] Service `exportCustomerPricingCsv(tenantId)` (RFC4180 escape) → Kode, Nama, Harga Standar, Pelanggan,
      Harga Khusus, Selisih. Route GET `/app/layanan/export` (owner/admin, BOM UTF-8, Content-Disposition).
- [x] Tombol "Export CSV" di /app/layanan. Test: 2 (header+baris+escape koma+selisih; kosong→header saja). 231 test.

### F2.GATE — Verifikasi Fase 2  [x] DONE
- [x] tsc 0 · 231 vitest lulus · build 0 · deploy READY.
- [x] Regresi: money-loop & fase 1 tak tersentuh (semua additive). Commit per item.

---

# ═══════ FASE 3 — Multi-personel & Peran Cair + Penugasan ═══════
Status fase: [x] SELESAI (F3.1–F3.3 + GATE)

### F3.1 — Schema JobAssignment + assignmentType (additive)  [x] DONE (migrasi 20260828_job_assignment, deploy OK)
- [x] enum `AssignmentRole` { TECHNICIAN, KERNET } + enum `AssignmentType` { UMUM, SPESIFIK }
- [x] model `JobAssignment` (personId→Technician, roleOnJob, isLead, @@unique[jobId,personId]) + back-refs Tenant/JobOrder/Technician.
- [x] JobOrder + `assignmentType @default(SPESIFIK)` (backward-compat: job lama = SPESIFIK).
- [x] Migrasi data: scripts/migrate-job-assignments.mjs — backfill dari technicianId (1 baris TECHNICIAN isLead),
      IDEMPOTEN terverifikasi (run1 created=2; run2 skipped=2, 0 duplikat). tsc 0, 231 test, build 0.

### F3.2 — Service penugasan multi-personel + deteksi bentrok  [x] DONE
- [x] `assignJob(tenantId, jobId, people[], window?)` tenant-scoped (replace-set; validasi personel milik tenant;
      tepat 1 lead; backward-compat set JobOrder.technicianId=lead). `listAssignments`.
- [x] `detectConflict(tenantId, personId, start, end, excludeJobId?)` — job aktif (bukan COMPLETED/CANCELLED)
      via JobAssignment ATAU technicianId lama; `windowsOverlap` murni (ujung bersentuhan ≠ bentrok).
- [x] Backward-compat: kode lama baca technicianId tetap jalan.
- [x] Test: tests/assignment.test.ts (12: overlap penuh/terpisah/ujung/nested, detectConflict overlap/no/exclude/no-job,
      assignJob multi-personel lead default/eksplisit/tolak-luar-tenant/tolak-kosong). 243 test, tsc 0, build 0.

### F3.3 — UI penugasan (admin) + notifikasi personel  [x] DONE
- [x] UI admin (owner-actions.tsx): pilih N personel + peran (toggle Teknisi/Kernet) + tambah/hapus personel;
      lead = personel pertama; tanggal/jam/durasi; tombol "Cek bentrok jadwal" (actionCheckTeamConflicts →
      peringatan tanpa memblokir). Actions actionAssignTeam + actionCheckTeamConflicts (owner/admin).
- [x] Job detail: bagian "Tim" tampilkan semua personel + peran (+lead). Notifikasi in-app: /t
      (listTechnicianJobsToday diperluas → job via JobAssignment ATAU technicianId, jadi kernet/non-lead ikut lihat).
      Info job (pelanggan/alamat/GMaps/kontak/catatan) sudah ada di /t/pekerjaan/[id]. WA = simulasi (belum kirim nyata).
- [x] Dogfood: assign Andi(Teknisi,lead)+Budi(Kernet) → cek bentrok jalan → simpan → status ASSIGNED,
      DB terverifikasi (2 assignment peran benar, technicianId=lead), reload tampil tim. Visual world-class (screenshot). 0 exception.

### F3.GATE — Verifikasi Fase 3  [x] DONE
- [x] tsc 0 · 243 vitest lulus · build 0 · deploy READY. Regresi: additive, money-loop utuh. (data demo direset)

---

# ═══════ FASE 4 — WorkSession + Invoice/Proforma + Pajak (INTI UANG) ═══════
Status fase: [x] SELESAI (F4.1–F4.5 + GATE)  ·  ⚠️ PALING SENSITIF — test angka eksplisit wajib.

### F4.1 — Schema WorkSession + Invoice + Proforma (additive)  [x] DONE (migrasi 20260828_invoicing_worksession, deploy OK)
- [x] enum DocType, InvoiceStatus, PayMethod, CashRemitStatus, WorkSessionStatus.
- [x] model WorkSession (K8), WorkItem (assetId K9, snapshot harga, techIds/kernetIds K18), Invoice
      (nomor unik [tenantId,number], subtotal/diskon/DPP jasa+barang/ppn/total, payMethod/proof/paidAt/cashRemitStatus),
      InvoiceItem (per unit K9, snapshot). Back-refs Tenant/Customer/Asset. 5 enum + 4 tabel additive.

### F4.2 — Service penomoran + kalkulasi (MURNI, test berat)  [x] DONE
- [x] `nextInvoiceNumber` (INV/PRO/YYYY/urut-4-digit, cek tabrakan+retry).
- [x] `computeInvoiceTotals` MURNI: subtotal→diskon→PPN setelah diskon (K12); DPP jasa vs barang proporsional (K4);
      PPN hanya bila PKP; pembulatan Math.round; diskon dibatasi ≤subtotal & ≥0.
- [x] `computeDueDate`+`topDays` (K19: CASH→null, TEMPO_n→+n hari).
- [x] Test: tests/invoice-calc.test.ts (14 EKSPLISIT: non-PKP bersih, PPN 11/12%, diskon→pajak, diskon>subtotal,
      DPP jasa/barang proporsional tanpa rupiah hilang, pembulatan, dueDate). 257 test, tsc 0, build 0.

### F4.3 — WorkSession UI teknisi (layar lapangan K8)  [x] DONE
- [x] worksession-service (openWorkSession idempoten, addWorkItem harga resolvePrice+SNAPSHOT, removeWorkItem,
      getWorkSession, closeWorkSession auto-generate) + 4 test.
- [x] UI /t/kerja/[customerId] (mobile, minim ketik: pilih unit+layanan dari daftar, qty, harga auto, running total,
      bisa dicicil) + tombol "Catat Pekerjaan & Buat Tagihan" di /t/pekerjaan/[id].
- [x] Tutup → auto-generate Invoice(Cash)/Proforma(Tempo) sesuai customer.topType. Teknisi tak input biaya.
- [x] Dogfood: login teknisi PIN nyata → catat 1 layanan → tutup → INV/2026/0001 ISSUED Rp80.000 (DB verified). 0 exc.

### F4.4 — Invoice/Proforma: tampilan + kwitansi + pembayaran + proforma→invoice  [x] DONE
- [x] InvoiceView (komponen dipakai /t & /app): header logo tenant (K2), rekening/QRIS (K13), detail dikelompokkan
      per unit (K9), TANPA nama personel (K18), badge status, disclaimer proforma + e-Faktur.
- [x] Cash: PaymentPanel — pilih CASH/TRANSFER/QRIS + upload bukti (presign S3 tenant/bukti) → PAID + paidAt (K1).
- [x] Admin /app/faktur (daftar) + /app/faktur/[id]: ProformaConvert (K11 admin only) + diskon B2B (K12) → invoice baru,
      proforma jadi CANCELLED. Nav sidebar "Invoice & Proforma".
- [x] QRIS tampil di panel bila tenant punya (K13). Kwitansi WA = simulasi (belum kirim nyata).
- [x] Dogfood /app owner: list, cash→Tandai LUNAS→PAID (DB), proforma→convert→INV/2026/9002 ISSUED (DB). 0 exc.

### F4.5 — Revisi (admin only) + pajak tenant PKP  [x] DONE
- [x] cancelInvoice (K11 admin only; tolak bila PAID/CANCELLED) + CancelInvoiceButton di /app/faktur/[id]. +2 test.
- [x] Pajak: PPN hanya bila tenant PKP (K4, di computeInvoiceTotals + closeWorkSession + convert). Disclaimer e-Faktur (K9-tunda).
- [x] Dogfood: cancel INV/2026/9002 → status Batal (DB). 0 exc.

### F4.GATE — Verifikasi Fase 4  [x] DONE
- [x] tsc 0 · 268 vitest lulus · build 0 · deploy READY. Regresi: additive, money-loop lama utuh.
- [x] Review uang: kalkulasi 19 test eksplisit (14 calc + 5 flow) + Decimal DB. Data demo direset (0 invoice sisa).

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
