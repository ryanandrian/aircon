import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500 font-bold text-white">A</div>
          <span className="text-lg font-bold">Aircon</span>
        </div>
        <h1 className="text-xl font-bold text-slate-900">Masuk</h1>
        <p className="mt-1 text-sm text-slate-500">Untuk pemilik usaha AC & admin.</p>

        <button
          disabled
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-3 font-medium text-slate-700 opacity-60"
          title="Aktif setelah konfigurasi Google OAuth di Supabase"
        >
          <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.15-4.53H2.18v2.84A11 11 0 0 0 12 23Z"/><path fill="#FBBC05" d="M5.85 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.67-2.84Z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.67 2.84C6.71 7.31 9.14 5.38 12 5.38Z"/></svg>
          Lanjutkan dengan Google
        </button>
        <p className="mt-3 text-center text-xs text-amber-600">
          Login Google aktif setelah konfigurasi OAuth (menunggu credential).
        </p>

        <div className="mt-6 border-t border-slate-100 pt-4 text-center">
          <Link href="/demo" className="text-sm font-medium text-sky-600 hover:text-sky-700">
            Lihat Demo tanpa login →
          </Link>
        </div>
      </div>
    </main>
  );
}
