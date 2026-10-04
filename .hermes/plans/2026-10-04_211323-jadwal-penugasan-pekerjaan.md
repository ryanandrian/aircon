# Usulan Perbaikan Jadwal Pekerjaan — Rencana Revisi

> Status: rencana saja, belum ada perubahan kode maupun data tenant.
> Prinsip: pakai jalur yang ada bila memadai; jalur baru hanya jika audit membuktikan jalur
> lama tidak bisa memenuhi kebutuhan. Tidak ada direct DB/backdoor untuk mengubah data tenant.

## Fakta yang sudah diverifikasi (code + DB live, 2026-10-04)

1. Job Effi `cmutvpoa80001jpiubeq2kr83`: `ASSIGNED`, `scheduledDate=NULL`,
   `windowStart=2026-10-04T02:00Z`, `windowEnd=03:00Z`, ada 2 `JobAssignment` (1 TECHNICIAN
   lead + 1 KERNET), `price=NULL`, `addressSnapshot=NULL`, `customer.address=NULL`.
2. `owner-actions.tsx` sudah memiliki input Tanggal/Jam/Durasi dan tombol cek bentrok + simpan.
   Panel dibuka dari tombol **Tugaskan Tim**. Default: tanggal hari ini, jam 09:00, durasi 60.
3. `actionAssignTeam` memanggil `assignJob` dengan window, lalu mencoba transisi DRAFT→ASSIGNED.
   UI detail mengizinkan assign untuk status DRAFT/ASSIGNED.
4. `assignment-service.assignJob` menyimpan roster + `technicianId=lead` + `windowStart/windowEnd`,
   tetapi tidak menyimpan `scheduledDate`.
5. Audit repo: tidak ada action/form terpisah untuk `update schedule`, `reschedule`, atau
   `set schedule`. Hanya form Pekerjaan Baru dan panel Tugaskan Tim yang menginput jadwal.
6. Data live: 78 job; 21 aktif; hanya Effi yang aktif dengan `windowStart` terisi tetapi
   `scheduledDate` null. 20 aktif lain punya `scheduledDate` terisi (window null).
7. Pembaca penting: agenda, dashboard hari ini, `listJobs` pakai `scheduledDate`; halaman `/t`
   memakai `windowStart`; cek bentrok memakai window. Karena itu kedua representasi harus konsisten.
8. Form Pekerjaan Baru memang mengizinkan simpan tanpa jadwal (Tanggal opsional) dan teknisi
   opsional. Itu menghasilkan job belum terjadwal; desain ini jangan diubah tanpa keputusan
   bisnis eksplisit.
9. Harga/alamat berbeda masalah: harga job null; katalog standar baru dipakai saat baris layanan
   dibuat dalam work session; alamat Effi tidak ada di job maupun customer. Tidak dimasukkan dalam
   scope usulan ini.

## Keputusan desain yang saya usulkan

### Usulan utama — perbaiki jalur penugasan yang sudah ada, jangan tambah jalur baru

1. Di `assignment-service.assignJob`, bila parameter `window` diberikan, tulis `scheduledDate`
   dan `windowStart/windowEnd` bersamaan dalam transaksi yang sama dengan roster.
   `scheduledDate` diset dari tanggal lokal `scheduledDate` yang dikirim action, bukan mengekstrak
   hari dari UTC `window.start` (menghindari pergeseran tanggal timezone).
2. Agar pilihan tanggal tidak hilang di service layer, ubah signature helper penugasan yang sudah
   ada menjadi membawa nilai tanggal eksplisit selain window — atau bentuk `Date` lokal yang
   dijamin konsisten dari action — setelah baca ulang semua call sites. Jangan membuat action/API
   penjadwalan baru.
3. Ubah panel yang sama (bukan komponen/jalur baru) supaya judul dan instruksi jelas: **“Jadwal &
   Tim Pekerjaan”**, status saat ini (mis. “Belum terjadwal”), dan teks bahwa tanggal default hari ini
   hanyalah saran sampai tombol simpan ditekan. Tombol bisa berbunyi **“Simpan Jadwal & Tim”**.
   Tetap gunakan input tanggal, jam, durasi, cek bentrok, dan satu `actionAssignTeam`.
4. Jangan mengganti peran cair. Daftar anggota tetap semua staf aktif; setiap orang tetap dapat
   dipilih sebagai TECHNICIAN atau KERNET per job, lead tetap dipertahankan.
5. Jangan membuat tanggal wajib di form baru menjadi wajib tanpa permintaan bisnis terpisah; job
   tanpa jadwal tetap sah dan harus terlihat sebagai belum terjadwal.

### Data Effi — tidak ada backfill manual

- Jangan melakukan UPDATE DB langsung.
- Setelah code deploy, operator membuka detail Effi → panel yang sama “Jadwal & Tim Pekerjaan”
  → memeriksa/menetapkan tanggal dan jam sebenarnya → simpan lewat action resmi.
- Dengan demikian tanggal historis yang tersimpan berasal dari keputusan UI/otorisasi tenant,
  bukan dari dugaan bahwa `windowStart` lama adalah jadwal bisnis yang dimaksud.
- Catatan: panel sekarang otomatis menawarkan hari ini dan jam 09:00. Sebelum menyimpan, UI revisi
  harus membuat status “Belum terjadwal” terlihat dan nilai saran terlihat jelas. User memilih tanggal
  aktual Effi; agent tidak menebak atau menyimpan atas nama tenant.

## Rencana kerja bertahap (TDD)

### Tahap 0 — baseline & scope guard
- Pastikan `git status`, HEAD/origin, tidak ada WIP milik user lain; baca ulang schema, semua
  pemanggil `assignJob`, semua reader tanggal/window, tests, dan docs yang akan disentuh.
