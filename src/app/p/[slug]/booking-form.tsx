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
import { submitBooking, type BookingActionState } from "./actions";
import { HONEYPOT_FIELD, SERVICE_TYPES } from "@/lib/validation/booking";
import { Icon } from "@/components/icons";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

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

// Select native dipertahankan untuk progressive enhancement (form bekerja tanpa JS).
const selectClass =
  "flex min-h-[48px] w-full rounded-lg border border-input bg-transparent px-3 py-2 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

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
        className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center dark:border-emerald-900/40 dark:bg-emerald-950/30"
      >
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-white">
          <Icon.Check className="h-6 w-6" aria-hidden />
        </div>
        <h3 className="text-lg font-bold text-emerald-800 dark:text-emerald-300">
          {state.message}
        </h3>
        <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-400">
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
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-400"
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

      <div className="space-y-1.5">
        <Label htmlFor="name">
          Nama <span className="text-red-500">*</span>
        </Label>
        <Input
          id="name"
          name="name"
          type="text"
          required
          maxLength={80}
          autoComplete="name"
          aria-required="true"
          aria-invalid={!!fieldErrors.name}
          aria-describedby={fieldErrors.name ? "name-err" : undefined}
          className="min-h-[48px] text-base"
          placeholder="Nama lengkap Anda"
        />
        {fieldErrors.name && (
          <p id="name-err" className="text-sm text-red-600 dark:text-red-400">
            {fieldErrors.name}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="phone">
          Nomor WhatsApp <span className="text-red-500">*</span>
        </Label>
        <Input
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
          className="min-h-[48px] text-base"
          placeholder="08xxxxxxxxxx"
        />
        {fieldErrors.phone ? (
          <p id="phone-err" className="text-sm text-red-600 dark:text-red-400">
            {fieldErrors.phone}
          </p>
        ) : (
          <p id="phone-hint" className="text-xs text-muted-foreground">
            Kami akan menghubungi Anda lewat WhatsApp.
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="serviceType">Jenis Layanan</Label>
        <select
          id="serviceType"
          name="serviceType"
          defaultValue=""
          className={selectClass}
        >
          <option value="">— Pilih (opsional) —</option>
          {SERVICE_TYPES.map((st) => (
            <option key={st} value={st}>
              {SERVICE_LABELS[st]}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="preferredDate">Tanggal Diinginkan</Label>
        <Input
          id="preferredDate"
          name="preferredDate"
          type="date"
          className="min-h-[48px] text-base"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="note">Catatan</Label>
        <Textarea
          id="note"
          name="note"
          rows={3}
          maxLength={500}
          aria-invalid={!!fieldErrors.note}
          aria-describedby={fieldErrors.note ? "note-err" : undefined}
          className="text-base"
          placeholder="Contoh: AC kamar tidak dingin, unit 1 PK"
        />
        {fieldErrors.note && (
          <p id="note-err" className="text-sm text-red-600 dark:text-red-400">
            {fieldErrors.note}
          </p>
        )}
      </div>

      <SubmitButton
        pendingLabel="Mengirim…"
        className="min-h-[48px] w-full bg-sky-500 text-base text-white shadow-lg shadow-sky-200 hover:bg-sky-600 dark:shadow-none"
      >
        Kirim Permintaan Booking
      </SubmitButton>
      <p className="text-center text-xs text-muted-foreground">
        Dengan mengirim, Anda setuju dihubungi terkait permintaan servis ini.
      </p>
    </form>
  );
}
