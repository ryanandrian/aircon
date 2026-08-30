import Link from "next/link";
import Image from "next/image";
import { GoogleSignInButton } from "./google-button";
import { Icon } from "@/components/icons";
import { buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* KIRI — panel brand (world-class: value proposition + trust). Sembunyi di mobile. */}
      <aside className="relative hidden overflow-hidden bg-slate-950 lg:flex lg:flex-col lg:justify-between lg:p-12">
        {/* Lapisan gradient & aksen */}
        <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-sky-600 via-sky-700 to-slate-950" />
        <div aria-hidden className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-sky-400/30 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute bottom-0 right-0 h-96 w-96 rounded-full bg-cyan-300/20 blur-3xl" />

        {/* Logo */}
        <div className="relative flex items-center gap-2.5 text-white">
          <Image src="/brand/aircon-logo.png" alt="Aircon" width={36} height={36} className="h-9 w-9 object-contain brightness-0 invert" priority />
          <span className="text-xl font-bold tracking-tight">Aircon</span>
        </div>

        {/* Pesan nilai */}
        <div className="relative max-w-md text-white">
          <h2 className="text-3xl font-extrabold leading-tight tracking-tight">
            Pelanggan servis AC Anda datang lagi otomatis.
          </h2>
          <p className="mt-4 text-sky-100/90">
            Operating System untuk usaha servis AC: terima booking online, atur teknisi,
            dan ingatkan pelanggan servis berkala lewat WhatsApp — semua dari satu tempat.
          </p>
          <ul className="mt-8 space-y-3">
            {[
              "Pengingat servis otomatis — servis berulang tanpa dicatat manual",
              "Halaman booking online sendiri untuk usaha Anda",
              "Atur teknisi, checklist & foto bukti dari HP",
            ].map((t) => (
              <li key={t} className="flex items-start gap-3 text-sm text-sky-50">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/15">
                  <Icon.Check className="h-3.5 w-3.5" aria-hidden />
                </span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer panel */}
        <p className="relative text-xs text-sky-100/70">Dari Lumite — dipercaya usaha servis AC di Indonesia.</p>
      </aside>

      {/* KANAN — form masuk */}
      <div className="relative flex items-center justify-center bg-muted/40 p-6">
        <div className="absolute right-4 top-4"><ThemeToggle /></div>

        <div className="w-full max-w-sm">
          {/* Logo (hanya tampil di mobile, karena panel kiri tersembunyi) */}
          <div className="mb-6 flex flex-col items-center text-center lg:hidden">
            <Image src="/brand/aircon-logo.png" alt="Aircon" width={192} height={192} className="h-48 w-48 object-contain" priority />
          </div>

          <div className="text-center lg:text-left">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">AIRCON</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">Masuk dan Kelola usaha servis AC Anda dari satu dashboard</p>
          </div>

          {error && (
            <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-400">
              Gagal masuk. Silakan coba lagi.
            </p>
          )}

          <div className="mt-6">
            <GoogleSignInButton next={next} />
            <p className="mt-2 text-center text-xs text-muted-foreground lg:text-left">Untuk pemilik usaha &amp; admin</p>
          </div>

          <div className="my-6 flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">atau</span>
            <Separator className="flex-1" />
          </div>

          <div className="grid gap-2">
            <Link href="/masuk-teknisi" className={buttonVariants({ variant: "outline", className: "min-h-[48px] gap-2" })}>
              <Icon.Mobile className="h-4 w-4" aria-hidden /> Masuk sebagai Teknisi
            </Link>
            <Link href="/pratinjau" className={buttonVariants({ variant: "ghost", className: "min-h-[48px] text-sky-600" })}>
              Lihat Pratinjau Aplikasi →
            </Link>
          </div>

          <p className="mt-8 text-center text-xs text-muted-foreground lg:text-left">
            Dengan masuk, Anda menyetujui ketentuan layanan Aircon.
          </p>
        </div>
      </div>
    </main>
  );
}
