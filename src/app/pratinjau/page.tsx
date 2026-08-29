import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/icons";
import { ThemeToggle } from "@/components/theme-toggle";
import { getLandingContent, listPreviewItems } from "@/lib/services/landing-service";
import { PreviewGallery } from "./gallery";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Pratinjau Aircon — Lihat Tampilan & Fitur Aplikasi Usaha Servis AC",
  description:
    "Intip langsung tampilan Aircon: booking online, catat pekerjaan, invoice profesional, laporan keuangan, dan kartu riwayat AC. Bayangkan bagaimana Aircon membantu usaha AC Anda.",
};

export default async function PratinjauPage() {
  const [c, items] = await Promise.all([getLandingContent(), listPreviewItems(true)]);
  if (!c.showPreview) notFound();
  const logo = c.logoUrl || "/brand/aircon-logo.png";

  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3 sm:px-5">
          <Link href="/" className="flex min-w-0 items-center gap-2">
            <Image src={logo} alt="Aircon" width={32} height={32} className="h-8 w-8 shrink-0 object-contain" priority />
            <span className="truncate text-lg font-bold tracking-tight">Aircon</span>
          </Link>
          <nav className="flex shrink-0 items-center gap-1 text-sm">
            <ThemeToggle />
            <Link href="/" className={buttonVariants({ variant: "ghost", size: "sm" })}>Beranda</Link>
            <Link href="/login" className={buttonVariants({ size: "sm" })}>Mulai Gratis</Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 pb-8 pt-14 text-center">
        <Badge variant="secondary" className="mb-5 border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/40 dark:bg-sky-950/40 dark:text-sky-300">
          Pratinjau Aplikasi
        </Badge>
        <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-[1.1] tracking-tight text-foreground sm:text-5xl">
          Lihat Aircon dari dalam
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
          Tangkapan layar nyata dari aplikasi — bayangkan bagaimana Aircon merapikan pekerjaan, tagihan, dan pelanggan usaha AC Anda.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-24">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-muted/30 p-16 text-center">
            <Icon.Web className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden />
            <p className="mt-3 text-muted-foreground">Pratinjau sedang disiapkan. Silakan kembali lagi nanti.</p>
            <Link href="/login" className={buttonVariants({ className: "mt-6" })}>Mulai Gratis Sekarang</Link>
          </div>
        ) : (
          <PreviewGallery items={items.map((i) => ({ id: i.id, title: i.title, caption: i.caption, imageUrl: i.imageUrl, category: i.category }))} />
        )}
      </section>

      <section className="mx-auto max-w-3xl px-5 pb-24 text-center">
        <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Siap mencobanya sendiri?</h2>
        <p className="mt-3 text-muted-foreground">Gratis selamanya untuk mulai. Tanpa kartu kredit.</p>
        <Link href="/login" className={buttonVariants({ size: "lg", className: "mt-6 shadow-lg shadow-sky-500/20" })}>
          Mulai Sekarang — Gratis Selamanya
        </Link>
      </section>

      <footer className="border-t py-10 text-center text-sm text-muted-foreground">
        {c.footerTagline}
      </footer>
    </main>
  );
}
