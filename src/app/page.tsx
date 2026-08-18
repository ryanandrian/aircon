import Link from "next/link";
import Image from "next/image";

export const metadata = {
  title: "Aircon — Software Usaha Servis AC: Pelanggan Datang Lagi Otomatis",
  description:
    "Aplikasi kasir & manajemen usaha AC dari HP. Terima booking online, atur teknisi, dan buat pelanggan servis ulang otomatis lewat WhatsApp. Gratis coba 14 hari.",
};

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <div className="flex items-center gap-2">
            <Image src="/brand/aircon-logo.png" alt="Aircon" width={32} height={32} className="h-8 w-8 object-contain" priority />
            <span className="text-lg font-bold tracking-tight">Aircon</span>
          </div>
          <nav className="flex items-center gap-2 text-sm">
            <Link href="/demo" className="rounded-lg px-3 py-2 font-medium text-slate-600 hover:bg-slate-100">Lihat Demo</Link>
            <Link href="/login" className="rounded-lg bg-sky-500 px-4 py-2 font-semibold text-white hover:bg-sky-600">Mulai Gratis</Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute -top-32 right-0 h-96 w-96 rounded-full bg-sky-100/60 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-5 pb-16 pt-14 text-center">
          <p className="mb-4 inline-block rounded-full border border-sky-200 bg-sky-50 px-4 py-1.5 text-xs font-semibold text-sky-700">
            Software usaha servis AC — dari HP, tanpa ribet
          </p>
          <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl">
            Pelanggan servis AC Anda{" "}
            <span className="text-sky-500">datang lagi otomatis</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
            Terima booking online, atur pekerjaan teknisi, dan ingatkan pelanggan servis berkala lewat WhatsApp —
            semua otomatis. Fokus kerja, biar Aircon yang jaga usaha Anda tetap ramai.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/login" className="w-full rounded-xl bg-sky-500 px-7 py-3.5 text-center font-semibold text-white shadow-lg shadow-sky-200 transition hover:bg-sky-600 sm:w-auto">
              Coba Gratis 14 Hari
            </Link>
            <Link href="/demo" className="w-full rounded-xl border border-slate-300 px-7 py-3.5 text-center font-semibold text-slate-700 transition hover:bg-slate-50 sm:w-auto">
              Lihat Demo Dulu
            </Link>
          </div>
          <p className="mt-3 text-xs text-slate-400">Tanpa kartu kredit · Bisa langsung dipakai · Berhenti kapan saja</p>
        </div>
      </section>

      {/* Argumen ekonomi — ROI */}
      <section className="border-y border-slate-100 bg-slate-50">
        <div className="mx-auto grid max-w-5xl gap-6 px-5 py-12 sm:grid-cols-3">
          <RoiStat angka="1 servis ulang" ket="Cukup 1 pelanggan servis ulang per bulan sudah menutup biaya langganan." />
          <RoiStat angka="±90 hari" ket="Aircon ingatkan pelanggan servis berikutnya otomatis — Anda tak perlu catat manual." />
          <RoiStat angka="0 job hilang" ket="Semua pekerjaan & pelanggan tercatat rapi. Tak ada lagi order yang lupa dikerjakan." />
        </div>
      </section>

      {/* Cara kerja — 3 langkah sederhana */}
      <section className="mx-auto max-w-5xl px-5 py-16">
        <h2 className="text-center text-2xl font-bold tracking-tight text-slate-900">Cara kerjanya sederhana</h2>
        <p className="mt-2 text-center text-slate-500">Dirancang untuk teknisi & pemilik usaha — bukan orang IT.</p>
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          <Step n="1" icon="📝" title="Catat pekerjaan" desc="Terima booking online atau catat sendiri. Tugaskan ke teknisi, pantau dari HP." />
          <Step n="2" icon="🔧" title="Teknisi kerjakan" desc="Teknisi buka job di HP: navigasi, checklist, foto bukti, selesai — semua tercatat." />
          <Step n="3" icon="🔁" title="Pelanggan datang lagi" desc="Aircon otomatis ingatkan pelanggan saat waktunya servis lagi, lewat WhatsApp." />
        </div>
      </section>

      {/* Untuk siapa */}
      <section className="bg-slate-50">
        <div className="mx-auto grid max-w-5xl gap-4 px-5 py-16 sm:grid-cols-2">
          <SegmentCard
            emoji="🧰"
            title="Teknisi / Usaha Perorangan"
            points={["Halaman booking online sendiri — terlihat profesional", "Ingat semua pelanggan & jadwal servis tanpa buku catatan", "Pelanggan servis ulang otomatis = penghasilan berulang"]}
          />
          <SegmentCard
            emoji="🏢"
            title="Perusahaan Servis AC"
            points={["Atur banyak teknisi & jadwal dalam satu layar", "Pantau performa & pekerjaan real-time", "Pemantauan AC pintar (IoT) → peluang servis otomatis"]}
            featured
          />
        </div>
      </section>

      {/* Booking page hook */}
      <section className="mx-auto max-w-5xl px-5 py-16">
        <div className="overflow-hidden rounded-3xl border border-sky-100 bg-gradient-to-br from-sky-50 to-white p-8 sm:p-10">
          <div className="grid items-center gap-6 sm:grid-cols-2">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">Punya halaman booking sendiri</h2>
              <p className="mt-3 text-slate-600">
                Setiap usaha dapat halaman online sendiri untuk dibagikan di status WhatsApp, Instagram, atau Google Maps.
                Pelanggan pesan servis kapan saja — order langsung masuk ke aplikasi Anda.
              </p>
              <Link href="/demo" className="mt-5 inline-flex rounded-xl bg-sky-500 px-6 py-3 font-semibold text-white transition hover:bg-sky-600">
                Lihat contohnya
              </Link>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500 font-bold text-white">S</div>
                <div className="text-sm font-semibold">AC Sejuk Jaya</div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {["Cuci AC", "Isi Freon", "Perbaikan", "Pasang Baru"].map((s) => (
                  <span key={s} className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700">{s}</span>
                ))}
              </div>
              <div className="mt-3 h-9 rounded-xl bg-emerald-500 text-center text-sm font-semibold leading-9 text-white">💬 Chat via WhatsApp</div>
              <div className="mt-2 h-9 rounded-xl border border-slate-200 text-center text-sm font-medium leading-9 text-slate-500">Booking Servis</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA akhir */}
      <section className="mx-auto max-w-3xl px-5 pb-20 text-center">
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Siap bikin usaha AC Anda lebih ramai?</h2>
        <p className="mt-3 text-slate-600">Coba gratis 14 hari. Tak perlu kartu kredit. Bisa langsung dipakai hari ini.</p>
        <Link href="/login" className="mt-6 inline-flex rounded-xl bg-sky-500 px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-sky-200 transition hover:bg-sky-600">
          Mulai Sekarang — Gratis
        </Link>
      </section>

      <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-400">
        Aircon — Operating System untuk usaha servis AC. Dari Lumite.
      </footer>
    </main>
  );
}

