# Aircon — Strategi Go-to-Market & ROI Investasi (VPS + Domain + S3 BiznetGio)

> Tujuan tunggal: memastikan investasi infrastruktur Anda balik modal dan Aircon
> menghasilkan keuntungan berulang bagi Lumite. Dokumen ini jujur, bukan motivasional.

## 1. Realita: produk lengkap ≠ produk laku
Mesin teknis Aircon sudah world-class & live. Tapi yang menentukan uang masuk adalah
**distribusi + bukti nilai + retensi** — bukan jumlah fitur. Uang investasi Anda kecil
(VPS/domain/S3 ~ratusan ribu/bulan), jadi risikonya bukan "boros", melainkan **"sepi
pengguna"**. Fokus semua energi ke akuisisi & aktivasi, bukan menambah fitur.

## 2. Siapa yang membayar (dan berapa)
| Segmen | Pain utama | Paket | Peran |
|---|---|---|---|
| Teknisi/usaha perorangan (1 org) | Tak terlihat profesional, lupa jadwal, order tercecer | Trial → Professional 149k | **Pintu masuk & mesin viral** |
| Usaha kecil (2–5 teknisi) | Koordinasi teknisi, job hilang, tak ada kontrol | **Professional 149k** | **Sumber pendapatan utama** |
| Perusahaan (>5 teknisi) | Skala, laporan, akuntabilitas | **Business 499k** | **Marjin tertinggi** |

Insight: **jangan jual ke semua sama rata.** Perorangan dipikat dengan halaman booking
gratis (murah/viral). Yang benar-benar bayar & bertahan = usaha dengan >1 teknisi yang
merasakan pain koordinasi. Arahkan energi penjualan ke sana.

## 3. Economic hook (kenapa mereka bayar) — sudah tertanam di landing
- **1 servis ulang/bulan menutup biaya langganan.** Ini argumen ROI paling kuat untuk
  tukang AC. Money loop (pengingat WA otomatis) = fitur yang *menghasilkan* biaya
  langganannya sendiri.
- **Halaman booking = gengsi + order.** Tukang solo terlihat seperti perusahaan.
- **IoT = pembeda premium**, bukan pembuka. Jangan memimpin dengan IoT (bikin ragu &
  mahal di benak). Pimpin dengan "usaha lebih ramai & rapi".

## 4. Aktivasi: 5 menit pertama menentukan retensi
Pengguna baru harus merasakan "menang" sebelum keluar. Wajib ada:
1. **Onboarding → langsung lihat halaman booking sendiri** ("ini punyamu, bagikan!").
2. **Contoh data / quick win**: minimal 1 CTA "Bagikan halaman booking ke WhatsApp".
3. **Kosong itu musuh**: setiap layar kosong harus punya 1 aksi jelas (sudah sebagian).

## 5. Distribusi (ini yang bikin investasi balik) — tugas Anda, bukan kode
Aplikasi tak menjual dirinya sendiri. Urutan channel paling murah→efektif untuk Indonesia:
1. **Grup WhatsApp/Facebook komunitas teknisi AC & HVAC.** Tawarkan trial + bantu setup.
2. **Loop viral halaman booking**: tiap pelanggan tenant melihat "Ditenagai Aircon"
   (sudah jadi link). Makin banyak tenant, makin banyak exposure gratis.
3. **Demo langsung 1-on-1** ke usaha 2–5 teknisi (closing tertinggi). Rp499k/bln remeh
   dibanding 1 teknisi yang salah jadwal.
4. **Google Maps / marketplace jasa**: dorong tenant pasang link booking di profil.

## 6. Domain BiznetGio — rekomendasi
- Beli **aircon.id** atau **.co.id** (brand utama) DAN arahkan ke Vercel.
- Untuk halaman booking tenant: subdomain/path `usaha.aircon.id/nama` (lebih meyakinkan
  daripada vercel.app). Ini menaikkan trust halaman booking = konversi order tenant.

## 7. S3 BiznetGio — sudah siap
Kode `src/lib/storage/s3.ts` env-driven. Isi 5 env (endpoint, region, bucket, key,
secret) → foto bukti kerja langsung aktif. Foto bukti = fitur retensi (pelanggan &
pemilik percaya kerja beres) → mengurangi churn.

## 8. VPS BiznetGio — urutan aktivasi hemat
Jalankan `infra/vps-provision.sh` HANYA setelah ada ≥3 tenant aktif memakai WA/IoT.
Sebelum itu, money loop tetap jalan (pesan masuk antrean; worker tinggal dinyalakan).
Disiplin: bayar VPS saat sudah ada yang memakainya, bukan sebelum.

## 9. Metrik yang harus Anda pantau (bukan vanity)
- **Activation rate**: % pendaftar yang buat ≥1 pekerjaan / bagikan booking (target >40%).
- **Trial→Paid**: % trial jadi bayar (target >15% untuk B2B tools).
- **Retensi bulan-2**: % tenant bayar yang lanjut (money loop harus menahan ini).
- **Reminder terkirim → job berulang**: bukti money loop menghasilkan uang tenant.
Dashboard admin (`/admin`) sudah menyimpan datanya; tambahkan panel metrik saat perlu.

## 10. Risiko terbesar & mitigasi
| Risiko | Mitigasi |
|---|---|
| Sepi pengguna | Distribusi manual dulu (grup teknisi, demo 1-on-1). Jangan tunggu organik. |
| WA worker kena ban | Sudah pakai throttle manusiawi (wa-worker). Mulai volume kecil. |
| Tenant coba lalu pergi | Aktivasi 5-menit + halaman booking sebagai quick win. |
| Bakar biaya sebelum ada user | Nyalakan VPS/S3 hanya saat ada tenant nyata. |

## Ringkas: 3 hal yang benar-benar menentukan
1. **Halaman booking gratis** menarik perorangan (murah, viral).
2. **Money loop** membuat langganan membayar dirinya sendiri (retensi).
3. **Demo 1-on-1 ke usaha 2–5 teknisi** = pendapatan nyata (distribusi).
Fokus ke 3 ini; sisanya sudah siap.
