import Link from "next/link";
import Image from "next/image";
import { GoogleSignInButton } from "./google-button";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 p-6">
      {/* Aksen latar lembut */}
      <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-sky-200/40 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-sky-100/50 blur-3xl" />

      <div className="relative w-full max-w-sm">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-lg shadow-slate-200/50">
          <div className="flex flex-col items-center text-center">
            <Image src="/brand/aircon-logo.png" alt="Aircon" width={56} height={56} className="h-14 w-14 object-contain" priority />
            <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">Masuk ke Aircon</h1>
            <p className="mt-1.5 text-sm text-slate-500">Operating System usaha servis AC Anda.</p>
          </div>

          {error && (
            <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              Gagal masuk. Silakan coba lagi.
            </p>
          )}

          <div className="mt-7">
            <GoogleSignInButton next={next} />
            <p className="mt-3 text-center text-xs text-slate-400">Untuk pemilik usaha &amp; admin</p>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-100" />
            <span className="text-xs text-slate-400">atau</span>
            <div className="h-px flex-1 bg-slate-100" />
          </div>

          <div className="mt-6 grid gap-2">
            <Link href="/masuk-teknisi" className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
              📱 Masuk sebagai Teknisi
            </Link>
            <Link href="/demo" className="flex min-h-[44px] items-center justify-center rounded-xl text-sm font-medium text-sky-600 transition hover:bg-sky-50">
              Lihat Demo tanpa login →
            </Link>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          Dengan masuk, Anda menyetujui ketentuan layanan Aircon.
        </p>
      </div>
    </main>
  );
}
