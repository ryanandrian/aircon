/**
 * Halaman publik per tenant: /p/[slug]
 * Server Component. Ini WAJAH produk ke calon customer + alat "Get Customers":
 * setiap booking → Lead(source=WEBSITE, status=NEW) → mesin uang tenant.
 *
 * - 404 bila slug tak ada.
 * - SEO: generateMetadata dari nama usaha + OG tags (halaman publik di-index).
 * - Mobile-first, aksesibel, konsisten dgn src/app/page.tsx (sky-500, rounded-2xl).
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { normalizeBookingPhone } from "@/lib/validation/booking";
import { TenantLogo } from "@/components/tenant-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import BookingForm from "./booking-form";
import { Icon } from "@/components/icons";
import { Card, CardContent } from "@/components/ui/card";
import { resolvePublicView } from "@/lib/domain/public-profile";
import type { ComponentType } from "react";

type PageProps = { params: Promise<{ slug: string }> };

interface PublicProfileMeta {
  description?: string;
}
function asMeta(v: unknown): PublicProfileMeta {
  if (v && typeof v === "object") return v as PublicProfileMeta;
  return {};
}

// SECURITY: tenant-scoped — query by slug unik; hanya field publik yang diambil.
async function getTenant(slug: string) {
  return prisma.tenant.findUnique({
    where: { slug },
    select: {
      name: true,
      slug: true,
      phone: true,
      logoUrl: true,
      tagline: true,
      publicProfile: true,
      serviceArea: true,
    },
  });
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const tenant = await getTenant(slug);
  if (!tenant) {
    return { title: "Halaman tidak ditemukan" };
  }
  const profile = asMeta(tenant.publicProfile);
  const title = `${tenant.name} — Servis AC Terpercaya`;
  const description =
    profile.description ??
    `Booking servis AC di ${tenant.name}: cuci AC, isi freon, perbaikan, dan pemasangan. Pesan online, tim kami hubungi via WhatsApp.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      siteName: tenant.name,
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
    robots: { index: true, follow: true },
  };
}

export default async function PublicTenantPage({ params }: PageProps) {
  const { slug } = await params;
  const tenant = await getTenant(slug);
  if (!tenant) notFound();

  const view = resolvePublicView(tenant.publicProfile, tenant.serviceArea, tenant.tagline ?? null);
  const waPhone = normalizeBookingPhone(tenant.phone);
  const waHref = `https://wa.me/${waPhone}?text=${encodeURIComponent(
    `Halo ${tenant.name}, saya mau tanya soal servis AC.`,
  )}`;

  // Ikon sinyal percaya berputar (default 3); label dari tenant/bawaan.
  const trustIcons = [Icon.Zap, Icon.Check, Icon.Clock];
  const igHref = view.instagram
    ? view.instagram.startsWith("http")
      ? view.instagram
      : `https://instagram.com/${view.instagram.replace(/^@/, "")}`
    : null;

  return (
    <main className="min-h-screen bg-muted/30">
      {/* HERO gelap premium (senuansa halaman riwayat) */}
      <div className="relative overflow-hidden bg-gradient-to-br from-sky-900 via-sky-800 to-sky-700 px-5 pb-24 pt-9 text-center text-white">
        <div aria-hidden className="pointer-events-none absolute -left-10 bottom-6 h-48 w-48 rounded-full bg-white/5" />
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-10 h-56 w-56 rounded-full bg-cyan-400/10" />
        <div className="absolute right-4 top-4 z-10">
          <ThemeToggle className="text-white hover:bg-white/10 hover:text-white" />
        </div>
        <div className="relative mx-auto w-full max-w-lg">
          <div className="mx-auto w-fit rounded-3xl border-[3px] border-white/40 shadow-xl">
            <TenantLogo name={tenant.name} logoUrl={tenant.logoUrl} size={78} className="rounded-[1.15rem]" />
          </div>
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl">{tenant.name}</h1>
          {view.tagline && <p className="mt-1 text-sm font-semibold text-sky-200">{view.tagline}</p>}
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-white/85">{view.description}</p>
        </div>
      </div>

      <div className="mx-auto -mt-16 w-full max-w-lg px-5 pb-16">
        {/* Kartu konversi mengambang: WA + sinyal percaya */}
        <div className="animate-in-up relative z-10 rounded-3xl border bg-card p-4 shadow-xl shadow-sky-900/10">
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Chat WhatsApp dengan ${tenant.name}`}
            className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-emerald-500/25 transition hover:-translate-y-0.5 hover:bg-emerald-600 active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
          >
            <Icon.Message className="h-5 w-5" aria-hidden /> Chat via WhatsApp
          </a>
          <ul className="mt-3 grid grid-cols-3 gap-2 text-center">
            {view.trustBadges.map((b, i) => (
              <TrustBadge key={`${b.label}-${i}`} icon={trustIcons[i % trustIcons.length]} label={b.label} />
            ))}
          </ul>
        </div>

        {/* Jam operasional */}
        <div className="animate-in-up delay-75 mt-5 flex items-center gap-2 rounded-xl border bg-card px-4 py-3 text-sm">
          <Icon.Clock className="h-4 w-4 shrink-0 text-sky-500" aria-hidden />
          <span className="text-muted-foreground">Jam operasional:</span>
          <span className="font-medium text-foreground">{view.operatingHours}</span>
        </div>

        {/* Layanan */}
        <section className="mt-7" aria-labelledby="layanan-heading">
          <h2 id="layanan-heading" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Layanan Kami
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {view.services.map((s) => (
              <li key={s}>
                <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-3.5 py-1.5 text-sm font-medium text-sky-700 dark:border-sky-900/40 dark:bg-sky-950/40 dark:text-sky-300">
                  {s}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Area layanan */}
        {view.areaLabel && (
          <section className="mt-6" aria-labelledby="area-heading">
            <h2 id="area-heading" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Area Layanan
            </h2>
            <p className="mt-2 flex items-start gap-2 text-foreground/80">
              <Icon.Location className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" aria-hidden />
              <span>{view.areaLabel}</span>
            </p>
          </section>
        )}

        {/* Form booking */}
        <Card className="mt-8 shadow-sm" aria-labelledby="booking-heading">
          <CardContent className="p-6">
            <h2 id="booking-heading" className="text-xl font-bold text-foreground">Booking Servis</h2>
            <p className="mb-5 mt-1 text-sm text-muted-foreground">
              Isi form di bawah, tim kami akan segera menghubungi Anda.
            </p>
            <BookingForm slug={tenant.slug} />
          </CardContent>
        </Card>

        {/* Tautan sosial / Maps (disembunyikan bila kosong) */}
        {(igHref || view.mapUrl) && (
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {igHref && (
              <a href={igHref} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border bg-card px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted">
                <Icon.Web className="h-4 w-4 text-pink-500" aria-hidden /> Instagram
              </a>
            )}
            {view.mapUrl && (
              <a href={view.mapUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border bg-card px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted">
                <Icon.Location className="h-4 w-4 text-sky-500" aria-hidden /> Lihat Lokasi
              </a>
            )}
          </div>
        )}

        <footer className="mt-10 text-center text-xs text-muted-foreground">
          Ditenagai oleh{" "}
          <Link href="/" className="font-medium text-sky-500 hover:text-sky-600">Aircon</Link>
          {" "}— Operating System untuk usaha servis AC.
        </footer>
      </div>
    </main>
  );
}

function TrustBadge({ icon: IconCmp, label }: { icon: ComponentType<{ className?: string }>; label: string }) {
  return (
    <li className="rounded-xl border bg-card px-2 py-2">
      <div className="flex justify-center text-sky-500"><IconCmp className="h-5 w-5" aria-hidden /></div>
      <div className="mt-0.5 text-[11px] font-medium leading-tight text-muted-foreground">{label}</div>
    </li>
  );
}
