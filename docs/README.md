# Dokumentasi Aircon — Indeks & Aturan SSOT

> **Prinsip (wajib):** SSOT sejati = **kode + kenyataan produksi**. Dokumen adalah CERMINAN, bukan sumber.
> Bila dokumen ≠ kenyataan, **kenyataan menang** dan dokumen itu bug yang harus diperbaiki di commit yang sama.
> Untuk fakta yang berubah (hosting, payment gateway, service, TLS), JANGAN percaya tulisan tangan —
> jalankan **`bash scripts/ssot-status.sh`** (read-only) untuk fakta terverifikasi.

> Terakhir dirapikan: 18 September 2026.

---

## 🟢 DOKUMEN HIDUP (living — WAJIB sinkron dengan kenyataan)
Perbarui SETIAP kali kode/infra berubah. Ini yang boleh dipakai untuk mengambil keputusan.

| Dokumen | Fakta kanonik yang dipegang |
|---|---|
| `PROJECT_STATUS.md` | Status keseluruhan: apa yang live, apa yang belum. **Titik baca pertama.** |
| `PETA_APLIKASI_LIVE.md` | Peta URL & arsitektur live (domain, VPS, peran login). |
| `Security_Model.md` | Model keamanan/otorisasi. **Dirujuk kode** (`src/lib/auth/*`). |
| `BuildSpecPack_Part1_DataSchema_and_API.md` | Skema data & kontrak API. **Dirujuk kode** (`src/lib/domain/job-state-machine.ts`). |
| `BuildSpecPack_Part3_BusinessRules_and_Defaults.md` | Aturan bisnis & default. **Dirujuk kode** (`src/lib/domain/defaults.ts`). |
| `Ipaymu_Integration_Spec.md` | Kontrak payment iPaymu aktif: redirect, callback, signature, status, dan reconcile. |
| `Ipaymu_Production_Runbook.md` | Runbook konfigurasi, verifikasi, cutover, dan rollback iPaymu. |
| `ALUR_APLIKASI.md` | Alur pengguna end-to-end. |
| `PRD_WA_Campaign_Platform.md` | Spesifikasi modul WA Campaign (aktif dikembangkan). |
| `WA_Gateway_Integration_Pointer.md` | Pointer ke SSOT gateway (diunduh dari gw.lumite.biz.id, bukan salinan). |
| `WhatsApp_Strategy_Gateway.md` | Strategi gateway WA. **Dirujuk kode** (`src/lib/wa/gateway.ts`). |
| `Help_System.md` | Sistem bantuan in-app. |

> ⚠️ Dokumen ber-tanda **"Dirujuk kode"** TIDAK BOLEH dipindah/ganti-nama tanpa memperbarui rujukan di `src/`.

---

## 🟡 HISTORIS / ADR (arsip keputusan & rencana — JANGAN dibaca sebagai status kini)
Ini artefak titik-waktu (rencana, keputusan arsitektur, laporan uji, spec awal). Nilainya = jejak "kenapa".
**Tugasnya sudah selesai.** Boleh dibaca untuk konteks historis, TAPI untuk status terkini lihat dokumen HIDUP di atas.

| Dokumen | Sifat |
|---|---|
| `AC_Service_Growth_OS_Master_Business_Plan_Evaluated_v1.0.md` | Rencana bisnis awal (Agu 2026). |
| `AC_Service_Growth_OS_PRD_and_Technical_Specification_v1.0.md` | PRD awal — digantikan iterasi berikutnya. |
| `AC_Service_Growth_OS_PRD_and_Technical_Specification_v1.1_money-first.md` | PRD revisi money-first (historis). |
| `BuildSpecPack_Part2_ScreenSpec.md` | Spec layar saat build (titik-waktu). |
| `Differentiation_and_Domain_Strategy.md` | Keputusan strategi (ADR). |
| `MQTT_Decision_v3_Mosquitto_VPS.md` | Keputusan MQTT (ADR). |
| `Hosting_Architecture_Decision.md` | Keputusan hosting (ADR) — status live terkini lihat PETA_APLIKASI_LIVE. |
| `TechStack_v2_Supabase_Reconsidered.md` | Keputusan tech stack (ADR). |
| `Portfolio_Shared_Gateway_Architecture.md` | Rancangan gateway bersama (historis). |
| `Capacity_Planning.md` | Perencanaan kapasitas (titik-waktu). |
| `GoToMarket_Strategy_ROI.md` | Strategi GTM/ROI (rencana). |
| `Auth_Decision_Phone_PIN.md` | Keputusan auth teknisi (ADR). |
| `Auth_Migration_Plan_Google_SelfHost.md` | Rencana migrasi auth (selesai dieksekusi). |
| `Panduan_OAuth_Branding_Google.md` | Panduan setup OAuth (referensi sekali-pakai). |
| `PLAN_UNIT_IDENTITY_QR.md` | Rencana fitur QR unit (historis). |
| `RENCANA_INVOICING_AR.md` | Rencana invoicing/AR (selesai). |
| `BATON_INVOICING_AR.md` | Baton/handoff invoicing (titik-waktu). |
| `Dokumen_Keuangan_Faktur_Kwitansi.md` | Referensi format keuangan. |
| `LAPORAN_BUG_TESTING_FINAL.md` | Laporan uji tanggal 28 Agu 2026 (titik-waktu). |
| `CHECKLIST_TES_DEVICE.md` | Checklist uji perangkat (titik-waktu). |

---

## Aturan menjaga SSOT (agar tak jadi sampah lagi)
1. **Ubah dokumen di commit yang sama** dengan perubahan kode/infra yang membuatnya berubah.
2. **Satu fakta, satu tempat.** Jangan menyalin fakta (mis. domain/URL, mode payment) ke banyak file.
3. **Fakta volatil → verifikasi, jangan tulis tangan.** Pakai `scripts/ssot-status.sh`.
4. **Historis itu beku.** Jangan memperbarui dokumen HISTORIS; kalau ada keputusan baru, buat catatan baru atau perbarui dokumen HIDUP.
5. **Dokumen "Dirujuk kode" tak boleh dipindah/rename** tanpa update rujukan di `src/`.
6. Riwayat ada di **git**, bukan di file `_v2`/`_final`.
