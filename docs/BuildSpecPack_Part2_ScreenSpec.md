# AC SERVICE GROWTH OS — BUILD SPEC PACK

## Part 2 of 3: SCREEN-BY-SCREEN UX SPEC (mobile-first)

**Tujuan:** menghapus ambiguitas UI — inilah yang menentukan aplikasi DIPAKAI atau tidak, dan area di mana AI paling sering menebak salah. Spesifikasi ini mengunci: layar apa saja, isi tiap layar, aksi utama, dan alur antar layar per persona. Prinsip: HP dulu; aksi utama 1-tap, bisa 1 tangan; jangan lawan kebiasaan (WA tetap channel).

Notasi: [Btn] tombol, {field} input, →layar tujuan navigasi.

---

# 0. NAVIGASI GLOBAL (mobile bottom-nav)

**Technician** (paling sederhana — 2 tab):
`Hari Ini` · `Profil`

**Owner/Admin** (5 tab):
`Beranda` · `Jadwal` · `Job` · `Customer` · `Lainnya`
(`Lainnya` memuat: Growth, Repeat/Reminder, Performa, IoT, Pengaturan, Billing)

Aturan: teknisi tidak pernah melihat menu owner. Role menentukan nav yang di-render.

---

# 1. ALUR TEKNISI (persona paling kritikal — dipakai tiap hari di lapangan)

## S-T1 · Hari Ini (home teknisi)
- Header: tanggal + nama + indikator sinkron ("Tersinkron" / "n menunggu").
- Daftar job hari ini, urut waktu. Tiap kartu: jam window, nama customer, alamat singkat, jenis service, **badge status** berwarna, unit AC.
- Kartu 1-tap → S-T2.
- Empty state: "Belum ada pekerjaan hari ini."
- Offline: kartu tetap tampil dari cache; badge "offline".

## S-T2 · Detail Job
- Info: customer + [Telepon][WhatsApp], alamat + [Navigasi] (buka Google/Waze), unit AC (brand/model/PK/ruangan + riwayat singkat), jenis service, catatan.
- **Tombol aksi status besar** (berubah sesuai state machine), 1-tap:
  - ACCEPTED → [Terima]
  - [Berangkat] (EN_ROUTE) → [Sampai] (ARRIVED) → [Mulai Kerja] (IN_PROGRESS)
  - saat IN_PROGRESS: [Jeda] (WAITING, minta alasan) · [Selesai] (→S-T3)
- Setiap tap: optimistik update + masuk antrian sync bila offline.

## S-T3 · Selesaikan Job (gate COMPLETED)
- **Checklist** (dari template jenis service): item wajib ditandai jelas; tak bisa selesai bila wajib belum lengkap.
- **Foto**: [Ambil Before]/[Ambil After] (kamera langsung, auto-kompres). Foto after wajib bila template minta.
- {Catatan hasil}, {Harga} (opsional, bila teknisi diizinkan).
- [Selesaikan] → validasi guard → COMPLETED → toast "Job selesai. Pengingat servis berikutnya otomatis dibuat." → kembali S-T1.

## S-T4 · Profil teknisi
- Nama, kontak, skill (read), ringkasan performa (job selesai minggu ini, on-time%). [Keluar].

---

# 2. ALUR OWNER/ADMIN

## S-O1 · Beranda (kontrol harian owner)
- Ringkasan hari: job hari ini (total/selesai/berjalan), teknisi aktif, **alert perlu perhatian** (konflik jadwal, re-plan menunggu approval, alert IoT).
- **Live progress**: daftar job berjalan + status real-time per teknisi.
- Kartu "Pengingat jatuh tempo (n)" → S-O7. Kartu "Lead perlu follow-up (n)" → S-O6.
- Shortcut [+ Job Baru] → S-O3.

## S-O2 · Jadwal (Smart Scheduling)
- Tampilan hari, kolom/timeline per teknisi. Blok job berwarna sesuai **feasibility**: hijau FEASIBLE, kuning RISK, merah CONFLICT, abu UNKNOWN.
- Tap blok → detail + alasan feasibility ("mepet travel 5 mnt", "skill tak cocok", "lokasi customer belum ada").
- Drag/assign job → panggil feasibility live; bila CONFLICT: dialog "Tidak disarankan — [Lihat alternatif] / [Paksa dengan alasan]". Tidak auto-assign paksa.
- Banner bila ada re-plan menunggu: [Tinjau perubahan] → S-O2b.

## S-O2b · Tinjau Re-plan (approval)
- Daftar job terdampak + ETA baru + proposal (reschedule/pindah teknisi/geser).
- Per proposal: [Setujui] (→ update + antrian notif customer) / [Tolak].
- Sebelum approve, customer TIDAK dinotifikasi.

## S-O3 · Buat/Edit Job
- {Customer} (cari/pilih/+baru), {Unit AC} (opsional, dari asset customer), {Jenis service}, {Teknisi}, {Tanggal}+{Window}, {Estimasi durasi}, {Harga}, {Catatan}.
- Saat teknisi+waktu dipilih → **indikator feasibility live** muncul (hijau/kuning/merah + alasan).
- [Simpan Draft] / [Assign] (assign tervalidasi feasibility).

