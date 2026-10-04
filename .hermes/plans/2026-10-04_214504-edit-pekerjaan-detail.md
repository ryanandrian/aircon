# Rencana Eksekusi Final — 5 Perbaikan Detail Pekerjaan

> **STATUS: RENCANA, belum ada perubahan kode/data tenant.**
> Menggantikan rencana jadwal-only dan rencana edit luas sebelumnya. Kedua file lama tetap ada
> sebagai riwayat, bukan rencana eksekusi.
>
> **Prinsip:** gunakan jalur existing; satu jalur edit umum baru hanya karena audit repo membuktikan
> fasilitas edit metadata memang belum ada. Tidak ada direct DB/backdoor untuk data tenant.

**Tujuan:** menutup 5 isu yang sudah disepakati: (1) buang harga job yang membingungkan, (2) simpan
jadwal konsisten + guard status server, (3) edit catatan sebelum selesai, (4) jelaskan status/tempat
menetapkan jadwal, (5) preview harga khusus dengan benar di app teknisi.

**Batas:** flow ServiceCatalog/CustomerPricing → WorkItem snapshot → Invoice/Proforma → Paid tidak
berubah. Tidak ada migrasi/schema, penulisan data Effi oleh agent, edit unit/customer/service, ubah
FSM/closing, audit-trail baru, optimistic-lock framework, atau jalur reschedule baru.

---

## 0. Fakta terverifikasi yang mendasari rencana

### Pekerjaan & jadwal
- Job Effi `cmutvpoa80001jpiubeq2kr83`: `ASSIGNED`; `scheduledDate=NULL`; `windowStart=2026-10-04T02:00Z`,
  `windowEnd=03:00Z`; 2 roster assignment TECHNICIAN lead + KERNET.
- `actionAssignTeam → assignment-service.assignJob` adalah jalur existing untuk roster/jadwal.
  Service menulis `JobAssignment`, `technicianId=lead`, window — tetapi tidak `scheduledDate`.
- Agenda/dashboard/filter memakai `scheduledDate`; layar teknisi menampilkan jam dari `windowStart`.
- FE detail menampilkan tombol assign hanya DRAFT/ASSIGNED, tetapi action/service assign tidak menegakkan
  batas status yang sama di server.
- `detectConflict` memakai window; kebijakan UI existing = peringatan bentrok namun tetap boleh simpan.
- Panel default tanggal hari ini dan jam 09:00 adalah nilai form yang BELUM persisted sebelum Simpan.

### Biaya & penagihan (jalur existing yang harus dipertahankan)
- Admin mengatur `ServiceCatalog.standardPrice` di `/app/layanan`.
- Admin mengatur override per pasangan customer×service di `/app/pelanggan/[id]/harga` (`CustomerPricing`).
- `resolvePrice` memilih override bila ada, selain itu `standardPrice`.
- Teknisi menambah WorkItem lewat `addWorkItem`: harga di-resolve server-side dan disnapshot sebagai
  `unitPriceSnapshot` + `lineTotal`. Form teknisi tidak mengirim/menulis harga.
- Saat menutup sesi, `closeWorkSession` membentuk invoice dari `WorkItem.unitPriceSnapshot`; TOP CASH
  → INVOICE; TOP tempo → PROFORMA; pembayaran invoice tunai/transfer/QRIS punya jalur terpisah.
- `JobOrder.price` ditulis form Pekerjaan Baru, tetapi **tidak dibaca** oleh worksession/invoice.
  Menghapus field ini dari form baru tidak menghapus kedua master harga admin dan tidak mengubah
  tagihan.
- Preview layanan pada layar teknisi saat ini memakai `svc.standardPrice * qty`, sedangkan harga
  yang benar saat submit tetap dihitung server `resolvePrice` dan baru terlihat di daftar item setelah
  disimpan. Untuk customer override, preview sebelum submit dapat berbeda dari nilai final.

### Edit detail & aplikasi teknisi
- Tidak ada `actionUpdateJob`/edit umum. Catatan job ditampilkan di app owner dan teknisi.
- Alamat owner: `addressSnapshot ?? customer.address`; alamat teknisi `/t`: `customer.address` saja,
  termasuk tautan Google Maps. Menulis hanya `addressSnapshot` **tidak mengubah** alamat yang dipakai
  teknisi untuk navigasi.
- Jalur edit alamat Customer sudah ada (`actionUpdateCustomer` + form Pelanggan) dan merupakan data
  master tenant. Jangan menulis Customer.address diam-diam dari form job.
- `JobOrder.price` tidak terlihat/dipakai `/t` dan bukan tagihan.
- `WorkItem` menyimpan asset/service/deskripsi/harga snapshot; invoice memakai snapshot. Unit/service
  tidak termasuk edit umum pada rencana ini.
- `COMPLETED` hanya ditulis `closeWorkSession` melalui penutupan sesi + invoice/proforma atomik.
  `CANCELLED` adalah status terminal lain. Edit umum harus menolak keduanya.

---

## 1. Lima hasil yang disepakati

