# Keagenan E2E Readiness Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Memastikan alur keagenan Aircon valid A–Z dan siap merekrut agen pertama tanpa bug, kebocoran data, komisi salah, atau payout yang tidak dapat diaudit.

**Architecture:** Pertahankan model dua tingkat: Agen sebagai pemilik referral utama, Reseller sebagai sub-partner di bawah Agen. Atribusi tenant dikunci sekali; pembayaran PAID menghasilkan ledger append-only; refund menghasilkan reversal; payout dibuat dan dibayar oleh Platform Admin. Tidak mengubah gateway WA atau payment provider kecuali diperlukan oleh bukti test.

**Tech Stack:** Next.js 16, TypeScript, Prisma 7/PostgreSQL, Vitest, portal cookie HMAC, server actions.

---

## Sumber kebenaran yang wajib dipatuhi

- `docs/ALUR_APLIKASI.md` — alur bisnis dan relasi panel.
- `docs/PETA_APLIKASI_LIVE.md` — route live.
- `docs/Security_Model.md` — isolasi portal partner.
- `docs/Billing_Midtrans.md` — hubungan PAID, komisi, refund/clawback.
- `docs/RENCANA_INVOICING_AR.md` — aturan uang dan payout.
- `prisma/schema.prisma` — enum, constraint, unique key, dan relasi aktual.
- `src/lib/partner/commission-logic.ts` — formulasi komisi yang telah dikunci kode.
- `src/lib/partner/partner-service.ts` — atribusi, accrual, reversal.
- `src/lib/partner/partner-admin-service.ts` — agen dan payout.
- `src/lib/partner/partner-portal-service.ts` — activation, login, dashboard, reseller.

## Formulasi komisi yang harus dikonfirmasi terhadap SSOT

Sebelum test E2E, tulis test vector eksplisit dan pastikan seluruh kode memakai aturan yang sama:

- Basis `grossIdr` adalah nilai pra-pajak yang dipakai oleh implementasi billing; fee payment provider bukan komisi.
- `PERCENT`: `round(grossIdr × rate / 100)`.
- `FLAT_IDR`: `round(rate × monthsPaid)`.
- Rate di-snapshot ke setiap ledger saat accrual.
- Jika ada Agen dan Reseller, masing-masing menerima komisi sesuai rate yang tersimpan; total harus tetap melalui guard bisnis yang disepakati.
- Pembayaran duplicate tidak membuat accrual kedua.
- Refund membuat satu reversal append-only; reversal tidak boleh menggandakan diri.
- Payout menghitung gross positif, deduction reversal, withholding tax, dan net.

Jika dokumen dan kode berbeda, hentikan implementasi dan selesaikan konflik secara eksplisit sebelum E2E.

---

## Task 1: Audit kontrak route dan panel

**Files:**
- Inspect: `src/app/admin/keagenan/*`, `src/app/agen/*`, `src/app/reseller/*`, `src/app/onboarding/*`.
- Test: `tests/partner-routes.test.ts` (create if absent).

- Pastikan link Admin dan Agen mengarah ke `/reseller/daftar/[joinCode]`.
- Pastikan activation route agen dan reseller berbeda serta token dibatasi satu kali.
- Pastikan dashboard tanpa cookie selalu redirect.
- Pastikan tenant onboarding menerima referral code tanpa merusak onboarding normal.

**Acceptance:** seluruh route aktual cocok dengan `PETA_APLIKASI_LIVE.md`; tidak ada link `/agen/daftar` yang tidak memiliki route.

## Task 2: Hardening validasi partner

**Files:**
- Modify: `src/lib/partner/partner-admin-service.ts`.
- Modify: `src/lib/partner/partner-portal-service.ts`.
- Modify: `src/app/admin/keagenan/actions.ts`, `src/app/agen/actions.ts`.
- Test: `tests/partner-validation.test.ts`.

- Validasi email, nama, nomor, rate, tax status, dan data rekening.
- Tolak rate NaN, Infinity, negatif, persen >100, dan flat di atas batas.
- Pastikan agen/reseller nonaktif tidak dapat login, merekrut, atau dipakai untuk atribusi baru.
- Pastikan approval reseller idempoten dan tidak membuat partner code kedua.
- Pastikan token activation tidak dapat dipakai ulang dan tidak tampil di log.

