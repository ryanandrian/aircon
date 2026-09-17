# Tahap 1: komisi per plan

`CommissionLedger.plan` sekarang menyimpan snapshot `TenantPlan` dan rate canonical per plan pada setiap accrual dan reversal. Admin dapat mengatur rate Agen/Reseller per paket; field rate legacy dipertahankan untuk kompatibilitas. Implementasi ini harus dianggap aktif hanya setelah migration, tests, dan deployment diverifikasi.

## Scope

Tahap 1 memakai jalur existing Midtrans: Admin Platform → Agen → Reseller → onboarding Tenant → PAID → ledger → payout manual Agen. Jalur iPaymu belum menjadi production path; Split Payment iPaymu dan payout otomatis Reseller berada di Tahap 2.

## Perbaikan yang sudah diterapkan

- Link rekrut reseller Admin Platform diperbaiki ke `/reseller/daftar/[joinCode]`.
- Approval reseller menolak nilai komisi non-finite/negatif, persen di atas 100, dan flat di atas batas aman.
- Payout hanya dapat ditandai `PAID` dari status `DRAFT` atau `APPROVED`.
- Data QA Agen `PT Clawback` dipertahankan; tidak dihapus atau dimodifikasi.

## Evidence QA PT Clawback

- Agen aktif, rate `FLAT_IDR` Rp50.000/bulan.
- Satu tenant teratribusi.
- Satu accrual Juli Rp50.000 dan reversal -Rp50.000.
- Satu accrual Agustus Rp50.000.
- Payout Juli `PAID`, gross Rp50.000, PPh Rp1.000, net Rp49.000, transfer reference `TRF-001`.
- Belum ada reseller QA pada fixture ini; full reseller E2E masih memerlukan fixture reseller terisolasi.

## Gate saat ini

- TypeScript: lulus.
- Lint: lulus.
- Tests: 382/382 lulus.
- Belum menyatakan siap rekrut 100% sampai alur reseller lengkap diuji dari UI sampai database dan bukti payout.
