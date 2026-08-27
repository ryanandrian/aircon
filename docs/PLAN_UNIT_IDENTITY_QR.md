# RENCANA KERJA — Identitas Unit AC, QR Sticker & Kartu Perawatan Digital

Sumber: hasil diskusi 26 Agu 2026 (lihat docs/PROJECT_STATUS.md bagian keputusan). Semua fase
WAJIB lulus: `npx tsc --noEmit` = 0, `pnpm build` hijau, `pnpm test` semua lulus, + test baru per fase.
Prinsip: no-hardcode (konfigurabel), tenant-scoped/RLS, dark-ready shadcn, mobile-first, nol bug.

## RINGKAS KEPUTUSAN YANG DIIMPLEMENTASI (checklist induk — jangan ada terlewat)
- [F1] Identitas unit rapi: lokasi = combobox free-text yang MENYARANKAN dari data (per pelanggan→tenant).
- [F1] Field `quantity` (jumlah unit) di Asset — fallback unit kembar (default Pola A per-unit).
- [F1] Anti-duplikat: dedup-warning LUNAK saat tambah unit baru (warn, tak blokir).
- [F2] Buat-massal unit: isi form sekali (merek/PK/lokasi + jumlah N) → N record terpisah (Pola A).
- [F3] UnitCode: kode UNIK GLOBAL lintas tenant, ACAK uppercase (anti-crawl), status pool→bound.
- [F3] Generator batch kode + export Excel/CSV (tenant besar cetak sendiri; Lumite jual fisik).
- [F3] Bind kode↔unit (opsional, recommended). Kode tetap saat pindah tenant (jangkar portabilitas).
- [F4] Halaman publik /u/{CODE}: identitas MESIN + spek + riwayat DESCENDING. TANPA tenant/teknisi/
       biaya/identitas-pelanggan. Login hanya utk EDIT. URL subdomain lumite (bukan beli domain).
- [F4] Scan QR in-app (kamera HP via browser) — daftar (fn1) + cari cepat (fn2); validasi pola URL kita.
- [F5] Kartu perawatan digital per-PELANGGAN /riwayat/{TOKEN}: statis-permanen, isi-dinamis.
       UI institusi: ringkasan + tabel(desktop)/card(HP) + PENCARIAN + SORTING + detail per unit.
- [F5] Distribusi link OTOMATIS: (1) sisip kaki pesan WA reminder/selesai/ulasan; (2) auto saat servis
       pertama selesai; (3) tombol "Salin/Kirim via WA" di panel tenant.
- [F4/F5] Riwayat: tonjolkan "Perawatan terakhir: {tgl} — {aktivitas}".

## URUTAN EKSEKUSI (prioritas: fondasi data → nilai institusi → QR fisik)
Catatan urutan: kartu-perawatan (F5) diprioritaskan SEBELUM QR fisik (F3/F4) karena memberi nilai
terbesar (institusi) tanpa bergantung barang fisik, dan QR bersandar pada fondasi identitas (F1).

### FASE 1 — Fondasi identitas unit (skema + service + UI) [LOW RISK]
1. Schema: Asset + `quantity Int @default(1)`. Migrate. (tak ubah data lama; default 1 = perilaku kini)
2. Validasi: createAssetSchema + `quantity` (int ≥1, ≤ batas wajar mis. 100). update juga.
3. Service asset: suggestLocations(tenantId, customerId?) → daftar roomLocation distinct yang pernah
   dipakai (prioritas pelanggan itu, lalu tenant). findPossibleDuplicates(tenantId, customerId, {brand,
   capacityPk, roomLocation}) → daftar unit mirip (utk warning lunak).
4. UI: field lokasi jadi combobox (input + saran datalist/daftar klik). Tampilkan quantity.
5. Test: suggestLocations dedupe & prioritas; findPossibleDuplicates match; quantity validasi.

### FASE 2 — Buat-massal unit [LOW RISK, di atas F1]
1. Service: createAssetsBulk(tenantId, input, count) → transaksi N record (label posisi opsional
   "{roomLocation} #1..#N"). Hormati kuota paket (assertQuota acUnits × N).
2. UI form unit: opsi "jumlah unit" → bila >1 tawarkan buat-massal (N record) atau simpan quantity.
3. Test: createAssetsBulk bikin N record, label benar, kuota dihormati/ditolak.

