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
import { useFormStatus } from "react-dom";
import { completeOnboarding, type OnboardingActionState } from "./actions";

const initialState: OnboardingActionState = { ok: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="min-h-[48px] w-full rounded-2xl bg-sky-500 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-sky-200 transition hover:bg-sky-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Menyiapkan…" : "Mulai Pakai Aircon"}
    </button>
  );
}

export default function OnboardingWizard() {
  const [state, formAction] = useActionState<OnboardingActionState, FormData>(
    completeOnboarding,
    initialState,
  );

  const fieldErrors = state.ok === false ? (state.fieldErrors ?? {}) : {};

  return (
    <form
      action={formAction}
      noValidate
      className="mt-8 space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      {/* Error umum */}
      {state.ok === false && (
        <p
          role="alert"
          aria-live="assertive"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {state.error}
        </p>
      )}

      {/* Nama Usaha */}
      <div>
        <label
          htmlFor="businessName"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Nama Usaha <span className="text-red-500">*</span>
        </label>
        <input
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
          className="min-h-[48px] w-full rounded-2xl border border-slate-300 px-4 py-3 text-base text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
          placeholder="Contoh: AC Sejuk Jaya"
        />
        {fieldErrors.businessName ? (
          <p id="businessName-err" className="mt-1 text-sm text-red-600">
            {fieldErrors.businessName}
          </p>
        ) : (
          <p id="businessName-hint" className="mt-1 text-xs text-slate-500">
            Nama yang dilihat pelanggan Anda.
          </p>
        )}
      </div>

      {/* Kota / Area layanan */}
      <div>
        <label
          htmlFor="city"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Kota / Area Layanan <span className="text-red-500">*</span>
        </label>
        <input
          id="city"
          name="city"
          type="text"
          required
          maxLength={60}
          autoComplete="address-level2"
          aria-required="true"
          aria-invalid={!!fieldErrors.city}
          aria-describedby={fieldErrors.city ? "city-err" : "city-hint"}
          className="min-h-[48px] w-full rounded-2xl border border-slate-300 px-4 py-3 text-base text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
          placeholder="Contoh: Bandung"
        />
        {fieldErrors.city ? (
          <p id="city-err" className="mt-1 text-sm text-red-600">
            {fieldErrors.city}
          </p>
        ) : (
          <p id="city-hint" className="mt-1 text-xs text-slate-500">
            Kota atau daerah tempat Anda melayani servis.
          </p>
        )}
      </div>

      {/* Nomor WhatsApp usaha */}
      <div>
        <label
          htmlFor="whatsappPhone"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Nomor WhatsApp Usaha <span className="text-red-500">*</span>
        </label>
        <input
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
          className="min-h-[48px] w-full rounded-2xl border border-slate-300 px-4 py-3 text-base text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
          placeholder="08xxxxxxxxxx"
        />
        {fieldErrors.whatsappPhone ? (
          <p id="whatsappPhone-err" className="mt-1 text-sm text-red-600">
            {fieldErrors.whatsappPhone}
          </p>
        ) : (
          <p id="whatsappPhone-hint" className="mt-1 text-xs text-slate-500">
            Nomor untuk dihubungi pelanggan & mengirim pengingat servis.
          </p>
        )}
      </div>

      <SubmitButton />
    </form>
  );
}
