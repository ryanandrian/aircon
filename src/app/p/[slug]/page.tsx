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
import { prisma } from "@/lib/prisma";
import { normalizeBookingPhone } from "@/lib/validation/booking";
import BookingForm from "./booking-form";

type PageProps = { params: Promise<{ slug: string }> };

/** Bentuk longgar publicProfile (Json?) — parse defensif tanpa any. */
interface PublicProfile {
  description?: string;
  services?: string[];
  tagline?: string;
}
interface ServiceArea {
  cities?: string[];
  districts?: string[];
}

function asPublicProfile(v: unknown): PublicProfile {
  if (v && typeof v === "object") return v as PublicProfile;
  return {};
}
function asServiceArea(v: unknown): ServiceArea {
  if (v && typeof v === "object") return v as ServiceArea;
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
  const profile = asPublicProfile(tenant.publicProfile);
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

  const profile = asPublicProfile(tenant.publicProfile);
  const area = asServiceArea(tenant.serviceArea);
  const waPhone = normalizeBookingPhone(tenant.phone);
  const waHref = `https://wa.me/${waPhone}?text=${encodeURIComponent(
    `Halo ${tenant.name}, saya mau tanya soal servis AC.`,
  )}`;

  const services =
    profile.services && profile.services.length
      ? profile.services
      : ["Cuci AC", "Isi Freon", "Perbaikan", "Pasang Baru", "Pengecekan"];

  const cities = area.cities ?? [];
  const districts = area.districts ?? [];
  const areaLabel = [...cities, ...districts].join(", ");

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-white">
      <div className="mx-auto w-full max-w-lg px-5 pb-16 pt-8">
        {/* Header usaha */}
        <header className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-500 text-2xl font-bold text-white shadow-lg shadow-sky-200">
            {tenant.name.charAt(0).toUpperCase()}
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            {tenant.name}
          </h1>
          {profile.tagline && (
            <p className="mt-1 text-sm font-medium text-sky-600">
              {profile.tagline}
            </p>
          )}
          <p className="mx-auto mt-3 max-w-md text-slate-600">
            {profile.description ??
              "Servis AC cepat, jujur, dan profesional. Pesan online — tim kami akan menghubungi Anda via WhatsApp."}
          </p>
        </header>

        {/* Tombol WhatsApp */}
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Chat WhatsApp dengan ${tenant.name}`}
          className="mt-6 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
        >
          <span aria-hidden="true">💬</span> Chat via WhatsApp
        </a>

        {/* Sinyal percaya (jujur, benar untuk semua usaha) */}
        <ul className="mt-4 grid grid-cols-3 gap-2 text-center">
          <TrustBadge icon="⚡" label="Respons cepat" />
          <TrustBadge icon="✅" label="Dikonfirmasi WhatsApp" />
          <TrustBadge icon="🕐" label="Pesan online 24 jam" />
        </ul>

        {/* Layanan */}
        <section className="mt-8" aria-labelledby="layanan-heading">
          <h2
            id="layanan-heading"
            className="text-sm font-semibold uppercase tracking-wide text-slate-500"
          >
            Layanan Kami
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {services.map((s) => (
              <li
                key={s}
                className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-700"
              >
                {s}
              </li>
            ))}
          </ul>
        </section>

        {/* Area layanan */}
        {areaLabel && (
          <section className="mt-6" aria-labelledby="area-heading">
            <h2
              id="area-heading"
              className="text-sm font-semibold uppercase tracking-wide text-slate-500"
            >
              Area Layanan
            </h2>
            <p className="mt-2 text-slate-700">{areaLabel}</p>
          </section>
        )}

        {/* Form booking */}
        <section
          className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          aria-labelledby="booking-heading"
        >
          <h2
            id="booking-heading"
            className="text-xl font-bold text-slate-900"
          >
            Booking Servis
          </h2>
          <p className="mb-5 mt-1 text-sm text-slate-600">
            Isi form di bawah, tim kami akan segera menghubungi Anda.
          </p>
          <BookingForm slug={tenant.slug} />
        </section>

        <footer className="mt-10 text-center text-xs text-slate-400">
          Ditenagai oleh{" "}
          <a href="/" className="font-medium text-sky-500 hover:text-sky-600">Aircon</a>
          {" "}— Operating System untuk usaha servis AC.
        </footer>
      </div>
    </main>
  );
}

function TrustBadge({ icon, label }: { icon: string; label: string }) {
  return (
    <li className="rounded-xl border border-slate-200 bg-white px-2 py-2">
      <div className="text-lg" aria-hidden>{icon}</div>
      <div className="mt-0.5 text-[11px] font-medium leading-tight text-slate-600">{label}</div>
    </li>
  );
}
