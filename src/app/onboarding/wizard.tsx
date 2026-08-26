"use client";

/**
 * Wizard setup usaha (Client Component) — form 1 halaman, mobile-first.
 *
 * - Progressive enhancement: <form action> memanggil server action langsung,
 *   tetap berfungsi tanpa JS. useActionState menambah state loading/error.
 * - Aksesibel: setiap input punya <label>, aria-required, aria-invalid,
 *   aria-describedby, target sentuh >= 48px, aria-live untuk error.
 * - Bahasa ramah-teknisi: tanpa jargon software.
 */
import { useActionState } from "react";
import { completeOnboarding, type OnboardingActionState } from "./actions";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/submit-button";

const initialState: OnboardingActionState = { ok: null };

export default function OnboardingWizard({ initialRef = "" }: { initialRef?: string }) {
  const [state, formAction] = useActionState<OnboardingActionState, FormData>(
    completeOnboarding,
    initialState,
  );

  const fieldErrors = state.ok === false ? (state.fieldErrors ?? {}) : {};

  return (
    <Card className="mt-8 shadow-sm">
      <CardContent className="p-6">
        <form action={formAction} noValidate className="space-y-5">
          {/* Error umum */}
          {state.ok === false && (
            <p
              role="alert"
              aria-live="assertive"
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-400"
            >
              {state.error}
            </p>
          )}

          {/* Nama Usaha */}
          <div className="space-y-1.5">
            <Label htmlFor="businessName">
              Nama Usaha <span className="text-red-500">*</span>
            </Label>
            <Input
              id="businessName"
              name="businessName"
              type="text"
              required
              maxLength={60}
              autoComplete="organization"
              aria-required="true"
              aria-invalid={!!fieldErrors.businessName}
              aria-describedby={
                fieldErrors.businessName ? "businessName-err" : "businessName-hint"
              }
              className="min-h-[48px] text-base"
              placeholder="Contoh: AC Sejuk Jaya"
            />
            {fieldErrors.businessName ? (
              <p id="businessName-err" className="text-sm text-red-600 dark:text-red-400">
                {fieldErrors.businessName}
              </p>
            ) : (
              <p id="businessName-hint" className="text-xs text-muted-foreground">
                Nama yang dilihat pelanggan Anda.
              </p>
            )}
          </div>

          {/* Kota / Area layanan */}
          <div className="space-y-1.5">
            <Label htmlFor="city">
              Kota / Area Layanan <span className="text-red-500">*</span>
            </Label>
            <Input
              id="city"
              name="city"
              type="text"
              required
              maxLength={60}
              autoComplete="address-level2"
              aria-required="true"
              aria-invalid={!!fieldErrors.city}
              aria-describedby={fieldErrors.city ? "city-err" : "city-hint"}
              className="min-h-[48px] text-base"
              placeholder="Contoh: Bandung"
            />
            {fieldErrors.city ? (
              <p id="city-err" className="text-sm text-red-600 dark:text-red-400">
                {fieldErrors.city}
              </p>
            ) : (
              <p id="city-hint" className="text-xs text-muted-foreground">
                Kota atau daerah tempat Anda melayani servis.
              </p>
            )}
          </div>

          {/* Nomor WhatsApp usaha */}
          <div className="space-y-1.5">
            <Label htmlFor="whatsappPhone">
              Nomor WhatsApp Usaha <span className="text-red-500">*</span>
            </Label>
            <Input
              id="whatsappPhone"
              name="whatsappPhone"
              type="tel"
              inputMode="tel"
              required
              maxLength={20}
              autoComplete="tel"
              aria-required="true"
              aria-invalid={!!fieldErrors.whatsappPhone}
              aria-describedby={
                fieldErrors.whatsappPhone ? "whatsappPhone-err" : "whatsappPhone-hint"
              }
              className="min-h-[48px] text-base"
              placeholder="08xxxxxxxxxx"
            />
            {fieldErrors.whatsappPhone ? (
              <p id="whatsappPhone-err" className="text-sm text-red-600 dark:text-red-400">
                {fieldErrors.whatsappPhone}
              </p>
            ) : (
              <p id="whatsappPhone-hint" className="text-xs text-muted-foreground">
                Nomor untuk dihubungi pelanggan & mengirim pengingat servis.
              </p>
            )}
          </div>

          {/* Kode agen/reseller (opsional) */}
          <div className="space-y-1.5">
            <Label htmlFor="referralCode">
              Kode Agen / Referral <span className="text-muted-foreground">(opsional)</span>
            </Label>
            <Input
              id="referralCode"
              name="referralCode"
              type="text"
              maxLength={12}
              defaultValue={initialRef}
              autoComplete="off"
              className="min-h-[48px] text-base uppercase"
              placeholder="Punya kode dari agen? Isi di sini"
            />
            <p className="text-xs text-muted-foreground">
              Isi bila Anda diajak oleh agen/mitra Aircon. Kosongkan bila mendaftar sendiri.
            </p>
          </div>

          <SubmitButton
            pendingLabel="Menyiapkan…"
            className="min-h-[48px] w-full bg-sky-500 text-base text-white shadow-lg shadow-sky-200 hover:bg-sky-600 dark:shadow-none"
          >
            Mulai Pakai Aircon
          </SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
