"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/icons";

/** Item navigasi tenant — SATU sumber, dipakai sidebar desktop & drawer mobile (seragam). */
type NavItem = { href: string; label: string; icon: (typeof Icon)[keyof typeof Icon]; exact?: boolean };

export const APP_NAV: NavItem[] = [
  { href: "/app", label: "Ringkasan", icon: Icon.Dashboard, exact: true },
  { href: "/app/pelanggan", label: "Pelanggan", icon: Icon.Users },
  { href: "/app/unit", label: "Unit AC", icon: Icon.AC },
  { href: "/app/layanan", label: "Daftar Layanan", icon: Icon.Catalog },
  { href: "/app/pekerjaan", label: "Pekerjaan", icon: Icon.Job },
  { href: "/app/teknisi", label: "Teknisi", icon: Icon.Technician },
  { href: "/app/perangkat", label: "Pemantauan AC", icon: Icon.Device },
  { href: "/app/langganan", label: "Langganan", icon: Icon.Billing },
  { href: "/app/pesan", label: "Template Pesan", icon: Icon.Message },
  { href: "/app/checklist", label: "Checklist Servis", icon: Icon.Checklist },
  { href: "/app/pengaturan", label: "Pengaturan", icon: Icon.Settings },
];

export function AppNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {APP_NAV.map((item) => {
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
    </nav>
  );
}
