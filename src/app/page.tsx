import Link from "next/link";
import Image from "next/image";
import type { ComponentType } from "react";
import { Icon } from "@/components/icons";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { getActivePlans, getBillingPolicy, withTax } from "@/lib/billing/config";
import { getLandingContent, listTestimonials, listPreviewItems } from "@/lib/services/landing-service";

export const metadata = {
  title: "Aircon — Software Usaha Servis AC: Pelanggan Datang Lagi Otomatis",
  description:
    "Aplikasi kasir & manajemen usaha AC dari HP. Terima booking online, atur teknisi, buat invoice profesional, dan buat pelanggan servis ulang otomatis lewat WhatsApp. Gratis selamanya.",
};

export const dynamic = "force-dynamic";

const rupiah = (n: number) => new Intl.NumberFormat("id-ID").format(n);

export default async function Home() {
  const [plans, policy, c, testimonials, previews] = await Promise.all([
    getActivePlans(),
    getBillingPolicy(),
    getLandingContent(),
    listTestimonials(true),
    listPreviewItems(true),
  ]);
  const logo = c.logoUrl || "/brand/aircon-logo.png";
  const csWa = (c.csWhatsapp || "").replace(/[^0-9]/g, "");
  const csWaUrl = csWa
    ? `https://wa.me/${csWa}?text=${encodeURIComponent("Halo Lumite, saya tertarik dengan solusi Full Custom Aircon untuk perusahaan saya.")}`
    : "";

  // JSON-LD structured data — bantu Google rich results + rekomendasi AI memahami produk.
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://aircon-peach.vercel.app/#org",
        name: "PT. Lumite Automasi Indonesia",
        url: "https://aircon-peach.vercel.app",
        brand: { "@type": "Brand", name: "Aircon" },
      },
      {
        "@type": "SoftwareApplication",
        name: "Aircon",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web, Android, iOS (PWA)",
        description:
          "Aplikasi manajemen usaha servis AC: booking online, atur teknisi & jadwal, invoice profesional, pantau piutang, insentif teknisi, dan pengingat servis otomatis lewat WhatsApp.",
        inLanguage: "id-ID",
        url: "https://aircon-peach.vercel.app",
        publisher: { "@id": "https://aircon-peach.vercel.app/#org" },
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "IDR",
          description: "Paket Basic gratis selamanya untuk usaha kecil.",
        },
        featureList: [
          "Booking online", "Manajemen teknisi & jadwal", "Invoice & kwitansi profesional",
          "Pemantauan piutang", "Insentif teknisi otomatis", "Kartu riwayat AC online",
          "Pengingat servis via WhatsApp",
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: [
          { "@type": "Question", name: "Apakah Aircon ribet dipakai?", acceptedAnswer: { "@type": "Answer", text: "Tidak. Aircon dibuat untuk teknisi & pemilik usaha AC. Semua dari HP, bahasa Indonesia, langsung bisa dipakai tanpa pelatihan khusus." } },
          { "@type": "Question", name: "Apakah Aircon gratis?", acceptedAnswer: { "@type": "Answer", text: "Ya, paket Basic gratis selamanya. Anda hanya membayar bila memilih upgrade ke paket berbayar saat usaha tumbuh." } },
          { "@type": "Question", name: "Bagaimana pelanggan tahu waktunya servis lagi?", acceptedAnswer: { "@type": "Answer", text: "Otomatis. Setiap pekerjaan selesai membuat pengingat, dan saat waktunya tiba pelanggan dikabari lewat WhatsApp." } },
        ],
      },
    ],
  };

  return (
    <main className="min-h-screen bg-background">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {/* Header */}
      <header className="sticky top-0 z-30 border-b bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <Image src={logo} alt="Aircon" width={32} height={32} className="h-8 w-8 shrink-0 object-contain" priority />
            <span className="truncate text-lg font-bold tracking-tight">Aircon</span>
          </div>
          <nav className="flex shrink-0 items-center gap-1 text-sm">
            <div className="hidden items-center gap-1 sm:flex">
              {c.showPricing && <Link href="#harga" className={buttonVariants({ variant: "ghost", size: "sm" })}>Harga</Link>}
              {c.showPreview && <Link href="/pratinjau" className={buttonVariants({ variant: "ghost", size: "sm" })}>Pratinjau</Link>}
            </div>
            <ThemeToggle />
            <Link href="/login" className={buttonVariants({ variant: "ghost", size: "sm" })}>Masuk</Link>
            <Link href="/login" className={buttonVariants({ size: "sm" })}>Mulai Gratis</Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute -top-40 right-0 h-[32rem] w-[32rem] rounded-full bg-sky-200/40 blur-3xl dark:bg-sky-500/10" />
        <div aria-hidden className="pointer-events-none absolute -bottom-40 -left-20 h-[28rem] w-[28rem] rounded-full bg-cyan-200/30 blur-3xl dark:bg-cyan-500/10" />
        <div className="relative mx-auto max-w-6xl px-5 pb-8 pt-16 text-center">
          <Badge variant="secondary" className="animate-fade mb-5 border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/40 dark:bg-sky-950/40 dark:text-sky-300">
            {c.heroBadge}
          </Badge>
          <h1 className="animate-in-up mx-auto max-w-3xl text-4xl font-extrabold leading-[1.08] tracking-tight text-foreground sm:text-6xl">
            {c.heroTitle} <span className="bg-gradient-to-r from-sky-500 to-cyan-500 bg-clip-text text-transparent">{c.heroTitleAccent}</span>
          </h1>
          <p className="animate-in-up delay-75 mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            {c.heroSubtitle}
          </p>
          <div className="animate-in-up delay-150 mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/login" className={buttonVariants({ size: "lg", className: "w-full shadow-lg shadow-sky-500/20 sm:w-auto" })}>
              {c.heroCtaPrimary}
            </Link>
            {c.showPreview && (
              <Link href="/pratinjau" className={buttonVariants({ size: "lg", variant: "outline", className: "w-full border-orange-300 bg-orange-50 text-orange-700 hover:border-orange-400 hover:bg-orange-100 hover:text-orange-800 dark:border-orange-900/50 dark:bg-orange-950/30 dark:text-orange-300 dark:hover:bg-orange-950/50 sm:w-auto" })}>
                {c.heroCtaSecondary}
              </Link>
            )}
          </div>
          <p className="animate-in-up delay-150 mt-3 animate-pulse-soft text-xs font-medium text-sky-600 dark:text-sky-400">{c.heroMicrocopy}</p>

          {/* Product visual mock (atau gambar hero kustom) */}
          <div className="animate-in-up delay-300 mx-auto mt-14 max-w-4xl">
            {c.heroImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.heroImageUrl} alt="Tampilan Aircon" className="w-full rounded-2xl border shadow-lg" />
            ) : (
            <div className="rounded-2xl border bg-card p-2 shadow-lg sm:p-3">
              <div className="rounded-xl border bg-muted/40 p-4 sm:p-6">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <MockStat icon={Icon.Job} label="Pekerjaan" value="12" tone="sky" />
                  <MockStat icon={Icon.Wrench} label="Berjalan" value="3" tone="slate" />
                  <MockStat icon={Icon.Bell} label="Pengingat" value="27" tone="violet" />
                  <MockStat icon={Icon.Money} label="Bulan ini" value="Rp8,4jt" tone="emerald" />
                </div>
                <div className="mt-3 flex items-center gap-3 rounded-xl border bg-card p-3 text-left">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-500 text-white"><Icon.Repeat className="h-4.5 w-4.5" aria-hidden /></div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-foreground">Pengingat servis → Ibu Sari (Daikin ¾ PK)</div>
                    <div className="truncate text-xs text-muted-foreground">Terkirim via WhatsApp otomatis · jatuh tempo hari ini</div>
                  </div>
                  <Badge className="ml-auto shrink-0 bg-emerald-500 text-white hover:bg-emerald-500">Terkirim</Badge>
                </div>
              </div>
            </div>
            )}
          </div>
        </div>
      </section>

      {/* Trust bar */}
      {c.showRoi && (
      <section className="border-y bg-muted/30">
        <div className="mx-auto grid max-w-5xl gap-6 px-5 py-12 sm:grid-cols-3">
          <RoiStat angka="1 servis ulang" ket="Cukup 1 pelanggan servis ulang per bulan sudah menutup biaya langganan." />
          <RoiStat angka="±90 hari" ket="Aircon ingatkan pelanggan servis berikutnya otomatis — Anda tak perlu catat manual." />
          <RoiStat angka="0 job hilang" ket="Semua pekerjaan & pelanggan tercatat rapi. Tak ada lagi order yang lupa dikerjakan." />
        </div>
      </section>
      )}

      {/* Cara kerja */}
      {c.showHow && (
      <section className="mx-auto max-w-5xl px-5 py-20">
        <h2 className="text-center text-3xl font-bold tracking-tight">{c.howTitle}</h2>
        <p className="mt-2 text-center text-muted-foreground">{c.howSubtitle}</p>
        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          <Step n="1" icon={Icon.Note} title="Catat pekerjaan" desc="Terima booking online atau catat sendiri. Tugaskan ke teknisi, pantau dari HP." />
          <Step n="2" icon={Icon.Wrench} title="Teknisi kerjakan" desc="Teknisi buka job di HP: navigasi, checklist, foto bukti, selesai — semua tercatat." />
          <Step n="3" icon={Icon.Repeat} title="Pelanggan datang lagi" desc="Aircon otomatis ingatkan pelanggan saat waktunya servis lagi, lewat WhatsApp." />
        </div>
        {c.showPreview && (
          <div className="mt-10 text-center">
            <Link href="/pratinjau" className={buttonVariants({ variant: "outline", size: "lg", className: "gap-2 border-orange-300 bg-orange-50 text-orange-700 hover:border-orange-400 hover:bg-orange-100 hover:text-orange-800 dark:border-orange-900/50 dark:bg-orange-950/30 dark:text-orange-300 dark:hover:bg-orange-950/50" })}>
              <Icon.Web className="h-4.5 w-4.5" aria-hidden />
              Lihat Pratinjau Aplikasi
            </Link>
            <p className="mt-2 text-xs text-muted-foreground">Intip tampilan & fitur Aircon sebelum mulai.</p>
          </div>
        )}
      </section>
      )}

      {/* Fitur unggulan (Fase 2-7) */}
      {c.showFeatures && (
      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight">{c.featuresTitle}</h2>
          <p className="mx-auto mt-2 max-w-2xl text-muted-foreground">{c.featuresSubtitle}</p>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon={Icon.Note}
            title="Invoice & kwitansi profesional"
            desc="Selesai kerja, faktur rapi ber-logo usaha Anda langsung jadi dan bisa dikirim ke pelanggan lewat WhatsApp — tak perlu lagi nota tulis tangan."
          />
          <FeatureCard
            icon={Icon.Chart}
            title="Pantau pembayaran & piutang"
            desc="Lihat sekilas siapa yang sudah bayar dan mana yang belum jatuh tempo. Tak ada lagi tagihan yang terlewat."
          />
          <FeatureCard
            icon={Icon.Money}
            title="Insentif teknisi otomatis"
            desc="Bonus tiap teknisi dihitung otomatis dari pekerjaan yang lunas — adil dan transparan, tanpa hitung manual."
          />
          <FeatureCard
            icon={Icon.Web}
            title="Kartu riwayat AC online untuk pelanggan"
            desc="Setiap unit AC punya halaman riwayat yang bisa dibuka pelanggan: kapan terakhir diservis dan apa yang dikerjakan. Menambah kepercayaan tanpa repot."
            featured
          />
          <FeatureCard
            icon={Icon.Catalog}
            title="Daftar layanan & harga rapi"
            desc="Simpan layanan beserta harganya — bahkan harga khusus untuk pelanggan langganan. Teknisi tinggal pilih, harga selalu konsisten."
          />
          <FeatureCard
            icon={Icon.Users}
            title="Kelola tim & jadwal"
            desc="Tugaskan beberapa teknisi dalam satu pekerjaan, atur peran, dan pantau semuanya dari satu layar."
          />
        </div>
      </section>
      )}

      {/* Untuk siapa */}
      {c.showSegments && (
      <section className="bg-muted/30">
        <div className="mx-auto grid max-w-5xl gap-4 px-5 py-20 sm:grid-cols-2">
          <SegmentCard
            icon={Icon.Job}
            title="Teknisi / Usaha Perorangan"
            points={["Halaman booking online sendiri — terlihat profesional", "Ingat semua pelanggan & jadwal servis tanpa buku catatan", "Pelanggan servis ulang otomatis = penghasilan berulang"]}
          />
          <SegmentCard
            icon={Icon.Business}
            title="Perusahaan Servis AC"
            points={["Kelola banyak teknisi, jadwal, invoice, dan piutang dalam satu layar", "Insentif teknisi terhitung otomatis, laporan keuangan rapi", "Pemantauan AC pintar (IoT) membuka peluang servis berkala"]}
            featured
          />
        </div>
      </section>
      )}

      {/* TESTIMONI — marquee 1 baris, auto-scroll perlahan, berhenti saat hover */}
      {c.showTestimonials && testimonials.length > 0 && (
      <section className="py-20">
        <h2 className="px-5 text-center text-3xl font-bold tracking-tight">Pendapat Mitra kami yang telah menggunakan Aircon</h2>
        <div className="marquee-mask mt-12 w-full overflow-x-hidden py-4">
          <div className="marquee-track gap-5 px-5">
            {[...testimonials, ...testimonials].map((t, i) => (
              <Card key={`${t.id}-${i}`} className="w-[19rem] shrink-0 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, s) => (
                      <Icon.Star
                        key={s}
                        className={`h-4 w-4 ${s < Math.max(1, Math.min(5, t.rating)) ? "fill-amber-400 text-amber-400" : "fill-muted text-muted-foreground/30"}`}
                        aria-hidden
                      />
                    ))}
                  </div>
                  <p className="mt-3 line-clamp-4 text-sm text-foreground">&ldquo;{t.quote}&rdquo;</p>
                  <div className="mt-4 flex items-center gap-3">
                    {t.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.photoUrl} alt={t.name} className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-500 font-bold text-white">{t.name.charAt(0).toUpperCase()}</div>
                    )}
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-foreground">{t.name}</div>
                      {t.business && <div className="truncate text-xs text-muted-foreground">{t.business}</div>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* HARGA — transparan, dari DB */}
      {c.showPricing && (
      <section id="harga" className="mx-auto max-w-5xl scroll-mt-20 px-5 py-20">
        <h2 className="text-center text-3xl font-bold tracking-tight">Harga jujur, tanpa kejutan</h2>
        <p className="mt-2 text-center text-muted-foreground">Paket Basic gratis selamanya. Upgrade hanya bila usaha Anda tumbuh. Tanpa kartu kredit.</p>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((p, i) => {
            const t = withTax(p.priceMonthly, p.taxable ? policy.taxPercent : 0);
            const featured = i === 1;
            return (
              <Card key={p.id} className={`relative flex flex-col ${featured ? "ring-2 ring-sky-500 shadow-lg" : ""}`}>
                <CardContent className="flex flex-1 flex-col p-6">
                  {featured && <Badge className="mb-3 w-fit bg-sky-500 text-white hover:bg-sky-500">Paling Populer</Badge>}
                  <div className="text-lg font-bold text-foreground">{p.displayName}</div>
                  {p.tagline && <div className="mt-1 text-sm text-muted-foreground">{p.tagline}</div>}
                  <div className="mt-5">
                    {p.priceMonthly === 0 ? (
                      <div className="text-3xl font-extrabold text-foreground">Gratis</div>
                    ) : (
                      <>
                        <div className="text-3xl font-extrabold text-foreground">Rp{rupiah(p.priceMonthly)}<span className="text-base font-medium text-muted-foreground">/bln</span></div>
                        {p.taxable && policy.taxPercent > 0 && <div className="mt-1 text-xs text-muted-foreground">Rp{rupiah(t.total)} termasuk pajak {policy.taxPercent}%</div>}
                      </>
                    )}
                  </div>
                  <ul className="mt-5 flex-1 space-y-2 text-sm">
                    <PlanFeature text={p.maxTechnicians ? `${p.maxTechnicians} akun teknisi` : "Teknisi tanpa batas"} />
                    <PlanFeature text={p.maxCustomers ? `${rupiah(p.maxCustomers)} pelanggan` : "Pelanggan tanpa batas"} />
                    <PlanFeature text={p.maxAcUnits ? `${rupiah(p.maxAcUnits)} unit AC` : "Unit AC tanpa batas"} />
                    <PlanFeature text="Booking online + pengingat WhatsApp" />
                  </ul>
                  <Link href="/login" className={buttonVariants({ variant: featured ? "default" : "outline", className: "mt-6 w-full" })}>
                    {p.priceMonthly === 0 ? "Mulai Gratis" : "Pilih Paket"}
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Tier Full Custom — melebar penuh, CTA ke WhatsApp CS Lumite */}
        <Card className="mt-5 overflow-hidden border-sky-200 bg-gradient-to-br from-sky-50 to-cyan-50 dark:border-sky-900/40 dark:from-sky-950/30 dark:to-cyan-950/20">
          <CardContent className="flex flex-col items-start gap-6 p-8 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-2xl">
              <Badge className="mb-3 bg-sky-600 text-white hover:bg-sky-600">Full Custom</Badge>
              <h3 className="text-xl font-bold text-foreground">{c.customTierTitle}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.customTierDesc}</p>
            </div>
            <div className="w-full shrink-0 text-left sm:w-auto sm:text-right">
              <div className="text-2xl font-extrabold text-foreground">Hubungi CS Kami</div>
              <div className="text-xs text-muted-foreground">Konsultasi gratis, tanpa komitmen</div>
              {csWaUrl ? (
                <a href={csWaUrl} target="_blank" rel="noopener noreferrer" className={buttonVariants({ className: "mt-4 w-full gap-2 bg-emerald-600 hover:bg-emerald-700 sm:w-auto" })}>
                  <Icon.Message className="h-4.5 w-4.5" aria-hidden />
                  Hubungi via WhatsApp
                </a>
              ) : (
                <span className={buttonVariants({ variant: "outline", className: "mt-4 w-full cursor-not-allowed opacity-60 sm:w-auto" })}>
                  Nomor CS belum diatur
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </section>
      )}

      {/* FAQ — jawab keberatan */}
      {c.showFaq && (
      <section className="bg-muted/30">
        <div className="mx-auto max-w-3xl px-5 py-20">
          <h2 className="text-center text-3xl font-bold tracking-tight">Pertanyaan yang sering ditanya</h2>
          <div className="mt-10 space-y-3">
            <Faq q="Ribet nggak?" a="Tidak. Aircon dibuat untuk teknisi & pemilik usaha. Semua dari HP, bahasa Indonesia, langsung bisa dipakai hari ini — tanpa pelatihan khusus." />
            <Faq q="HP saya biasa saja, muat nggak?" a="Muat. Aircon ringan dan berjalan di browser HP mana pun. Tidak perlu install aplikasi berat dari toko aplikasi." />
            <Faq q="Data pelanggan saya aman?" a="Aman. Data tersimpan terpisah per usaha, terenkripsi, dan hanya bisa diakses akun Anda. Foto bukti & rekening disimpan aman." />
            <Faq q="Kalau saya berhenti bagaimana?" a="Bebas berhenti kapan saja tanpa penalti. Paket Basic gratis selamanya — Anda hanya membayar bila memilih upgrade ke paket berbayar." />
            <Faq q="Bagaimana pelanggan tahu waktunya servis lagi?" a="Otomatis. Setiap pekerjaan selesai membuat pengingat, dan saat waktunya tiba pelanggan dikabari lewat WhatsApp — Anda tak perlu mengingat-ingat." />
          </div>
        </div>
      </section>
      )}

      {/* CTA akhir */}
      <section className="mx-auto max-w-3xl px-5 py-24 text-center">
        <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{c.ctaTitle}</h2>
        <p className="mt-3 text-muted-foreground">{c.ctaSubtitle}</p>
        <Link href="/login" className={buttonVariants({ size: "lg", className: "mt-7 shadow-lg shadow-sky-500/20" })}>
          {c.ctaButton}
        </Link>
      </section>

      <footer className="border-t py-10 text-center text-sm text-muted-foreground">
        {c.footerTagline}
      </footer>
    </main>
  );
}

function MockStat({ icon: IconCmp, label, value, tone }: { icon: ComponentType<{ className?: string }>; label: string; value: string; tone: "sky" | "violet" | "emerald" | "slate" }) {
  const tones = {
    sky: "text-sky-500", violet: "text-violet-500", emerald: "text-emerald-500", slate: "text-muted-foreground",
  };
  return (
    <div className="rounded-xl border bg-card p-3 text-left">
      <div className={tones[tone]}><IconCmp className="h-5 w-5" aria-hidden /></div>
      <div className="mt-1.5 text-lg font-bold tabular-nums text-foreground">{value}</div>
      <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
    </div>
  );
}

function RoiStat({ angka, ket }: { angka: string; ket: string }) {
  return (
    <div className="text-center sm:text-left">
      <div className="text-2xl font-extrabold text-sky-600 dark:text-sky-400">{angka}</div>
      <p className="mt-1 text-sm text-muted-foreground">{ket}</p>
    </div>
  );
}

function Step({ n, icon: IconCmp, title, desc }: { n: string; icon: ComponentType<{ className?: string }>; title: string; desc: string }) {
  return (
    <Card className="interactive">
      <CardContent className="p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-500 text-sm font-bold text-white shadow-sm">{n}</span>
          <span className="text-sky-500"><IconCmp className="h-7 w-7" /></span>
        </div>
        <h3 className="mt-4 font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
      </CardContent>
    </Card>
  );
}

function SegmentCard({ icon: IconCmp, title, points, featured }: { icon: ComponentType<{ className?: string }>; title: string; points: string[]; featured?: boolean }) {
  return (
    <Card className={`interactive ${featured ? "ring-1 ring-sky-200 dark:ring-sky-900/50" : ""}`}>
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

function FeatureCard({ icon: IconCmp, title, desc, featured }: { icon: ComponentType<{ className?: string }>; title: string; desc: string; featured?: boolean }) {
  return (
    <Card className={`interactive h-full ${featured ? "ring-1 ring-sky-200 dark:ring-sky-900/50" : ""}`}>
      <CardContent className="p-6">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400">
          <IconCmp className="h-6 w-6" aria-hidden />
        </div>
        <h3 className="mt-4 font-semibold text-foreground">{title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{desc}</p>
      </CardContent>
    </Card>
  );
}

function PlanFeature({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2 text-muted-foreground">
      <Icon.Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
      <span>{text}</span>
    </li>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <details className="group rounded-xl border bg-card px-5 py-4 [&_summary]:cursor-pointer">
      <summary className="flex items-center justify-between gap-3 font-semibold text-foreground marker:content-none">
        {q}
        <Icon.Bell className="hidden" aria-hidden />
        <span className="shrink-0 text-muted-foreground transition-transform group-open:rotate-45">+</span>
      </summary>
      <p className="mt-2 text-sm text-muted-foreground">{a}</p>
    </details>
  );
}
