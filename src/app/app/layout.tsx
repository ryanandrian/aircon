import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { tryGetServerContext } from "@/lib/auth/context";
import { prisma } from "@/lib/prisma";
import { ThemeToggle } from "@/components/theme-toggle";
import { TenantLogo } from "@/components/tenant-logo";
import { gatewaySessionStatus } from "@/lib/wa/gateway-relay";
import { CustomerServiceFab } from "@/components/customer-service-fab";
import { AppNav } from "./_components/app-nav";
import { TenantIdentityProvider } from "./_components/tenant-identity-context";
import { LogoutButton } from "./logout-button";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const ctx = await tryGetServerContext();
  if (!ctx) redirect("/login?next=/app");
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
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r bg-card p-5 md:flex">
          <div className="mb-6 flex items-center gap-2.5">
            <TenantLogo name={name} logoUrl={tenant?.logoUrl} size={36} />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-foreground">{name}</div>
              {ctx.email && <div className="truncate text-xs text-muted-foreground">{ctx.email}</div>}
            </div>
          </div>
          <AppNav />
          <div className="mt-auto space-y-3 border-t pt-4">
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