**Acceptance:** input buruk menghasilkan error jelas; tidak ada perubahan parsial di database.

## Task 3: Hardening atribusi tenant

**Files:**
- Modify: `src/lib/partner/partner-service.ts` only if evidence requires.
- Inspect: `src/lib/services/onboarding-service.ts`.
- Test: `tests/partner-attribution.test.ts`.

- Kode agen dan reseller aktif dapat digunakan saat onboarding.
- `TenantAttribution` hanya boleh dibuat sekali.
- Race condition dua request onboarding tidak boleh menghasilkan dua atribusi.
- Atribusi lama tidak boleh direbut atau diubah dengan kode baru.
- Tenant yang mendaftar tanpa kode tetap valid dan tidak menghasilkan ledger partner.

**Acceptance:** satu tenant memiliki maksimal satu atribusi; kode nonaktif tidak memberi komisi.

## Task 4: Hardening billing → commission

**Files:**
- Inspect/modify: `src/lib/services/subscription-service.ts`.
- Inspect: `src/lib/partner/partner-service.ts`.
- Test: `tests/partner-commission-integration.test.ts`.

- Jalur Midtrans dan iPaymu memanggil satu domain function yang konsisten.
- PAID pertama mengaktifkan subscription dan membuat satu accrual.
- Callback/payment PAID kedua idempotent: tidak membuat accrual baru.
- Kupon dan pajak tidak mengubah basis secara tidak terdokumentasi.
- Agen/reseller self-referral menghasilkan komisi nol sesuai SSOT.
- Kegagalan ledger tidak membatalkan aktivasi tenant, tetapi tercatat jelas.

**Acceptance:** payment status, subscription, dan ledger konsisten setelah setiap skenario.

## Task 5: Hardening refund dan reversal

**Files:**
- Inspect/modify: `src/lib/partner/partner-service.ts`.
- Inspect semua refund service/callers.
- Test: `tests/partner-reversal.test.ts`.

- Refund penuh membuat satu reversal.
- Callback refund duplicate tidak menggandakan reversal.
- Refund sebelum payout mengurangi accrual secara transparan.
- Refund setelah payout menjadi deduction periode berikutnya.
- Partial refund, bila didukung bisnis, harus dihitung proporsional; bila belum didukung, ditolak/ditandai jelas—jangan diam-diam dianggap penuh.

**Acceptance:** saldo ledger dan payout dapat direkonsiliasi manual dari baris append-only.

## Task 6: Hardening payout

**Files:**
- Modify: `src/lib/partner/partner-admin-service.ts`.
- Modify: `src/app/admin/keagenan/actions.ts`.
- Test: `tests/partner-payout.test.ts`.

- `buildMonthlyPayouts` idempotent dan aman terhadap konkurensi.
- Hanya status `DRAFT`/`APPROVED` yang boleh ditandai `PAID`.
- `transferRef` wajib dan tidak boleh kosong.
- Ledger yang sudah masuk payout tidak boleh dibayar dua kali.
- Net payout tidak boleh negatif.
- PPh hanya prefill sesuai status pajak dan dapat diaudit.
- Payout agent dan reseller tidak boleh tertukar.

**Acceptance:** setiap payout memiliki periode, gross, deduction, tax, net, status, dan bukti transfer.

## Task 7: Security dan isolation audit

**Files:**
- Inspect: `src/lib/partner/partner-session.ts`.
- Inspect seluruh server actions dan portal pages.
- Test: `tests/partner-isolation.test.ts`.

- Agen hanya melihat tenant/reseller miliknya.
- Reseller hanya melihat komisinya sendiri.
- Partner tidak dapat mengganti `agentId`, `resellerId`, atau payout ID melalui input.
- Cookie tetap HttpOnly, Secure production, SameSite Lax, HMAC signed.
- Rekening tetap terenkripsi; plaintext hanya saat export yang berwenang.
- Tidak ada credential, token activation, atau rekening di log.

**Acceptance:** cross-tenant/cross-partner access ditolak atau menghasilkan data kosong yang benar.

## Task 8: UI/UX dan feedback seluruh panel

