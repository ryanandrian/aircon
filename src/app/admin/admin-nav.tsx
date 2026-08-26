"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Building2, CreditCard, Scale, Landmark, Cpu, Handshake, Server, Globe,
} from "lucide-react";

const NAV = [
  { href: "/admin", label: "Ringkasan", icon: LayoutDashboard, exact: true },
  { href: "/admin/tenants", label: "Daftar Usaha", icon: Building2 },
  { href: "/admin/landing", label: "Landing Page", icon: Globe },
  { href: "/admin/paket", label: "Paket Langganan", icon: CreditCard },
  { href: "/admin/kebijakan", label: "Kebijakan Billing", icon: Scale },
  { href: "/admin/perusahaan", label: "Profil Perusahaan", icon: Landmark },
  { href: "/admin/iot", label: "Produk & Pesanan IoT", icon: Cpu },
  { href: "/admin/keagenan", label: "Program Keagenan", icon: Handshake },
  { href: "/admin/infra", label: "Konfigurasi Infra", icon: Server },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-2.5 rounded-2xl px-3 py-2 text-sm font-medium transition ${
              active
                ? "bg-sky-500 text-white shadow-sm shadow-sky-500/20"
                : "text-muted-foreground hover:bg-sky-50 hover:text-sky-700 dark:hover:bg-sky-950/40 dark:hover:text-sky-300"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
