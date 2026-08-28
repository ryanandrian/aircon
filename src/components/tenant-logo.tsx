import Image from "next/image";

/**
 * TenantLogo — logo usaha tenant di semua permukaan tenant (sidebar, invoice, halaman publik).
 * Fallback ke logo Aircon bila tenant belum upload. SATU komponen (seragam) — jangan hand-roll per layar.
 * `logoUrl` boleh URL absolut (S3) atau path publik. Kotak persegi (rasio 1:1), object-contain.
 */
export function TenantLogo({
  name,
  logoUrl,
  size = 40,
  className = "",
}: {
  name: string;
  logoUrl?: string | null;
  size?: number;
  className?: string;
}) {
  const src = logoUrl && logoUrl.trim().length > 0 ? logoUrl : "/brand/aircon-logo.png";
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white ring-1 ring-foreground/10 ${className}`}
      style={{ width: size, height: size }}
    >
      <Image
        src={src}
        alt={`Logo ${name || "Aircon"}`}
        width={size}
        height={size}
        className="h-full w-full object-contain"
        unoptimized
      />
    </span>
  );
}
