# Checklist Servis Aircon — STATUS IMPLEMENTASI AKTIF

**Terakhir diverifikasi: 2026-10-03 · Commit live: `ff1aade4a335df7cc7a8ef43ca311f93b87aa78a`**

Dokumen ini adalah pointer/status checklist aktif, **bukan** catatan umum proyek. Untuk panduan SSOT,
cek tiga poin berikut sebelum mengerjakan checklist:

1. **Implementasi aktif (kode sumber):** `src/app/app/checklist/`, `src/app/t/kerja/`,
   `src/lib/services/checklist-template-service.ts`, `worksession-service.ts`,
   `job-work-service.ts`, dan `prisma/schema.prisma`.
2. **Riwayat gap/keputusan/tes:** `.hermes/plans/2026-10-03_checklist-service-alignment.md` adalah execution
   log sesi lokal dan mungkin tidak ikut repository. Bukan sumber status deploy jika berbeda dengan Git/VPS.
3. **Aturan aktif tertulis:** cari section berlabel “aturan aktif” atau “status runtime” dalam BuildSpec Part1–3,
   `ALUR_APLIKASI.md`, dan dokumen checklist ini. Setiap bagian yang berlabel ARSIP HISTORIS bukan instruksi.

## Perilaku aktif yang dibuktikan kode

- Tenant membuat checklist **opsional per layanan** (`ChecklistTemplate.serviceId`); tidak ada checklist default.
- Jawaban melekat pada WorkItem (`ChecklistResult.workItemId`), jadi per layanan×unit.
- Teknisi/kernet mengisi checklist bertahap pada layar `Catat Pekerjaan` (`/t/kerja/[customerId]`) melalui
  server actions `actionGetItemChecklist`, `actionSetItemChecklist`, dan `actionCloseWorkSession`.
  Tipe foto bukan teks: file input accept-image/capture-environment memanggil `techUploadPhoto`; URL
  disimpan sebagai hasil checklist setelah uploader S3 yang ada mengembalikan public URL.
- Batas klaim finalisasi: untuk sesi ber-`jobId`, `closeWorkSession` menyelesaikan JobOrder dan efek turunannya
  dalam transaksi dokumen/sesi; bila `jobId=null`, kode hanya menyelesaikan WorkSession/dokumen tanpa JobOrder
  status/reminder/review. Belum ada keputusan produk untuk jalur null itu. Server gate foto tidak menerima
  foto checklist tanpa jobId.
- `transitionJob(COMPLETED)` ditolak; transisi umum tidak lagi menyelesaikan pekerjaan.
- Schema/migrasi live sudah up-to-date; data legacy nullable-anchor dibersihkan oleh migrasi (baris yang dihapus
  teridentifikasi sebagai demo/test pada snapshot sebelum migrasi).

## Bukti release & quality gates

- Deploy script resmi: PASS `ff1aade4a335df7cc7a8ef43ca311f93b87aa78a`; service aktif; `/` + `/login` HTTP 200.
- Database: 51 migrasi up-to-date.
- Gate pada kode release: TSC 0, ESLint 0, 523 tes / 58 file lulus, build 0.
- **BELUM DIVERIFIKASI:** pengguna menekan kamera pada HP fisik dan objek foto nyata dapat diunggah/dibaca
  di S3. `capture="environment"` dan konfigurasi S3 saja bukan bukti tes perangkat/object.

## Catatan keterbatasan yang tidak boleh dihapus dari laporan

Rute kerja masih menerima sesi `jobId=null` di tingkat service. Query produksi sebelum migrasi menemukan 0/53
sesi tanpa jobId, tetapi itu tidak membuktikan semua kemungkinan route/operasi bisnis aman; audit lanjut diperlukan
sebelum mengubah perilaku tersebut. Pengecekan role actions/sesi juga perlu diaudit terpisah bila scope keamanan
 diperluas.

## Arsip

`docs/PLAN_Checklist_PerLayananUnit.md` menyimpan arsip rencana lama 2026-09 setelah section “PENETAPAN & STATUS
AKTIF”; materi di bawah header ARSIP HISTORIS bukan keadaan sekarang. `BuildSpecPack_Part1_DataSchema_and_API.md`
juga menyimpan tabel/schema/API era awal di bawah penanda arsip; schema otoritatif tetap `prisma/schema.prisma`.
