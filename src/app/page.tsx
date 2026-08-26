import Link from "next/link";
import Image from "next/image";
import type { ComponentType } from "react";
import { Icon } from "@/components/icons";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata = {
  title: "Aircon — Software Usaha Servis AC: Pelanggan Datang Lagi Otomatis",
  description:
    "Aplikasi kasir & manajemen usaha AC dari HP. Terima booking online, atur teknisi, dan buat pelanggan servis ulang otomatis lewat WhatsApp. Gratis coba 14 hari.",
};

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <div className="flex items-center gap-2">
            <Image src="/brand/aircon-logo.png" alt="Aircon" width={32} height={32} className="h-8 w-8 object-contain" priority />
            <span className="text-lg font-bold tracking-tight">Aircon</span>
          </div>
          <nav className="flex items-center gap-1.5 text-sm">
            <ThemeToggle />
            <Link href="/demo" className={buttonVariants({ variant: "ghost", size: "sm" })}>Lihat Demo</Link>
            <Link href="/login" className={buttonVariants({ size: "sm" })}>Mulai Gratis</Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute -top-32 right-0 h-96 w-96 rounded-full bg-sky-100/60 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-5 pb-16 pt-14 text-center">
          <Badge variant="secondary" className="mb-4 border-sky-200 bg-sky-50 text-sky-700">
            Software usaha servis AC — dari HP, tanpa ribet
          </Badge>
          <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-[1.1] tracking-tight text-foreground sm:text-5xl">
            Pelanggan servis AC Anda <span className="text-sky-500">datang lagi otomatis</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
            Terima booking online, atur pekerjaan teknisi, dan ingatkan pelanggan servis berkala lewat WhatsApp —
            semua otomatis. Fokus kerja, biar Aircon yang jaga usaha Anda tetap ramai.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/login" className={buttonVariants({ size: "lg", className: "w-full shadow-lg shadow-sky-200 sm:w-auto" })}>
              Coba Gratis 14 Hari
            </Link>
            <Link href="/demo" className={buttonVariants({ size: "lg", variant: "outline", className: "w-full sm:w-auto" })}>
              Lihat Demo Dulu
            </Link>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Tanpa kartu kredit · Bisa langsung dipakai · Berhenti kapan saja</p>
        </div>
      </section>

      {/* Argumen ekonomi — ROI */}
      <section className="border-y bg-muted/40">
        <div className="mx-auto grid max-w-5xl gap-6 px-5 py-12 sm:grid-cols-3">
          <RoiStat angka="1 servis ulang" ket="Cukup 1 pelanggan servis ulang per bulan sudah menutup biaya langganan." />
          <RoiStat angka="±90 hari" ket="Aircon ingatkan pelanggan servis berikutnya otomatis — Anda tak perlu catat manual." />
          <RoiStat angka="0 job hilang" ket="Semua pekerjaan & pelanggan tercatat rapi. Tak ada lagi order yang lupa dikerjakan." />
        </div>
      </section>

      {/* Cara kerja */}
      <section className="mx-auto max-w-5xl px-5 py-16">
        <h2 className="text-center text-2xl font-bold tracking-tight">Cara kerjanya sederhana</h2>
        <p className="mt-2 text-center text-muted-foreground">Dirancang untuk teknisi & pemilik usaha — bukan orang IT.</p>
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          <Step n="1" icon={Icon.Note} title="Catat pekerjaan" desc="Terima booking online atau catat sendiri. Tugaskan ke teknisi, pantau dari HP." />
          <Step n="2" icon={Icon.Wrench} title="Teknisi kerjakan" desc="Teknisi buka job di HP: navigasi, checklist, foto bukti, selesai — semua tercatat." />
          <Step n="3" icon={Icon.Repeat} title="Pelanggan datang lagi" desc="Aircon otomatis ingatkan pelanggan saat waktunya servis lagi, lewat WhatsApp." />
        </div>
      </section>

      {/* Untuk siapa */}
      <section className="bg-muted/40">
        <div className="mx-auto grid max-w-5xl gap-4 px-5 py-16 sm:grid-cols-2">
          <SegmentCard
            icon={Icon.Job}
            title="Teknisi / Usaha Perorangan"
            points={["Halaman booking online sendiri — terlihat profesional", "Ingat semua pelanggan & jadwal servis tanpa buku catatan", "Pelanggan servis ulang otomatis = penghasilan berulang"]}
          />
          <SegmentCard
            icon={Icon.Business}
            title="Perusahaan Servis AC"
            points={["Atur banyak teknisi & jadwal dalam satu layar", "Pantau performa & pekerjaan real-time", "Pemantauan AC pintar (IoT) → peluang servis otomatis"]}
            featured
          />
        </div>
      </section>

      {/* Booking page hook */}
      <section className="mx-auto max-w-5xl px-5 py-16">
        <Card className="overflow-hidden border-sky-100 bg-gradient-to-br from-sky-50 to-background">
          <CardContent className="grid items-center gap-6 p-8 sm:grid-cols-2 sm:p-10">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Punya halaman booking sendiri</h2>
              <p className="mt-3 text-muted-foreground">
                Setiap usaha dapat halaman online sendiri untuk dibagikan di status WhatsApp, Instagram, atau Google Maps.
                Pelanggan pesan servis kapan saja — order langsung masuk ke aplikasi Anda.
              </p>
              <Link href="/demo" className={buttonVariants({ className: "mt-5" })}>Lihat contohnya</Link>
            </div>
            <Card className="shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500 font-bold text-white">S</div>
                  <div className="text-sm font-semibold">AC Sejuk Jaya</div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {["Cuci AC", "Isi Freon", "Perbaikan", "Pasang Baru"].map((s) => (
                    <Badge key={s} variant="secondary" className="border-sky-200 bg-sky-50 text-sky-700">{s}</Badge>
                  ))}
                </div>
                <div className="mt-3 flex h-9 items-center justify-center gap-1.5 rounded-xl bg-emerald-500 text-sm font-semibold text-white"><Icon.Message className="h-4 w-4" aria-hidden /> Chat via WhatsApp</div>
                <div className="mt-2 h-9 rounded-xl border text-center text-sm font-medium leading-9 text-muted-foreground">Booking Servis</div>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      </section>

      {/* CTA akhir */}
      <section className="mx-auto max-w-3xl px-5 pb-20 text-center">
        <h2 className="text-3xl font-extrabold tracking-tight">Siap bikin usaha AC Anda lebih ramai?</h2>
        <p className="mt-3 text-muted-foreground">Coba gratis 14 hari. Tak perlu kartu kredit. Bisa langsung dipakai hari ini.</p>
        <Link href="/login" className={buttonVariants({ size: "lg", className: "mt-6 shadow-lg shadow-sky-200" })}>
          Mulai Sekarang — Gratis
        </Link>
      </section>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        Aircon — Operating System untuk usaha servis AC. Dari Lumite.
      </footer>
    </main>
  );
}

