import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { tryGetServerContext } from "@/lib/auth/context";
import { prisma } from "@/lib/prisma";
import { ThemeToggle } from "@/components/theme-toggle";
import { TenantLogo } from "@/components/tenant-logo";
import { AppNav } from "./_components/app-nav";

/**
 * App Shell tenant — sidebar persisten (desktop md+). Navigasi mobile via hamburger di AppHeader
 * tiap halaman (drawer). Navigasi seragam (AppNav) menggantikan pola launcher-card. Mobile-first.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const ctx = await tryGetServerContext();
  if (!ctx) redirect("/login?next=/app");

  const tenant = await prisma.tenant.findUnique({
    where: { id: ctx.tenantId },
    select: { name: true, logoUrl: true },
  });
  const name = tenant?.name ?? "Aircon";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex">
        {/* Sidebar desktop */}
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r bg-card p-5 md:flex">
          <div className="mb-6 flex items-center gap-2.5">
            <TenantLogo name={name} logoUrl={tenant?.logoUrl} size={36} />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-foreground">{name}</div>
              <div className="text-xs text-muted-foreground">Panel usaha</div>
            </div>
          </div>
          <AppNav />
          <div className="mt-auto flex items-center justify-between border-t pt-4">
            <span className="text-xs text-muted-foreground">Tampilan</span>
            <ThemeToggle />
          </div>
        </aside>

        {/* Kolom konten — tiap halaman punya AppHeader sendiri (judul + hamburger mobile) */}
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}