### Poin 1 — Hilangkan kolom Harga dari Form Pekerjaan Baru
**Tujuan:** mencegah admin mengira kolom ini menetapkan tarif yang benar-benar digunakan.
- Hapus field state/label/input `price` pada `job-form.tsx`; hapus `price` dari payload form dan
  `CreateJobFormInput`/mapping khusus form di `actions.ts` jika tidak punya caller lain.
- Pertahankan `CreateJobInput.price` atau pemakai service lain hanya bila baseline grep membuktikan
  masih digunakan oleh jalur lain. Jangan menghapus `JobOrder.price` dari schema/DB tanpa scope baru.
- Tampilkan tarif dari `/app/layanan` dan override `/app/pelanggan/[id]/harga` tetap di tempatnya.
- Tidak mengubah nilai job lama (termasuk null Effi) atau invoice.

**TDD:** update `tests/reminder-convert.test.ts` dan/atau test actionCreateJob untuk membuktikan
payload tidak lagi mengirim `price`; full grep memastikan pembuat job lain tidak terputus.

### Poin 2 — Perbaiki writer jadwal + guard status server (jalur existing)
- Perbaiki `assignJob` yang sudah dipakai `actionAssignTeam`: ketika menerima jadwal kalender dan window,
  simpan `scheduledDate`, `windowStart`, `windowEnd` dan roster dalam transaksi yang sama.
- Tanggal kalender dikirim eksplisit dari input `YYYY-MM-DD` yang tervalidasi; jangan derive dari
  `toISOString()`/UTC yang dapat bergeser hari.
- Service/action menegakkan job masih DRAFT/ASSIGNED (mengikuti `ASSIGNABLE` UI). Cek ulang status
  dan update dalam transaksi agar tidak hanya bergantung tombol UI.
- Job status ACCEPTED/EN_ROUTE/ARRIVED/IN_PROGRESS/WAITING/COMPLETED/CANCELLED tidak bisa di-reassign
  lewat action ini. Jalur resmi reschedule FSM tidak dibuat dalam scope ini.
- Pertahankan warning bentrok (tidak mengubah warning menjadi hard block), perhitungan durasi, multi
  personel, `roleOnJob` cair, isLead, dan replace-set roster.
- Tanggal kosong/malformed atau anggota kosong → tolak sebelum ada mutasi roster/job.

**TDD:** `tests/assignment.test.ts` (scheduledDate + window konsisten, multi-role tetap utuh, status
terminal/progress ditolak, tenant mismatch, tanggal gagal tidak mutasi). Test action boundary perlu
mengikuti pola test server action yang ada.

### Poin 3 — Edit Catatan pekerjaan sebelum selesai
- Tambahkan **satu** fasilitas edit detail umum (belum ada jalurnya) untuk field `JobOrder.notes` saja
  pada status aktif, dengan satu server action/service tenant-scoped dan validasi panjang server-side.
- Tolak `COMPLETED`, `CANCELLED`, deleted, tenant asing; guard ditegakkan di server walau action dipanggil
  langsung.
- Tidak mengubah catatan Customer, alamat Customer, asset, service, roster, jadwal, status, foto,
  checklist, WorkItem, atau invoice.
- UI edit inline/modal pada halaman detail existing, pakai komponen UI repo; tidak ada halaman/menu baru.

**TDD:** action/service tests untuk owner/admin sukses; technician tidak berwenang; foreign job,
terminal/deleted ditolak; input validasi; hanya notes berubah.

### Poin 4 — Kejelasan jadwal di detail
- Jika `scheduledDate == null`, kartu menampilkan **“Belum terjadwal”**.
- CTA mengarahkan ke panel Tugaskan Tim existing; judul/copy menyebut bahwa panel menyimpan jadwal
  sekaligus roster.
- Tanggal hari ini pada form adalah **saran**, bukan jadwal tersimpan. Sebelum Save, tampilan tidak
  mengklaim sudah terjadwal.
- Tidak mengubah `defaultDate` jadi wajib/kosong tanpa keputusan lain; `actionAssignTeam` tetap mewajibkan
  tanggal sebelum simpan.

**QA:** render copy status null/non-null; klik CTA menuju panel yang sama; mobile+desktop jika browser
runtime dapat diakses.

### Poin 5 — Preview harga khusus di layar teknisi
- Server page `/t/kerja/[customerId]` memuat harga efektif per pasangan customer×service memakai fungsi
  resolver existing (`resolvePrice`) atau service batch setara yang menggunakan aturan resolver tunggal.
- Kirim map harga efektif ke UI sebagai **preview saja**. UI menampilkan harga khusus/standar yang
  berlaku untuk customer tersebut, bukan selalu `standardPrice`.
- Submit tetap hanya `serviceId`, `qty`, roster; server `addWorkItem` tetap memanggil `resolvePrice`
  sendiri dan menyimpan snapshot. Jangan percaya nilai harga dari browser, jangan menerima `unitPrice`
  dari client, dan jangan mengubah snapshot invoice.
