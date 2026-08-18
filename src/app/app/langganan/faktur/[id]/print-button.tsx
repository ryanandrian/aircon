"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-sky-500 px-4 text-sm font-semibold text-white transition hover:bg-sky-600 active:scale-[0.98]"
    >
      🖨️ Cetak / Simpan PDF
    </button>
  );
}