### FASE 3 — UnitCode: pool kode + generator + export + bind [MEDIUM]
1. Schema: model UnitCode { code @unique (UPPERCASE acak), status POOL|BOUND, assetId? @unique,
   tenantId? (null=pool global), batchId?, createdAt, boundAt? }. Enum UnitCodeStatus. Migrate.
2. Lib kode: generateCode() — charset tanpa ambigu (hindari O/0, I/1), panjang ~7-8, uppercase.
   Cek unik saat insert (retry bila tabrakan).
3. Service: generateBatch(tenantId, count) → N kode POOL; exportCsv(batchId|tenantId); bindCode(
   tenantId, code, assetId) — hanya kode POOL/atau milik tenant; unbind; status transitions aman.
4. UI panel tenant /app/kode (atau di /app/perangkat): generate batch, tabel kode, export CSV/Excel,
   status. (Admin platform bisa generate pool global juga — opsional.)
5. Test: generateCode unik & charset; generateBatch; bind mengubah status+assetId; tolak bind ganda.

### FASE 4 — QR publik /u/{CODE} + scan in-app [MEDIUM]
1. Route publik app/u/[code]/page.tsx (force-dynamic, TANPA auth): tampilkan identitas mesin + spek +
   riwayat DESCENDING (JobOrder COMPLETED pada asset itu: tanggal + serviceType label). SEMBUNYIKAN
   tenant/teknisi/biaya/identitas-pelanggan. Kode tak-bound → "Kode belum terdaftar". default ON;
   (toggle per-tenant "tampilkan riwayat publik" — konfigurabel, default true).
2. Helper label aktivitas ServiceType→Indonesia (CLEANING="Cuci/servis rutin", dst).
3. Scan in-app: komponen kamera (BarcodeDetector API bila ada; fallback lib ringan) — baca URL,
   validasi pola domain kita, ekstrak {code}. Teknisi: kode POOL→wizard daftar/bind unit (fn1);
   kode BOUND→buka detail asset in-app (fn2). Titik pasang: /app/perangkat + /t (teknisi).
4. QR generator gambar (utk cetak/preview) — lib qrcode, uppercase URL (mode alfanumerik).
5. Test: public view strip data sensitif; label ServiceType; ekstraksi code dari URL; kode tak dikenal.

### FASE 5 — Kartu perawatan digital per pelanggan /riwayat/{TOKEN} + distribusi [MEDIUM-HIGH]
1. Schema: Customer + `cardToken String? @unique` (acak, di-generate saat pertama dibutuhkan/lazy).
   Migrate. Helper getOrCreateCardToken(customerId).
2. Route publik app/riwayat/[token]/page.tsx (TANPA auth): resolve token→customer(+tenant utk konteks
   internal saja, TAK ditampilkan). Ringkasan ("N unit • M jatuh tempo bulan ini") + daftar unit
   tabel/card + PENCARIAN (lokasi/merek/kode) + SORTING (jatuh tempo/lokasi/terakhir servis) + klik
   unit → riwayat descending. SEMBUNYIKAN biaya + data internal. Responsif.
3. Distribusi link:
   a. Konfig link base (InfraConfig/env: CARD_BASE_URL, default subdomain lumite). No-hardcode.
   b. Sisip footer link di render pesan WA reminder/selesai/ulasan (opsi tenant on/off; default on).
      Hormati batas anti-ban (tak menambah pesan, hanya baris).
   c. Hook job COMPLETED pertama pelanggan → enqueue WA "kartu perawatan" (MessageLog, sekali).
   d. Panel tenant halaman pelanggan: tombol "Salin link" + "Kirim via WA".
4. Test: token stabil/unik; halaman resolve; pencarian+sorting; footer link tersisip; auto-kirim sekali.

## VERIFIKASI AKHIR (semua fase)
- `npx tsc --noEmit`=0, `pnpm build` hijau, `pnpm test` semua lulus (target ≥ +15 test baru).
- Commit per fase (revert-able), deploy Vercel READY, update PROJECT_STATUS.
- Regressi cek: money-loop reminder-batch tetap jalan; kuota; RLS/tenant-scope tiap query baru.

## YANG SENGAJA DITUNDA (bukan bagian eksekusi ini — catat agar tak lupa)
- Portabilitas riwayat atas-izin lintas-tenant (pakai UnitCode sebagai jangkar) — fase masa depan.
- Portal pelanggan ber-login penuh (lihat biaya sendiri) — kini cukup kartu publik stripped.
- Cetak sticker fisik/material — urusan operasional Lumite (app hanya sediakan kode+export+QR image).
