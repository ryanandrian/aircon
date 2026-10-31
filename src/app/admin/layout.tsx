import { redirect } from "next/navigation";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { AuthError } from "@/lib/auth/guard";
import { AdminNav } from "./admin-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { MobileAdminNav } from "./mobile-admin-nav";

export const metadata: Metadata = {
  applicationName: "Aircon — Admin Platform",
  manifest: "/admin/manifest.json",
};

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
      <div className="flex min-w-0">
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r bg-card p-5 md:flex">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <div className="text-lg font-semibold text-sky-600">Admin Platform</div>
              <div className="text-xs text-muted-foreground">Panel tim internal</div>
            </div>
            <ThemeToggle />
          </div>
          <AdminNav />
          <div className="mt-auto border-t pt-4 text-xs text-muted-foreground">
            <div className="font-medium text-foreground">{admin.name}</div>
            <div className="truncate">{admin.email}</div>
          </div>
        </aside>
        <div className="min-w-0 flex-1">
          <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">
            <div className="flex min-w-0 items-center gap-2">
              <MobileAdminNav adminName={admin.name} adminEmail={admin.email} />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-sky-600">Admin Platform</div>
                <div className="truncate text-[11px] text-muted-foreground">Panel tim internal</div>
              </div>
            </div>
            <ThemeToggle />
          </div>
          <main className="min-w-0 p-3 sm:p-4 md:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
