import Link from "next/link";
import { GoogleSignInButton } from "./google-button";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500 font-bold text-white">A</div>
          <span className="text-lg font-bold">Aircon</span>
        </div>
        <h1 className="text-xl font-bold text-slate-900">Masuk</h1>
        <p className="mt-1 text-sm text-slate-500">Untuk pemilik usaha AC &amp; admin.</p>

        {error && (
          <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Gagal masuk. Silakan coba lagi.
          </p>
        )}

        <div className="mt-6">
          <GoogleSignInButton next={next} />
        </div>

        <div className="mt-6 border-t border-slate-100 pt-4 text-center">
          <Link href="/demo" className="text-sm font-medium text-sky-600 hover:text-sky-700">
            Lihat Demo tanpa login →
          </Link>
        </div>
      </div>
    </main>
  );
}
