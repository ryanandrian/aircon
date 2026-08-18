import Link from "next/link";

/**
 * Header halaman aplikasi — konsisten di semua sub-halaman /app.
 * Sticky, glass, tombol kembali. Mobile-first.
 */
export function AppHeader({ title, back = "/app", backLabel = "Ringkasan", action }: {
  title: string;
  back?: string;
  backLabel?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-5 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href={back}
            aria-label={`Kembali ke ${backLabel}`}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100"
          >
            ←
          </Link>
          <h1 className="truncate text-lg font-bold tracking-tight text-slate-900">{title}</h1>
        </div>
        {action}
      </div>
    </header>
  );
}