## S-O4 · Daftar Job
- Filter: status, teknisi, tanggal, customer. Kartu ringkas → detail (versi owner dari S-T2 + tombol edit/cancel/reschedule).

## S-O5 · Customer & Asset
- Daftar customer (cari nama/HP/area/source). Detail customer: kontak, source, **timeline service** (semua job lintas asset), daftar unit AC.
- Detail asset: brand/model/PK/ruangan/serial, riwayat service, **next service date**, status device IoT (bila ada). [Buat Job dari sini].

## S-O6 · Growth (Get the Job)
- Tab Lead: daftar + status (NEW..WON/LOST), [+ Lead], follow-up jatuh tempo ditandai; aksi [WhatsApp follow-up] (template), [Konversi → Customer/Job].
- Tab Referral: catat referrer→referred.
- Tab Review: job selesai → [Minta review via WA].
- Tab Campaign: buat campaign (nama, segmen, template) → daftar penerima → [Kirim via WA] per penerima (assisted).

## S-O7 · Pengingat & Repeat (Money Loop — layar terpenting)
- Daftar reminder jatuh tempo: customer, unit AC, tgl servis terakhir, due date.
- Per baris 2 aksi 1-tap: **[Kirim WA]** (template reminder terisi) · **[Buat Repeat Job]** (prefill dari job lama → S-O3).
- Badge konversi: berapa reminder → repeat job (memberi rasa "ini menghasilkan uang").

## S-O8 · Performa (Know the Numbers)
- Kartu ringkas: total job, selesai, revenue, on-time%, completion%, repeat customer, **repeat uplift %**.
- Breakdown source→revenue (channel mana menghasilkan uang). Filter periode + per teknisi. Grafik sederhana, bukan BI rumit.

## S-O9 · IoT (AC Sells Itself)
- Tab Alert (utama, paling atas): daftar alert terbuka (jenis, unit, customer) → **[Buat Job dari Alert]** (1-tap, source=IOT).
- Tab Device: daftar device (online/offline, health), [+ Pair Device] (scan QR → pilih asset).
- Detail device: telemetry ringkas (suhu/arus/status), kontrol remote: [On/Off][Mode][Suhu] → tampilkan **status Command→Verify**: "Terkirim → Diterima → Terkonfirmasi". JANGAN tampilkan "berhasil" sebelum Terkonfirmasi; bila hanya diterima: "Terkirim, menunggu konfirmasi".

## S-O10 · Pengaturan & Billing
- Usaha: nama, jam kerja, area, buffer, interval maintenance default, lead time reminder.
- Tim: daftar user, [Undang teknisi] (link WA), atur role.
- Template WA: edit template (reminder/reschedule/review/follow-up/campaign) dgn placeholder.
- Checklist: edit item per jenis service.
- Billing: paket aktif (Starter/Growth/Pro), status, [Hubungi kami untuk upgrade] (v1.0 manual).

---

# 3. ALUR ONBOARDING (owner pertama kali)

## S-N1 · Daftar → S-N2 OTP → S-N3 Setup usaha (nama, jam kerja, area) → S-N4 Tambah teknisi pertama (opsional, kirim link WA) → S-N5 selesai → S-O1.
Target < 10 menit, semua dari HP. Opsi [Isi data contoh] untuk demo (bisa dihapus 1-tap).

---

# 4. KOMPONEN & POLA LINTAS-LAYAR (kunci konsistensi)

- **Badge status job**: peta warna tetap — ASSIGNED biru, ACCEPTED/EN_ROUTE/ARRIVED/IN_PROGRESS gradasi hijau, WAITING kuning, COMPLETED hijau tua, CANCELLED abu, RESCHEDULED oranye.
- **Feasibility chip**: FEASIBLE hijau, RISK kuning, CONFLICT merah, UNKNOWN abu — dipakai identik di S-O2, S-O3.
- **Tombol WA**: konsisten (ikon WA + "Kirim via WhatsApp"), selalu membuka wa.me dgn teks terisi, selalu mencatat MessageLog.
- **Command→Verify indicator**: komponen 3-langkah dipakai di semua kontrol IoT.
- **Sync badge** (teknisi): status antrian offline selalu terlihat.
- **Empty states** ramah + 1 aksi utama di tiap daftar.

---

# 5. PRINSIP UX YANG TIDAK BOLEH DILANGGAR
1. Teknisi: alur harian = maksimal beberapa tap, tanpa mengetik banyak, jalan offline.
2. Aksi menghasilkan uang (buat job, kirim reminder, repeat, buat job dari alert) selalu 1-tap dan menonjol.
3. Tidak ada layar yang mengklaim kepastian tanpa bukti (feasibility & Command→Verify).
4. WA tidak digantikan — selalu jadi tombol keluar untuk komunikasi.
5. Bahasa Indonesia, istilah usaha AC sehari-hari, bukan jargon software.

---

**Lanjut ke Part 3: Business Rules & Default Values.**