- Pertahankan harga hasil submit sebagai source of truth; preview hanyalah UX dan dapat berubah bila
  admin memperbarui pricing sebelum submit.

**TDD:** resolver tests sudah ada (`tests/service-catalog.test.ts`); tambah test untuk loader harga per
customer + test UI/payload memastikan tidak ada `unitPrice` client->server. Pastikan resolver tak membuat
N+1 query bila layanan banyak; pilih batch/service helper hanya bila benchmark/test menunjukkan perlu.

---

## 2. Urutan kerja (TDD, satu slice per langkah)

1. **Baseline read-only:** `git status`, HEAD/origin, cek WIP; baca ulang schema/call sites dan semua
   files kandidat; tidak menimpa/stash perubahan pihak lain.
2. **Poin 2 RED→GREEN:** tes jadwal + guard dulu, lihat gagal, baru ubah writer existing.
3. **Poin 1 RED→GREEN:** tes kontrak create-job form tanpa harga; hapus field UI/payload secara minimal;
   pertahankan backend/schema bila masih ada consumer lain.
4. **Poin 3 RED→GREEN:** tes whitelist notes/status/tenant, baru action/service + inline edit.
5. **Poin 4:** UI status jadwal dan CTA ke panel existing; test copy/behavior.
6. **Poin 5 RED→GREEN:** tes resolver harga customer×service, loader `/t`, payload tanpa harga dari klien;
   implement preview tanpa mengubah server resolver/snapshot.
7. **Cross-layer review:** semua pembaca job di `/app` dan `/t`; cek roster teknisi/kernet dan detail
   teknisi tanpa mengubah assignment rules.
8. Gate: `pnpm exec tsc --noEmit`, `pnpm exec eslint`, `pnpm exec vitest run`, `pnpm run build`.
9. Review diff/secret scan, commit file eksplisit, push, `HEAD==origin/main`.
10. Deploy hanya `bash scripts/deploy-vps.sh`; bila PASS, ikuti aturan AGENTS (berhenti dari verifikasi
    tambahan yang tidak diwajibkan) dan tutup dev server/port 3000.

---

## 3. Tidak disentuh (untuk mencegah regresi)

- `ServiceCatalog.standardPrice`, `CustomerPricing`, `/app/layanan`, `/app/pelanggan/[id]/harga`.
- `resolvePrice` sebagai sumber harga otoritatif server-side.
- WorkItem/InvoiceItem snapshots, `closeWorkSession`, Invoice/Proforma, pembayaran, TOP/tempo, cash
  remittance, insentif, WA.
- Peran cair TECHNICIAN/KERNET, multi-personel, lead, daftar assignment teknisi.
- Customer master address. Poin ini sengaja tidak masuk rencana edit notes saja; alamat Effi harus
  diperbaiki lewat form Customer yang sudah ada (oleh tenant), bukan update DB/job field diam-diam.
- Tidak ada backfill/edit data live Effi oleh agent.
- Tidak menambah FSM reschedule, notification, audit log baru, schema/migration, atau generic edit
  semua kolom pekerjaan.

## 4. Hal yang masih perlu keputusan (hanya jika fakta/code belum menetapkan)

1. **Poin 1 — penghapusan `JobOrder.price` dari backend/schema:** rencana ini hanya menghapus field dari
   form Pekerjaan Baru; mempertahankan schema/kolom dan consumer lain sampai audit ulang membuktikan
   kolom benar-benar dapat dihapus. Tidak perlu keputusan bisnis untuk penghapusan UI.
2. **Catatan yang sudah ada boleh dikosongkan?** Konvensi existing customer/asset memakai optional
   string dan `?? null`; usulan mengikuti itu (kosong = null). Jika Anda tidak setuju, baru perlu
   keputusan. Alamat tidak diedit di fasilitas edit ini.
3. **Harga preview di teknisi:** ini tidak mengubah aturan biaya, hanya menampilkan nilai resolver
   yang sama sebelum submit. Bila UI ingin menyembunyikan preview, itu keputusan UX opsional; tidak
   menghalangi kebenaran invoice.

## 5. Verifikasi yang jujur

- Kode & DB query dapat diverifikasi lokal read-only (repo menyatakan DB lokal memakai Supabase pooler
  yang sama dengan produksi; tetap cek sumber env tanpa mencetak nilai).
- Browser harness belum tersambung ke Chrome Windows yang login; CDP port Chrome tidak terbuka saat
  audit. Unit/integration/build tetap bisa diuji, tetapi screenshot visual live harus ditandai
  BELUM DIVERIFIKASI sampai browser benar-benar terhubung. Jangan mengetes PIN/hash atau memalsukan sesi.
- Tidak ada mutasi data tenant live oleh agent. Job Effi baru berubah bila owner/admin sendiri memakai
  UI resmi setelah deploy.

## Status

Lima poin sudah dicakup oleh rencana ini. Yang memerlukan kesepakatan bisnis tambahan hanya bila
implementasi menemukan kontrak yang memang belum didefinisikan; jangan mengubah alur biaya yang sudah
berjalan. Rencana belum dieksekusi.
