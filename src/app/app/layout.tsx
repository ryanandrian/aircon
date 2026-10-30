import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { getBillingRecoveryContext, type BillingRecoveryContext } from "@/lib/auth/context";
import { AuthError } from "@/lib/auth/guard";
import { isTenantUsable } from "@/lib/billing/gating-pure";
import { prisma } from "@/lib/prisma";
import { ThemeToggle } from "@/components/theme-toggle";
import { TenantLogo } from "@/components/tenant-logo";
import { gatewaySessionStatus } from "@/lib/wa/gateway-relay";
import { CustomerServiceFab } from "@/components/customer-service-fab";
import { AppNav } from "./_components/app-nav";
import { SidebarMenuScroll } from "./_components/sidebar-menu-scroll";
import { TenantIdentityProvider } from "./_components/tenant-identity-context";
import { LogoutButton } from "./logout-button";

/** Satu-satunya halaman yang boleh dibuka tenant tak usable: tempat membayar. */
const BILLING_RECOVERY_PATH = "/app/langganan";

export default async function AppLayout({ children }: { children: ReactNode }) {
  // SATU pemanggilan konteks. Tanpa sesi/user → AuthError NO_SESSION (lihat api.ts
  // yang memakai reason). Dengan sesi → status tenant ikut dikembalikan, sehingga
  // layout bisa memutuskan sendiri: layak penuh, atau hanya jalur pembayaran.
  let ctx: BillingRecoveryContext;
  try {
    ctx = await getBillingRecoveryContext();
  } catch (err) {
    if (err instanceof AuthError) redirect("/login?next=/app");
    throw err;
  }

  // Tenant tak usable: operasi tetap TERTUTUP. Satu-satunya pengecualian
  // halaman Langganan — tempat membayar, dan jalur satu-satunya penyembuhan.
  if (!isTenantUsable(ctx.tenantStatus)) {
    const pathname = (await headers()).get("x-pathname");
    if (pathname !== BILLING_RECOVERY_PATH) {
      redirect(`/login?next=/app&error=${ctx.tenantStatus.toLowerCase()}`);
    }
    // Shell MINIMAL: tanpa sidebar (semua menu operasi tautan mati) dan tanpa
    // fab CS. Provider tetap WAJIB — halaman memakai AppHeader → MobileNav,
    // dan useTenantIdentity() melempar bila provider tak terpasang.
    const tenant = await prisma.tenant.findUnique({
      where: { id: ctx.tenantId },
      select: { name: true, logoUrl: true },
    });
    return (
      <TenantIdentityProvider
        name={tenant?.name ?? "Aircon"}
        logoUrl={tenant?.logoUrl ?? null}
        email={ctx.email}
      >
        <div className="min-h-screen bg-background text-foreground">{children}</div>
      </TenantIdentityProvider>
    );
  }

  if (ctx.role === "TECHNICIAN") redirect("/t");

  const [tenant, platformWa] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: ctx.tenantId }, select: { name: true, logoUrl: true } }),
    gatewaySessionStatus("lumite-platform"),
  ]);
  const name = tenant?.name ?? "Aircon";
  const csPhone = platformWa.ok ? (platformWa.phone ?? "").replace(/\D/g, "") : "";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex">
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r bg-card p-5 md:flex print:hidden">
          <div className="mb-6 flex shrink-0 items-center gap-2.5">
            <TenantLogo name={name} logoUrl={tenant?.logoUrl} size={36} />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-foreground">{name}</div>
              {ctx.email && <div className="truncate text-xs text-muted-foreground">{ctx.email}</div>}
            </div>
          </div>
          {/* Menu discroll sendiri: kepala (logo) & footer (Tampilan + Keluar) tetap
              terlihat walau viewport laptop pendek — footer tak lagi terpotong.
              Scrollbar mengikuti gaya HP: tipis, muda, hanya tampil saat digulir. */}
          <SidebarMenuScroll>
            <AppNav />
          </SidebarMenuScroll>
          <div className="mt-auto shrink-0 space-y-3 border-t pt-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Tampilan</span>
              <ThemeToggle />
            </div>
            <LogoutButton className="w-full" />
          </div>
        </aside>
        <TenantIdentityProvider name={name} logoUrl={tenant?.logoUrl} email={ctx.email}>
          <div className="flex min-w-0 flex-1 flex-col">{children}</div>
        </TenantIdentityProvider>
      </div>
      {csPhone && <CustomerServiceFab phone={csPhone} />}
    </div>
  );
}
