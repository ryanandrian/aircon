import { redirect } from "next/navigation";
import { tryGetServerContext } from "@/lib/auth/context";
import { listAssetRows } from "@/lib/services/asset-service";
import { AppHeader } from "../_components/app-header";
import { UnitManager } from "./unit-manager";

export const dynamic = "force-dynamic";

export default async function UnitPage() {
  const ctx = await tryGetServerContext();
  if (!ctx) redirect("/login?next=/app/unit");

  // Batch pertama (lazy-load lanjutan via server action). Antisipasi ratusan unit AC.
  const { rows, nextCursor } = await listAssetRows(ctx.tenantId, {});

  return (
    <main className="min-h-screen bg-background">
      <AppHeader title="Kode QR" />
      <div className="mx-auto max-w-4xl space-y-6 px-5 py-6">
        <UnitManager initialUnits={rows} initialCursor={nextCursor} />
      </div>
    </main>
  );
}
