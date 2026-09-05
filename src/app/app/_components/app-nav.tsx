"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/icons";

/** Item navigasi tenant — SATU sumber, dipakai sidebar desktop & drawer mobile (seragam). */
type NavItem = { href: string; label: string; icon: (typeof Icon)[keyof typeof Icon]; exact?: boolean };
type NavSection = { heading: string | null; items: NavItem[] };

/**
 * Navigasi diurut mengikuti ALUR BISNIS usaha AC (bukan acak):
 * - OPERASI: siklus uang harian (pelanggan → pekerjaan → invoice → laporan).
 * - DATA & OPERASIONAL: data master yang dipakai untuk menjalankan operasi.
 * - AKUN & LAINNYA: add-on IoT, langganan tenant ke platform, pengaturan.
 */
export const APP_NAV_SECTIONS: NavSection[] = [
  {
    heading: null,
    items: [
      { href: "/app", label: "Ringkasan", icon: Icon.Dashboard, exact: true },
      { href: "/app/pelanggan", label: "Pelanggan", icon: Icon.Users },
      { href: "/app/pekerjaan", label: "Pekerjaan", icon: Icon.Job },
      { href: "/app/faktur", label: "Invoice & Proforma", icon: Icon.Billing },
      { href: "/app/laporan", label: "Laporan Keuangan", icon: Icon.Chart },
    ],
  },
  {
    heading: "Data & Operasional",
    items: [
      { href: "/app/layanan", label: "Daftar Layanan", icon: Icon.Catalog },
      { href: "/app/teknisi", label: "Teknisi", icon: Icon.Technician },
      { href: "/app/checklist", label: "Checklist Servis", icon: Icon.Checklist },
      { href: "/app/unit", label: "Kode QR", icon: Icon.Web },
      { href: "/app/pesan", label: "Template Pesan", icon: Icon.Message },
    ],
  },
  {
    heading: "Akun & Lainnya",
    items: [
      { href: "/app/perangkat", label: "Pemantauan AC", icon: Icon.Device },
      { href: "/app/langganan", label: "Langganan", icon: Icon.Billing },
      { href: "/app/panduan", label: "Panduan", icon: Icon.Help },
      { href: "/app/pengaturan", label: "Pengaturan", icon: Icon.Settings },
    ],
  },
];

/** Daftar rata (untuk pemakaian lain yang butuh semua item). */
export const APP_NAV: NavItem[] = APP_NAV_SECTIONS.flatMap((s) => s.items);

export function AppNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {APP_NAV_SECTIONS.map((section, si) => (
        <div key={section.heading ?? "main"} className={si > 0 ? "mt-4" : undefined}>
          {section.heading && (
            <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">
              {section.heading}
            </p>
          )}
          <div className="flex flex-col gap-1">
            {section.items.map((item) => {
              const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
              const IconCmp = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-2.5 rounded-2xl px-3 py-2 text-sm font-medium transition ${
                    active
                      ? "bg-sky-500 text-white shadow-sm shadow-sky-500/20"
                      : "text-muted-foreground hover:bg-sky-50 hover:text-sky-700 dark:hover:bg-sky-950/40 dark:hover:text-sky-300"
                  }`}
                >
                  <IconCmp className="h-4 w-4 shrink-0" aria-hidden />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
