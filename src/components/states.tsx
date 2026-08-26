/**
 * State primitives — empty / loading / error. Standar world-class: setiap daftar/aksi
 * punya keadaan kosong yang MEMANDU, loading yang jelas, dan error yang bisa dipulihkan.
 * Dipakai lintas halaman agar konsisten (satu bahasa visual).
 */
import Link from "next/link";
import type { ComponentType, ReactNode } from "react";

/** Keadaan KOSONG yang memandu (bukan layar kosong membingungkan). */
export function EmptyState({
  icon: IconCmp,
  title,
  desc,
  actionHref,
  actionLabel,
}: {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  desc?: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-12 text-center">
      {IconCmp && (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
          <IconCmp className="h-6 w-6" />
        </div>
      )}
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {desc && <p className="mt-1 max-w-sm text-sm text-slate-500">{desc}</p>}
      {actionHref && actionLabel && (
        <Link
          href={actionHref}
          className="mt-4 inline-flex min-h-[40px] items-center rounded-xl bg-sky-500 px-4 text-sm font-semibold text-white hover:bg-sky-600"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}

/** Skeleton baris (loading list). */
export function SkeletonRows({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3">
          <div className="h-10 w-10 animate-pulse rounded-lg bg-slate-100" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/3 animate-pulse rounded bg-slate-100" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Spinner inline (aksi/loading kecil). */
export function Spinner({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={`animate-spin text-current ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
    </svg>
  );
}

/** Keadaan ERROR dengan aksi pemulihan. */
export function ErrorState({ title = "Terjadi kesalahan", desc, children }: { title?: string; desc?: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-6 text-center">
      <p className="text-sm font-semibold text-red-800">{title}</p>
      {desc && <p className="mt-1 text-sm text-red-600">{desc}</p>}
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}
