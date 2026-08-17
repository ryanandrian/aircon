import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-white">
      {/* Header */}
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500 text-white font-bold">A</div>
          <span className="text-lg font-bold tracking-tight">Aircon</span>
        </div>
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/demo" className="text-slate-600 hover:text-slate-900">Demo</Link>
          <Link href="/login" className="rounded-lg bg-sky-500 px-4 py-2 font-medium text-white hover:bg-sky-600">Masuk</Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 pb-16 pt-10 text-center">
        <p className="mb-3 inline-block rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-700">
          Operating System untuk usaha servis AC
        </p>
        <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-5xl">
          Dapat customer, atur teknisi, dan buat customer{" "}
          <span className="text-sky-500">kembali otomatis</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
          Semua dari HP. Kelola job teknisi, jadwal yang jujur, dan pengingat servis
          otomatis lewat WhatsApp — supaya usaha AC Anda tumbuh tanpa ribet.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link href="/demo" className="rounded-xl bg-sky-500 px-6 py-3 font-semibold text-white shadow-lg shadow-sky-200 hover:bg-sky-600">
            Lihat Demo Langsung
          </Link>
          <Link href="/login" className="rounded-xl border border-slate-300 px-6 py-3 font-semibold text-slate-700 hover:bg-slate-50">
            Masuk
          </Link>
        </div>
      </section>

      {/* Value props */}
      <section className="mx-auto grid max-w-5xl gap-4 px-6 pb-20 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { t: "Dapat Customer", d: "Lead, referral, review, dan halaman booking online." },
          { t: "Kerjakan Job", d: "Job harian teknisi di HP: navigasi, foto, checklist, selesai." },
          { t: "Customer Kembali", d: "Pengingat servis otomatis → repeat order via WhatsApp." },
          { t: "Kontrol Bisnis", d: "Tahu apa yang terjadi: job, revenue, performa teknisi." },
        ].map((c) => (
          <div key={c.t} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-slate-900">{c.t}</h3>
            <p className="mt-2 text-sm text-slate-600">{c.d}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-500">
        Aircon — mobile-first field service untuk usaha AC. Dibangun untuk pilot.
      </footer>
    </main>
  );
}
