import { redirect } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { AuthError } from "@/lib/auth/guard";

const NAV = [
  { href: "/admin", label: "Ringkasan" },
  { href: "/admin/tenants", label: "Daftar Usaha" },
  { href: "/admin/paket", label: "Paket Langganan" },
  { href: "/admin/kebijakan", label: "Kebijakan Billing" },
  { href: "/admin/perusahaan", label: "Profil Perusahaan" },
  { href: "/admin/iot", label: "Produk & Pesanan IoT" },
  { href: "/admin/keagenan", label: "Program Keagenan" },
  { href: "/admin/infra", label: "Konfigurasi Infra" },
];

/**
 * Layout Admin Platform — entry utama. WAJIB requirePlatformAdmin.
 * Bila bukan admin platform, alihkan ke /login.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  let admin: { email: string; name: string };
  try {
    admin = await requirePlatformAdmin();
  } catch (e) {
    if (e instanceof AuthError) redirect("/login?next=/admin");
    throw e;
  }

  return (
    <div className="min-h-screen bg-muted/40 text-foreground">
      <div className="flex">
        <aside className="hidden w-60 shrink-0 border-r bg-card p-5 md:block">
          <div className="mb-6">
            <div className="text-lg font-semibold text-sky-600">Admin Platform</div>
            <div className="text-xs text-muted-foreground">Panel tim internal</div>
          </div>
          <nav className="flex flex-col gap-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-2xl px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-sky-50 hover:text-sky-700 dark:hover:bg-sky-950/40 dark:hover:text-sky-300"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-8 border-t pt-4 text-xs text-muted-foreground">
            <div className="font-medium text-foreground">{admin.name}</div>
            <div className="truncate">{admin.email}</div>
          </div>
        </aside>
        <main className="flex-1 p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}
