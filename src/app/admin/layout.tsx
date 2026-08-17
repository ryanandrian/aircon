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
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex">
        <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white p-5 md:block">
          <div className="mb-6">
            <div className="text-lg font-semibold text-sky-600">Admin Platform</div>
            <div className="text-xs text-slate-500">Panel tim internal</div>
          </div>
          <nav className="flex flex-col gap-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-2xl px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-sky-50 hover:text-sky-700"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-8 border-t border-slate-100 pt-4 text-xs text-slate-500">
            <div className="font-medium text-slate-700">{admin.name}</div>
            <div className="truncate">{admin.email}</div>
          </div>
        </aside>
        <main className="flex-1 p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}