function RoiStat({ angka, ket }: { angka: string; ket: string }) {
  return (
    <div className="text-center sm:text-left">
      <div className="text-2xl font-extrabold text-sky-600">{angka}</div>
      <p className="mt-1 text-sm text-slate-600">{ket}</p>
    </div>
  );
}

function Step({ n, icon, title, desc }: { n: string; icon: string; title: string; desc: string }) {
  return (
    <div className="relative rounded-2xl border border-slate-200 bg-white p-6">
      <div className="absolute -top-3 left-6 flex h-7 w-7 items-center justify-center rounded-full bg-sky-500 text-sm font-bold text-white">{n}</div>
      <div className="mt-2 text-3xl">{icon}</div>
      <h3 className="mt-3 font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-600">{desc}</p>
    </div>
  );
}

function SegmentCard({ emoji, title, points, featured }: { emoji: string; title: string; points: string[]; featured?: boolean }) {
  return (
    <div className={`rounded-2xl border p-6 ${featured ? "border-sky-200 bg-white shadow-sm ring-1 ring-sky-100" : "border-slate-200 bg-white"}`}>
      <div className="text-3xl">{emoji}</div>
      <h3 className="mt-3 text-lg font-bold text-slate-900">{title}</h3>
      <ul className="mt-3 space-y-2">
        {points.map((p) => (
          <li key={p} className="flex items-start gap-2 text-sm text-slate-600">
            <span className="mt-0.5 text-sky-500" aria-hidden>✓</span>
            <span>{p}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
