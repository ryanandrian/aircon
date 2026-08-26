"use client";

/**
 * Form booking (Client Component).
 * - Progressive enhancement: <form action> memanggil server action langsung,
 *   tetap berfungsi tanpa JS. useActionState menambah state loading/sukses/error.
 * - Aksesibel: setiap input punya <label>, aria-invalid, aria-describedby,
 *   target sentuh >= 44px, aria-live untuk hasil.
 * - Honeypot tersembunyi menangkap bot.
 */
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { submitBooking, type BookingActionState } from "./actions";
import { HONEYPOT_FIELD, SERVICE_TYPES } from "@/lib/validation/booking";
import { Icon } from "@/components/icons";

const SERVICE_LABELS: Record<(typeof SERVICE_TYPES)[number], string> = {
  CLEANING: "Cuci AC",
  REFILL_FREON: "Isi Freon",
  REPAIR: "Perbaikan",
  INSTALL: "Pasang Baru",
  DISMANTLE: "Bongkar",
  INSPECTION: "Pengecekan",
  OTHER: "Lainnya",
};

const initialState: BookingActionState = { ok: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-[48px] w-full rounded-2xl bg-sky-500 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-sky-200 transition hover:bg-sky-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
      aria-busy={pending}
    >
      {pending ? "Mengirim…" : "Kirim Permintaan Booking"}
    </button>
  );
}

export default function BookingForm({ slug }: { slug: string }) {
  const [state, formAction] = useActionState<BookingActionState, FormData>(
    (_prev, formData) => submitBooking(slug, formData),
    initialState,
  );

  const fieldErrors =
    state.ok === false ? (state.fieldErrors ?? {}) : {};

  if (state.ok === true) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center"
      >
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-white">
          <Icon.Check className="h-6 w-6" aria-hidden />
        </div>
        <h3 className="text-lg font-bold text-emerald-800">
          {state.message}
        </h3>
        <p className="mt-1 text-sm text-emerald-700">
          Permintaan Anda sudah kami terima. Tim kami akan menghubungi via
          WhatsApp secepatnya.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4" noValidate>
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

      {/* Honeypot: disembunyikan dari manusia & pembaca layar. */}
      <div className="absolute left-[-9999px]" aria-hidden="true">
        <label htmlFor={HONEYPOT_FIELD}>Jangan diisi</label>
        <input
          id={HONEYPOT_FIELD}
          name={HONEYPOT_FIELD}
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <div>
        <label
          htmlFor="name"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Nama <span className="text-red-500">*</span>
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          maxLength={80}
          autoComplete="name"
          aria-required="true"
          aria-invalid={!!fieldErrors.name}
          aria-describedby={fieldErrors.name ? "name-err" : undefined}
          className="min-h-[48px] w-full rounded-2xl border border-slate-300 px-4 py-3 text-base text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
          placeholder="Nama lengkap Anda"
        />
        {fieldErrors.name && (
          <p id="name-err" className="mt-1 text-sm text-red-600">
            {fieldErrors.name}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="phone"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Nomor WhatsApp <span className="text-red-500">*</span>
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          required
          maxLength={20}
          autoComplete="tel"
          aria-required="true"
          aria-invalid={!!fieldErrors.phone}
          aria-describedby={fieldErrors.phone ? "phone-err" : "phone-hint"}
          className="min-h-[48px] w-full rounded-2xl border border-slate-300 px-4 py-3 text-base text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
          placeholder="08xxxxxxxxxx"
        />
        {fieldErrors.phone ? (
          <p id="phone-err" className="mt-1 text-sm text-red-600">
            {fieldErrors.phone}
          </p>
        ) : (
          <p id="phone-hint" className="mt-1 text-xs text-slate-500">
            Kami akan menghubungi Anda lewat WhatsApp.
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="serviceType"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Jenis Layanan
        </label>
        <select
          id="serviceType"
          name="serviceType"
          defaultValue=""
          className="min-h-[48px] w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
        >
          <option value="">— Pilih (opsional) —</option>
          {SERVICE_TYPES.map((st) => (
            <option key={st} value={st}>
              {SERVICE_LABELS[st]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="preferredDate"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Tanggal Diinginkan
        </label>
        <input
          id="preferredDate"
          name="preferredDate"
          type="date"
          className="min-h-[48px] w-full rounded-2xl border border-slate-300 px-4 py-3 text-base text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
        />
      </div>

      <div>
        <label
          htmlFor="note"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Catatan
        </label>
        <textarea
          id="note"
          name="note"
          rows={3}
          maxLength={500}
          aria-invalid={!!fieldErrors.note}
          aria-describedby={fieldErrors.note ? "note-err" : undefined}
          className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-base text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
          placeholder="Contoh: AC kamar tidak dingin, unit 1 PK"
        />
        {fieldErrors.note && (
          <p id="note-err" className="mt-1 text-sm text-red-600">
            {fieldErrors.note}
          </p>
        )}
      </div>

      <SubmitButton />
      <p className="text-center text-xs text-slate-400">
        Dengan mengirim, Anda setuju dihubungi terkait permintaan servis ini.
      </p>
    </form>
  );
}
