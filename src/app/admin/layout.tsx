import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { AuthError } from "@/lib/auth/guard";
import { AdminNav } from "./admin-nav";
import { ThemeToggle } from "@/components/theme-toggle";

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
        <main className="flex-1 p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}
