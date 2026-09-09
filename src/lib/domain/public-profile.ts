/**
 * Public Profile — SATU sumber bentuk + DEFAULT untuk halaman usaha publik /p/[slug].
 * publicProfile & serviceArea disimpan sebagai Json di Tenant (nol migrasi).
 * Konsumen: halaman /p (baca dgn default) + editor Pengaturan (baca nilai tenant apa adanya).
 */

export interface TrustBadge {
  label: string;
}

/** Bentuk lengkap konfigurasi halaman publik (semua opsional saat disimpan). */
export interface PublicProfile {
  description?: string;
  tagline?: string;
  services?: string[];
  operatingHours?: string;
  trustBadges?: TrustBadge[];
  instagram?: string;
  mapUrl?: string;
  /** Prioritas 3 (menyusul): logo klien. Belum diedit di UI Fase 1. */
  customers?: { name: string; logoUrl: string }[];
}

export interface ServiceArea {
  cities?: string[];
  districts?: string[];
}

/** DEFAULT layanan — dipakai bila tenant belum mengisi. */
export const DEFAULT_SERVICES = ["Cuci AC", "Isi Freon", "Perbaikan", "Pasang Baru", "Pengecekan"];

/** DEFAULT trust badge (3) — teks bisa diganti tenant. */
export const DEFAULT_TRUST_BADGES: TrustBadge[] = [
  { label: "Respons cepat" },
  { label: "Dikonfirmasi WhatsApp" },
  { label: "Pesan online 24 jam" },
];

export const DEFAULT_OPERATING_HOURS = "Setiap hari, 08.00–17.00";

export const DEFAULT_DESCRIPTION =
  "Servis AC cepat, jujur, dan profesional. Pesan online — tim kami akan menghubungi Anda via WhatsApp.";

function asObj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}
function asStrArr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean);
}

/** Parse mentah publicProfile (Json) → bentuk tertip (tanpa default). */
export function parsePublicProfile(raw: unknown): PublicProfile {
  const o = asObj(raw);
  const badges = Array.isArray(o.trustBadges)
    ? (o.trustBadges as unknown[])
        .map((b) => {
          const bo = asObj(b);
          return typeof bo.label === "string" ? { label: bo.label.trim() } : null;
        })
        .filter((b): b is TrustBadge => Boolean(b && b.label))
    : undefined;
  const customers = Array.isArray(o.customers)
    ? (o.customers as unknown[])
        .map((c) => {
          const co = asObj(c);
          const name = typeof co.name === "string" ? co.name.trim() : "";
          const logoUrl = typeof co.logoUrl === "string" ? co.logoUrl.trim() : "";
          return logoUrl ? { name, logoUrl } : null;
        })
        .filter((c): c is { name: string; logoUrl: string } => Boolean(c))
    : undefined;
  return {
    description: typeof o.description === "string" ? o.description.trim() : undefined,
    tagline: typeof o.tagline === "string" ? o.tagline.trim() : undefined,
    services: o.services !== undefined ? asStrArr(o.services) : undefined,
    operatingHours: typeof o.operatingHours === "string" ? o.operatingHours.trim() : undefined,
    trustBadges: badges,
    instagram: typeof o.instagram === "string" ? o.instagram.trim() : undefined,
    mapUrl: typeof o.mapUrl === "string" ? o.mapUrl.trim() : undefined,
    customers,
  };
}

export function parseServiceArea(raw: unknown): ServiceArea {
  const o = asObj(raw);
  return { cities: asStrArr(o.cities), districts: asStrArr(o.districts) };
}

/**
 * Untuk RENDER /p: gabungkan nilai tenant dengan DEFAULT agar halaman selalu penuh.
 * Field opsional (instagram/mapUrl/customers) TIDAK diberi default (seksi disembunyikan bila kosong).
 */
export function resolvePublicView(rawProfile: unknown, rawArea: unknown, fallbackTagline: string | null) {
  const p = parsePublicProfile(rawProfile);
  const area = parseServiceArea(rawArea);
  const services = p.services && p.services.length ? p.services : DEFAULT_SERVICES;
  const badges = p.trustBadges && p.trustBadges.length ? p.trustBadges.slice(0, 3) : DEFAULT_TRUST_BADGES;
  const areaLabel = [...(area.cities ?? []), ...(area.districts ?? [])].join(", ");
  return {
    description: p.description || DEFAULT_DESCRIPTION,
    tagline: p.tagline || fallbackTagline || null,
    services,
    operatingHours: p.operatingHours || DEFAULT_OPERATING_HOURS,
    trustBadges: badges,
    instagram: p.instagram || null,
    mapUrl: p.mapUrl || null,
    areaLabel: areaLabel || null,
    customers: p.customers ?? [],
  };
}
