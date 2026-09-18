# PKP Tax Consistency Implementation Plan

> **For Hermes:** Use this plan task-by-task; do not deploy before all gates pass.

**Goal:** Menyatukan seluruh tampilan, preview checkout, pembayaran, faktur, dan dokumentasi agar pajak hanya ditampilkan/dihitung bila `CompanyProfile.isPkp=true`.

**Architecture:** `CompanyProfile.isPkp` menentukan apakah pajak efektif boleh dipungut. `BillingPolicy.taxPercent` hanya menjadi tarif ketika PKP aktif. Satu helper `effectiveTaxPercent(isPkp, policyTaxPercent)` menjadi sumber aturan; UI dan server memakai hasil yang sama.

**Tech Stack:** Next.js 16, React, Prisma, TypeScript, Vitest, Supabase PostgreSQL.

---

## Fakta audit saat ini

Database production:

- `CompanyProfile.isPkp=false`.
- `BillingPolicy.taxPercent=11`.
- Plan Professional/Business `taxable=true`.

Perilaku saat ini:

- `src/app/app/langganan/page.tsx` memakai `policy.taxPercent` langsung untuk `taxNote` dan `priceWithTax`, tanpa `company.isPkp`.
- `src/app/app/langganan/actions.ts` sudah benar: memakai `effectiveTaxPercent(company.isPkp, policy.taxPercent)`, sehingga preview dan payment total = tanpa pajak saat non-PKP.
- `src/lib/billing/gating-pure.ts` sudah memiliki canonical helper `effectiveTaxPercent`.
- `src/app/page.tsx` juga menampilkan harga publik berdasarkan `policy.taxPercent` tanpa memeriksa PKP; perlu diselaraskan.
- `src/app/app/langganan/faktur/[id]/page.tsx` sudah memakai company profile dan effective tax, tetapi harus diuji sebagai consumer dari payment snapshot/aturan saat ini.
- IoT memakai effective tax untuk order total, tetapi menyimpan `taxPercent: policy.taxPercent` di snapshot; perlu audit/fix agar snapshot konsisten.

## Acceptance criteria

1. Saat `isPkp=false`:
   - kartu paket tidak menampilkan “Termasuk pajak 11%”;
   - harga paket tidak dinaikkan pajak;
   - preview checkout menampilkan pajak 0/tidak menampilkan baris pajak;
   - total yang dikirim ke iPaymu sama dengan harga setelah diskon tanpa pajak;
   - faktur tidak menampilkan PPN;
   - pricing landing tidak menampilkan harga termasuk pajak.
2. Saat `isPkp=true` dan policy 11:
   - kartu paket menampilkan harga termasuk pajak 11%;
   - preview, payment, faktur, dan landing memakai total yang sama;
   - IoT memakai dan menyimpan effective tax 11%.
3. Perubahan `BillingPolicy.taxPercent` tidak berpengaruh ketika non-PKP.
4. Tidak ada hardcode atau cabang pajak paralel.
5. Existing coupon, rounding, commission base, dan iPaymu redirect tetap lulus.

## Rencana eksekusi TDD

### Task 1 — Kunci invariant pure tax

Files:
- Test: `tests/coupon.test.ts` atau test billing pure yang paling sesuai setelah audit.
- Source: `src/lib/billing/gating-pure.ts` bila coverage belum memadai.

Langkah:
1. Tambahkan test `effectiveTaxPercent(false, 11) === 0`.
2. Tambahkan test `effectiveTaxPercent(true, 11) === 11`.
3. Tambahkan test rate negatif/edge sesuai kontrak existing.
4. Jalankan test spesifik dan pastikan RED bila coverage/behavior belum ada.
5. Pertahankan helper canonical, jangan membuat helper kedua.

### Task 2 — Samakan pricing card tenant

Files:
- Modify: `src/app/app/langganan/page.tsx`.
- Test: component/server pricing test jika harness tersedia; jika tidak, tambahkan pure mapper test.

