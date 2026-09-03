import { redirect } from "next/navigation";
import { tryGetServerContext } from "@/lib/auth/context";
import { listCatalogWithOverrideCount } from "@/lib/services/service-catalog-service";
import { AppHeader } from "../_components/app-header";
import { CatalogManager } from "./catalog-manager";

export const dynamic = "force-dynamic";

export default async function LayananPage() {
  const ctx = await tryGetServerContext();
  if (!ctx) redirect("/login?next=/app/layanan");

  const items = await listCatalogWithOverrideCount(ctx.tenantId);

  return (
    <main className="min-h-screen">
      <AppHeader title="Daftar Layanan" />
      <div className="mx-auto max-w-4xl space-y-6 px-5 py-6">
        <CatalogManager items={items} />
      </div>
    </main>
  );
}