function RoiStat({ angka, ket }: { angka: string; ket: string }) {
  return (
    <div className="text-center sm:text-left">
      <div className="text-2xl font-extrabold text-sky-600">{angka}</div>
      <p className="mt-1 text-sm text-muted-foreground">{ket}</p>
    </div>
  );
}

function Step({ n, icon: IconCmp, title, desc }: { n: string; icon: ComponentType<{ className?: string }>; title: string; desc: string }) {
  return (
    <Card className="relative">
      <CardContent className="p-6">
        <div className="absolute -top-3 left-6 flex h-7 w-7 items-center justify-center rounded-full bg-sky-500 text-sm font-bold text-white">{n}</div>
        <div className="mt-2 text-sky-500"><IconCmp className="h-8 w-8" /></div>
        <h3 className="mt-3 font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
      </CardContent>
    </Card>
  );
}

function SegmentCard({ icon: IconCmp, title, points, featured }: { icon: ComponentType<{ className?: string }>; title: string; points: string[]; featured?: boolean }) {
  return (
    <Card className={featured ? "ring-1 ring-sky-100" : ""}>
      <CardContent className="p-6">
        <div className="text-sky-500"><IconCmp className="h-8 w-8" /></div>
        <h3 className="mt-3 text-lg font-bold">{title}</h3>
        <ul className="mt-3 space-y-2">
          {points.map((p) => (
            <li key={p} className="flex items-start gap-2 text-sm text-muted-foreground">
              <Icon.Check className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" aria-hidden />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
