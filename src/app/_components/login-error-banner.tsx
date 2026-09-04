"use client";

import { useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";

/**
 * Banner ramah saat OAuth gagal (mis. state kedaluwarsa krn login terlalu lama).
 * Muncul bila landing dibuka dengan ?error=... dari Supabase Auth. Dismissible.
 */
export function LoginErrorBanner({ code }: { code?: string }) {
  const [show, setShow] = useState(true);
  if (!show) return null;

  const expired = code === "bad_oauth_state" || code === "otp_expired" || code === "flow_state_expired";
  const msg = expired
    ? "Sesi login kedaluwarsa karena terlalu lama. Silakan coba masuk lagi — biasanya cepat."
    : "Login belum berhasil. Silakan coba masuk lagi.";

  return (
    <div className="sticky top-0 z-40 border-b border-amber-300 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/40">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 sm:px-5">
        <p className="min-w-0 flex-1 text-sm text-amber-900 dark:text-amber-200">{msg}</p>
        <Link
          href="/login"
          className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-amber-700"
        >
          Coba masuk lagi
        </Link>
        <button
          onClick={() => setShow(false)}
          aria-label="Tutup"
          className="shrink-0 rounded-md p-1 text-amber-700 transition hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/50"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
