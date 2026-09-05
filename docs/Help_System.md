# Help System Aircon (Bantuan & Panduan) — SSOT

Sistem bantuan dalam-aplikasi: tombol ? kontekstual tiap layar + Pusat Panduan lengkap.
Tujuan: pengguna awam (tukang AC) bisa memakai aplikasi tanpa pelatihan. Panduan WAJIB akurat
terhadap layar nyata — panduan salah = pengguna kecewa.

## Arsitektur (satu sumber kebenaran)
- `src/lib/help/help-types.ts` — tipe `HelpTopic` (key, title, whatIsIt, steps, tips, faqs, group, audience, order).
- `src/lib/help/content-owner.ts` — konten panel usaha (audiens `owner`).
- `src/lib/help/content-tech.ts` — konten aplikasi teknisi (audiens `tech`).
- `src/lib/help/content-admin.ts` — konten panel admin platform (audiens `admin`).
- `src/lib/help/help-content.ts` — GABUNG semua jadi registry `HELP_TOPICS` + fungsi:
  getHelpTopic(key), getHelpTopicsByAudience, groupHelpTopics(audience), GROUP_ORDER.

Konten DIBACA oleh dua konsumen dari sumber yang SAMA (nol duplikasi):
1. `src/components/help/help-button.tsx` — tombol ? + Sheet (4-bagian: Apa ini / Cara pakai / Tips / FAQ).
2. Pusat Panduan: `/app/panduan` (owner) & `/admin/panduan` (admin) via `guide-center.tsx` (pencarian + grup).

## Cara memasang tombol ? di layar
- Layar yang memakai `AppHeader`: cukup tambah prop `helpKey="<key>"`. HelpButton muncul otomatis.
  Contoh: `<AppHeader title="Pelanggan" helpKey="pelanggan" />`.
- Layar dengan header khusus (mis. /app/pekerjaan/baru, /app/pekerjaan/[id], /t): pasang manual
  `<HelpButton topic={getHelpTopic("<key>")} />` di header.

## Konvensi key
- Panel usaha: nama route (mis. `pelanggan`, `pekerjaan-baru`, `wa-connect`).
- Teknisi: prefiks `t-` (mis. `t-beranda`).
- Admin: prefiks `admin-` (mis. `admin-kupon`).

## Kelompok (GROUP_ORDER)
Mulai di sini → Mengelola Pekerjaan → Otomatisasi → Keuangan & Langganan → Pengaturan Usaha →
Untuk Teknisi → Administrasi Platform.

## ATURAN AKURASI (wajib)
1. Sebelum menulis `steps`, BACA kode layar terkait; label tombol & alur HARUS sama persis.
2. Saat UI layar berubah (label/alur), UPDATE konten help-nya di file yang sama.
3. Setiap `helpKey` yang dipakai di page HARUS punya entri konten (cek: bandingkan helpKey vs key terdaftar).
4. Jangan mengarang fitur yang tidak ada.

## Migrasi ke DB (configurable admin) — masa depan
Bila teks perlu diedit admin tanpa deploy: ganti implementasi fungsi di help-content.ts (getHelpTopic dll)
dari membaca array statis → query DB (mis. tabel HelpTopic). Komponen konsumen TIDAK berubah.
Untuk pilot, konten di kode sudah memadai (teks jarang berubah).

## Cakupan saat ini
35 topik: 21 panel usaha (semua layar /app utama), 3 teknisi (/t), 11 admin (/admin).
Verifikasi: tsc 0, build 0, semua helpKey punya konten (nol sheet kosong).