Langkah:
1. Ambil `getCompanyProfile()` bersama plans/policy.
2. Hitung `effectiveTaxPercent(company.isPkp, policy.taxPercent)` per plan.
3. Gunakan effective rate untuk `withTax` dan `taxNote`.
4. Hanya tampilkan tax note jika effective rate > 0.
5. Pastikan non-PKP tidak menyebut pajak sama sekali.

### Task 3 — Samakan landing pricing

Files:
- Modify: `src/app/page.tsx`.
- Test: test mapper pricing jika diperlukan.

Langkah:
1. Ambil CompanyProfile melalui service canonical.
2. Gunakan effective tax rate, bukan policy rate mentah.
3. Hilangkan label “termasuk pajak” pada non-PKP.
4. Pastikan harga landing sama dengan kartu tenant dan server preview.

### Task 4 — Audit dan perbaiki snapshot IoT

Files:
- Modify: `src/lib/services/iot-order-service.ts` bila audit membuktikan snapshot salah.
- Test: `tests/ipaymu-logic.test.ts` atau test IoT yang relevan.

Langkah:
1. Ubah snapshot `taxPercent` agar menyimpan effective rate, bukan `policy.taxPercent` mentah.
2. Pastikan `taxAmount`, `total`, item iPaymu, dan faktur memakai snapshot yang sama.
3. Jangan mengubah transaksi existing; perubahan berlaku pada order baru.
4. Tambahkan test PKP/non-PKP.

### Task 5 — Verifikasi faktur dan payment boundary

Files:
- Audit/modify only if required: `src/app/app/langganan/faktur/[id]/page.tsx`, `src/lib/services/subscription-service.ts`, `src/lib/domain/finance-doc.ts`.

Langkah:
1. Pastikan faktur memakai tax state yang benar dan tidak menghitung ulang dengan policy mentah.
2. Pastikan `startIpaymuPayment` dan `previewCheckout` memakai formula yang sama.
3. Pastikan `commissionBaseIdr` tidak ikut memasukkan pajak.
4. Tambahkan regression test untuk total non-PKP/PKP.

### Task 6 — Dokumentasi dan SSOT

Files:
- `docs/Payment_Dunning_SSOT.md`
- `docs/Ipaymu_Integration_Spec.md` bila kontrak amount perlu diperjelas.

Dokumentasikan:
- `isPkp=false` berarti effective tax 0 meskipun `BillingPolicy.taxPercent` terisi.
- `BillingPolicy.taxPercent` adalah tarif policy, bukan izin memungut pajak.
- Semua checkout/payment provider menerima total dari server canonical.

### Task 7 — Full verification

Commands:

```bash
pnpm exec tsc --noEmit
pnpm run lint
pnpm run test
pnpm run build
pnpm prisma migrate status
```

Target:
- semua lulus;
- tidak ada migration baru karena ini perubahan logic/UI saja;
- scan hardcode tax paths tidak menemukan pricing UI yang memakai policy rate mentah tanpa effective PKP gate;
- local server menghasilkan kartu dan preview konsisten untuk fixture PKP=false dan PKP=true.

Jika deploy diminta setelah rencana disetujui, wajib mengikuti SOP deploy: build hanya lokal, artifact lengkap + checksum, commit/push GitHub, VPS hanya extract/switch/restart/health-check. Tidak boleh build/patch manual di VPS.

## Risiko dan keputusan

- Jangan mengubah `BillingPolicy.taxPercent` production menjadi 0 hanya untuk memperbaiki UI; rate 11 boleh tetap tersimpan sebagai policy untuk saat PKP aktif.
- Jangan mengubah histori payment/invoice existing tanpa instruksi eksplisit; fokus pada konsistensi transaksi baru dan rendering dokumen.
- Jika faktur existing tidak memiliki snapshot tax state, perlakukan sebagai masalah data-contract terpisah dan jangan mengarang backfill.
- Jika harga database ternyata sudah menyimpan total termasuk pajak, hentikan dan audit sebelum edit; bukti saat ini menunjukkan subscription payment menghitung total tanpa pajak ketika non-PKP.