- Tidak boleh ada perubahan DB data tenant, migrasi schema, perubahan harga/alamat, atau perubahan
  peran/permission.

### Tahap 1 — regression test penulis jadwal
- Perluas `tests/assignment.test.ts` mock callback transaction agar menangkap `jobOrder.update.data`.
- Test merah: ketika tanggal+window diberikan, update mencakup `scheduledDate` persis tanggal yang
  dikirim serta `windowStart/windowEnd`, assignment multi-personel/peran cair tetap sama.
- Test merah tambahan: tanpa window, fungsi tidak menghapus/mengosongkan jadwal existing secara tak
  sengaja; perilaku saat ini diverifikasi dulu dan assertion harus mencerminkan kontrak yang dipilih.
- Implementasi minimal di `assignment-service.assignJob`; semua penulisan jadwal tetap atomik dengan
  roster (satu callback transaction).
- Test jalur `actionAssignTeam`: tanggal dari string form sampai service tetap sama dan validasi
  tanggal wajib tidak berubah.

### Tahap 2 — kejelasan panel yang sama
- Di `owner-actions.tsx` tampilkan “Belum terjadwal” berdasarkan `scheduledDate` saat ini, bedakan
  nilai default tanggal dari jadwal tersimpan, dan ubah copy/tombol agar fungsi panel mudah ditemukan.
- Di `[id]/page.tsx` hubungkan ringkasan jadwal ke panel yang sama bila memang dapat dilakukan tanpa
  menciptakan jalur/duplikasi.
- Tidak mengubah input cek bentrok, perhitungan durasi, identitas lead, daftar anggota, atau status
  assignment.
- Test/QA memastikan default yang belum disimpan tidak mengubah DB dan tombol simpan tetap perlu
  tindakan eksplisit.

### Tahap 3 — review lintas pembaca (tanpa data mutation)
- Unit-test/query-test memastikan setelah assign, row memiliki tanggal + window konsisten.
- Verifikasi agenda menempatkan job pada periode tanggal itu, bukan “Belum terjadwal”.
- Verifikasi dashboard hari ini mengikuti tanggal yang disimpan.
- Verifikasi halaman teknisi masih memakai windowStart dan roster assignment, termasuk kernet.
- Verifikasi detectConflict memakai window dan mengecualikan job yang sedang diedit.
- Runtime proof hanya dengan fixture/test tenant yang disetujui atau test DB; jangan mengubah job
  live Effi sebagai bagian automated test.

### Tahap 4 — gate, commit, deploy
- `pnpm exec tsc --noEmit`, `pnpm exec eslint`, `pnpm exec vitest run`, `pnpm run build` semua PASS.
- Review `git diff`/status: file relevan saja; tidak ada secret/temp/data update.
- Commit daftar file eksplisit → push → pastikan HEAD==origin/main.
- Deploy hanya `bash scripts/deploy-vps.sh` sesuai AGENTS.md + skill deploy; jika PASS, berhenti dari
  pemeriksaan tambahan yang dilarang AGENTS.md.
- Dev server ditutup, port 3000 harus FREE.

### Tahap 5 — perbaiki Effi lewat UI resmi (oleh pemilik/tenant)
- Setelah deploy, user/tenant membuka job Effi di detail.
- Verifikasi status lama “Belum terjadwal”, pilih tanggal/jam yang benar berdasarkan keputusan
  operasional tenant (bukan nilai tebakan), pertahankan tim bila masih benar, simpan.
- Baca ulang hasil melalui UI/API resmi yang tenant-scoped. Tidak ada SQL/direct Prisma write.

## File kandidat (baru setelah baseline audit ulang)
- `src/lib/services/assignment-service.ts`
- `src/app/app/pekerjaan/actions.ts` (hanya bila tanggal perlu diteruskan eksplisit)
- `src/app/app/pekerjaan/[id]/owner-actions.tsx`
- `src/app/app/pekerjaan/[id]/page.tsx`
- `tests/assignment.test.ts` (+ test action bila pola test tersedia)
- docs/SSOT terkait jadwal, bila memang dokumennya authoritative.

## Risiko & pagar pengaman

- **Zona waktu:** jangan derive tanggal bisnis dari `Date.toISOString().slice(0,10)` karena dapat
  menggeser hari. Gunakan input tanggal lokal tervalidasi sebagai tanggal bisnis, lalu gabungkan
  tanggal+jam sesuai helper `toDate` yang sudah ada.
- **Reassignment:** action juga dipakai untuk job ASSIGNED; pastikan tanggal baru menggantikan
  `scheduledDate` dan window secara bersamaan. Job status lanjut tidak ditampilkan tombol assign;
  jangan memperluas guard tanpa audit kebutuhan.
- **Roster:** assignment adalah replace-set; UI mengirim seluruh tim saat save. Test menjaga peran,
  lead, dan jumlah anggota agar tidak hilang saat hanya mengubah jadwal.
- **Default tanggal:** default hari ini bukan fakta jadwal tersimpan. Jangan membuat UI tampak seolah
  sudah terjadwal sebelum submit.
- **No direct DB update:** hanya user/tenant melalui action yang ada boleh menetapkan tanggal aktual
  untuk Effi.
- **Harga/alamat:** di luar usulan ini; jangan mengisi otomatis atau menebak.

## Open question untuk persetujuan implementasi

Saya mengusulkan tanpa jalur baru: memperbaiki writer yang sudah ada (`actionAssignTeam` →
`assignment-service.assignJob`) dan memperjelas panel yang sama. Apakah Anda menyetujui usulan ini?
Jika setuju, implementasi akan dimulai dengan Tahap 0 + regression test sebelum perubahan kode.
