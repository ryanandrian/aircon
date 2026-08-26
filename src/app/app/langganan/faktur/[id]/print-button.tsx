"use client";

import { Icon } from "@/components/icons";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-sky-500 px-4 text-sm font-semibold text-white transition hover:bg-sky-600 active:scale-[0.98]"
    >
      <Icon.Print className="h-4 w-4" aria-hidden /> Cetak / Simpan PDF
    </button>
  );
}