**Files:**
- Modify relevant manager/forms only after functional tests pass.
- Test: component/browser smoke checks.

- Semua action menampilkan loading dan feedback sukses/error.
- Kode referral, join link, rate, saldo, status payout, dan periode terlihat jelas.
- Link rekrut reseller memakai route aktual.
- Mobile-first: form dan tabel tidak overflow pada lebar HP.
- Status `PENDING`, `ACTIVE`, `REJECTED`, `SUSPENDED`, `DRAFT`, `APPROVED`, `PAID` memakai label Bahasa Indonesia konsisten.

**Acceptance:** Admin, Agen, dan Reseller memahami langkah berikutnya tanpa membaca kode.

## Task 9: E2E QA terisolasi lintas panel

**Files:**
- Create: `scripts/qa/partner-e2e.mjs` or equivalent using existing project DB adapter.
- Create: `docs/evidence/partner-e2e-<date>.md`.

Gunakan data QA terisolasi dan nomor dummy `62899000xxx`; jangan gunakan nomor operator nyata.

Urutan:

1. Admin membuat Agen dengan rate yang mudah diverifikasi.
2. Agen menerima link aktivasi, membuat PIN, login.
3. Agen membagikan join link.
4. Reseller mendaftar dan menjadi `PENDING`.
5. Agen approve dengan rate reseller.
6. Reseller aktivasi PIN dan login.
7. Tenant QA onboarding dengan kode reseller.
8. Verifikasi atribusi tenant menunjuk Agen + Reseller yang benar.
9. Buat payment QA `PAID` melalui jalur provider yang aman.
10. Verifikasi satu accrual Agen dan satu accrual Reseller.
11. Kirim event/callback duplicate; pastikan ledger tetap satu.
12. Simulasikan refund; verifikasi reversal satu kali.
13. Susun payout periode; verifikasi angka gross/deduction/tax/net.
14. Tandai transfer dengan reference QA; verifikasi ledger menjadi `PAID`.
15. Login dua partner lain dan verifikasi tidak ada data silang.
16. Simpan evidence tanpa secret/token/password.
17. Bersihkan hanya data QA dengan script yang mengharuskan tenant/marker QA eksplisit.

**Acceptance:** setiap tahap memiliki bukti DB/API/UI; tidak cukup hanya status HTTP 200.

## Task 10: Gates, deploy, dan smoke test

Run:

```bash
pnpm exec tsc --noEmit
pnpm run test
pnpm run lint
pnpm run build
git diff --check
```

Sebelum deploy:

- `git diff` review hanya file scope.
- Prisma migration status production harus up-to-date.
- Backup/rollback plan terdokumentasi.
- Tidak ada secret di diff, test output, atau artifact.

Setelah deploy:

- service Aircon active;
- route `/admin/keagenan`, `/agen/login`, `/reseller/login` HTTP normal;
- browser smoke test login/redirect;
- E2E QA di production hanya dengan data QA dan tanpa transaksi nyata;
- verifikasi DB setelah setiap tahap.

## Definition of Done: siap rekrut agen

- Semua acceptance criteria Task 1–10 terpenuhi.
- E2E lintas Admin → Agen → Reseller → Tenant → PAID → Ledger → Refund → Payout lulus.
- Tidak ada known high/critical issue.
- Formula komisi dan perlakuan pajak/refund disetujui dan sama antara SSOT, kode, dan test vector.
- Semua partner dapat melihat data yang benar dan hanya data berwenang.
- Semua gates lulus.
- Deploy dan smoke test live lulus.
- SSOT dan evidence diperbarui dengan tanggal, scope, dan hasil nyata.
- Baru setelah itu perekrutan agen pertama boleh dimulai.

## Risiko dan guardrail

- Jangan menguji dengan nomor WA nyata.
- Jangan menjalankan destructive cleanup tanpa marker QA dan daftar ID eksplisit.
- Jangan mengubah payment environment sebagai bagian dari test keagenan tanpa persetujuan Owner.
- Jangan menyebut “siap 100%” hanya karena unit test/build lulus.
- Jika formula komisi belum disepakati, hentikan E2E uang dan laporkan konflik—jangan memilih sendiri.
